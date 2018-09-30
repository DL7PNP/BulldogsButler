/*
TODO
- who hasent answered https://api.slack.com/methods/channels.info
- Profilfoto und Autor
- Deadline
- Fehlerabfrage
*/

const express        = require('express');
const MongoClient    = require('mongodb').MongoClient;
const bodyParser     = require('body-parser');
const app            = express();
const request        = require('request');
const Promise        = require('promise');

const Poll           = require('./Poll');

console.log('config...');
//config
const DatabaseServiceName   = process.env.DATABASE_SERVICE_NAME;
const MongoDbUser           = process.env.MONGODB_USER;
const MongoDbPassword       = process.env.MONGODB_PASSWORD;
const MongoDbDatabase       = process.env.MONGODB_DATABASE;
const MongoDatabase         = 'BulldogsButtler';
const MongoCollection       = 'polls';
const SlackAccessToken      = process.env.SLACK_ACCESS_TOKEN || 'Bearer xoxb-359316545461-aeuDuFBebnhbZ7WbX6A0XkuR';
const dialogURL             = 'https://slack.com/api/dialog.open';
const postMessageURL        = 'https://slack.com/api/chat.postMessage';
const port                  = process.env.OPENSHIFT_NODEJS_PORT || 8080;
const MongoURL              = 'mongodb://' + MongoDbUser + ':' + MongoDbPassword + '@' + DatabaseServiceName + ':27017'; // 'mongodb://localhost:27017';

app.use(bodyParser.json());                         // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// start server
app.listen(port, () => {
    console.log('We are live on ' + port);

    //incoming Slash command /abfrage
    app.post('/create', function(req, res) {
        res.sendStatus(200);

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
        let mypoll = new Poll(team_id, team_domain, channel_id, channel_name, user_id, user_name, lines[0], lines[1]);

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
            mypoll.setTimestamp(ts);

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
        console.log('\naction-endpoint:');

        payload = JSON.parse(req.body.payload);
        
        getPollFromDb(payload.team.id, payload.channel.id, payload.original_message.ts, function(err, result) {
            //manage answers
            result.answers.forEach(element => {
                var index = element.user.indexOf(payload.user.id);  // get index of user 
                if (index > -1) {                                   // if user previously answered this answer
                    element.user.splice(index, 1);                  // remove user from answer
                }
                if (element.id == payload.actions[0].value) {       // if user answered this anser
                    element.user.push(payload.user.id);             // add him to this answer
                }
            });

            //Update dataset back to db
            MongoClient.connect(MongoURL, function(err, db) {
                if (err) throw err;
                var dbo = db.db("BulldogsButler");
                var myquery = { _id: result._id };
                dbo.collection("polls").updateOne(myquery, result, function(err, res2) {
                    if (err) throw err;
                    console.log("1 document updated");
                    db.close();

                    //return message to slack
                    poll = new Poll(result.team_id, null, result.channel_id, null, null, null, result.question, null);
                    poll.setTimestamp(result.ts);

                    result.answers.forEach(item => {
                        poll.addAnswerWithUsers(item.text, item.id, item.user);
                    });

                    //post message
                    res.set({
                        'Authorization' : SlackAccessToken,
                        'content-type'  : 'application/json'
                    });
                    res.send(JSON.stringify(poll.getMsg()));
                });
            });
        });
    });
});

//Get a single Poll from the database
//return database result
function getPollFromDb(team_id, channel_id, timestamp, cb) {

    MongoClient.connect(MongoURL, function(err, db) {
        if (err) throw err;
        var dbo = db.db("BulldogsButler");
        var query = {
                        team_id: team_id,
                        channel_id: channel_id,
                        ts: timestamp
                    };
        dbo.collection("polls").findOne(query, function(err, result) {
            if (err) throw err;

            db.close();    
            cb(err, result);
        });
    });     
}