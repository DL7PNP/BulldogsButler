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
        this.addAnswerWithUsers(text, value, [])
    }

    addAnswerWithUsers(text, value, user) {
        var answer = {
            text: text,
            id: value,
            user: user
        }    
        this.poll.answers.push(answer);
        this.msg.attachments[0].actions.push({
            "name": "option",
            "text": text,
            "type": "button",
            "value": value
        });
    }

    setTimestamp(ts) {
        this.poll.ts = ts;
    }
   
    getPoll() {
        return this.poll;
    }

    getMsg() { 
        var resultAttachment;
        this.poll.answers.forEach(ans => {
            if (ans.user.length > 0) {      //are there any users to this answer?
                //resultAttachment.push(      //if yes, create an attachment
                var userstring = "";
                ans.user.forEach(u => {
                    userstring += '<@' + u + '>, ';
                    console.log(u);
                });
                userstring = userstring.substring(0, userstring.length -2);     //remove last Komma
                this.msg.attachments.push(
                    {
                        "color": "#36a64f",
                        "text": "*" + ans.user.length + "* " + ans.text + " ⇢ " + userstring
                    }
                );
            }
        });

        //result = this.msg
        /**/

        return this.msg;
    }
}

module.exports = Poll;