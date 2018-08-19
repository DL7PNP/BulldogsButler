// server.js
const express        = require('express');
const MongoClient    = require('mongodb').MongoClient;
const bodyParser     = require('body-parser');
const app            = express();
const request        = require('request');

//config
const MongoURL          = 'mongodb://localhost:27017';
const MongoDatabase     = 'BulldogsButtler';
const MongoCollection   = 'polls';
const SlackAccessToken  = process.env.ButlerToken
const dialogURL         = 'https://slack.com/api/dialog.open';
const postMessageURL    = 'https://slack.com/api/chat.postMessage';
const port              = 8080;

app.use(bodyParser.json());                         // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// start server
app.listen(port, () => {
    console.log('We are live on ' + port);

    //incoming Slash command /abfrage
    app.post('/create', function(req, res) {
        console.log(req.body);
        //Extract json data
        const { token,
                team_id,
                team_domain,
                channel_id,
                channel_name,
                user_id,
                user_name,
                trigger_id,
                text,
                response_url } = req.body;

        var lines = text.split(/[\r\n]+/);         //Split usermessage
        if (lines.length < 2) {                    //Errorhandling
            res.send('Please submit at least 2 lines! First line with your question and second with your deadline.');
            return;
        }

        //Build message
        //ToDo: author name and image
        mypoll = new Poll(team_id, team_domain, channel_id, channel_name, user_id, user_name, lines[0], lines[1]);

        if (lines.length == 2) {
            //Standardantworten hinzufügen: ja, ja+1, nein
            lines.push(":heavy_check_mark:", ":heavy_check_mark:+1", ":heavy_check_mark:+2", ":goal_net:", ":x:");
        } 

        //Antworten hinzufügen
        for (var i = 2; i < lines.length; i++) {
            mypoll.addAnswer(lines[i], i)
        }    

        //post message
        request({
            headers: {
                'Authorization' : SlackAccessToken,
                'content-type'  : 'application/json'
            },
            uri: postMessageURL,
            body: JSON.stringify(mypoll.getMsg()),
            method: 'POST'
        }, function (error, response, body) {
            console.log('error:', error); 
            console.log('statusCode:', response && response.statusCode); 
            console.log('body:', body); 

            const {ok, ts} = JSON.parse(body);
            if (ok == true) {
                //Write poll to db
                MongoClient.connect(MongoURL, function(err, db) {
                    if (err) throw err;
                    var dbo = db.db("BulldogsButler");
                    dbo.collection("polls").insertOne(mypoll.getPoll(), function(err, res) {
                        if (err) throw err;
                        console.log("1 document inserted:" + res["ops"][0]["_id"]);
                        db.close();
                    });
                });
            }    
        });
    });

    //incoming action-endpoint aka. button pressed
    app.post('/action-endpoint', function(req, res) {
        console.log('action-endpoint:');

        const {} = JSON.parse(req.body.payload);
        console.log(req.body.payload);

    });
});


class Poll {

    //Create an new poll
    constructor(team_id, team_domain, channel_id, channel_name, user_id, user_name, question, deadline){
        this.poll = {
            "ts": "",
            "team_id": team_id,
            "team_domain": team_domain,
            "channel_id": channel_id,
            "channel_name": channel_name,
            "user_id": user_id,
            "user_name": user_name,
            "question": question,
            "deadline": deadline,
            "answers": []
        };

        this.msg = {
            "response_type": "in_channel",
            "channel": channel_id,
            "text": "",
            "mrkdwn_in": true,
            "attachments": [
                {
                    "text": question,
                    //"fallback": "Sorry, you are unable to answer this poll.",
                    "callback_id": "poll",
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                    "actions": []
                }
            ]
        };
    }

    //Add an answer
    addAnswer(text, value) {
        this.poll.answers.push([text, value]);
        this.msg.attachments[0].actions.push({
            "name": "option",
            "text": text,
            "type": "button",
            "value": value
        });
    }

    setTimestamp(ts) {
        this.ts = ts;
    }
   
    getPoll() {
        return this.poll;
    }

    getMsg() { 
        return this.msg;
    }
}