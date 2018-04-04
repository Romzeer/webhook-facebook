'use strict';

const apiai = require('apiai');
const express = require('express');
const bodyParser = require('body-parser');
const uuid = require('node-uuid');
const request = require('request');
const JSONbig = require('json-bigint');
const async = require('async');
const axios = require('axios');
const mathsteps = require('mathsteps');


const REST_PORT = (process.env.PORT || 5000);
const APIAI_ACCESS_TOKEN = process.env.APIAI_ACCESS_TOKEN;
const APIAI_LANG = process.env.APIAI_LANG || 'en';
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const GIF = ".gif";
const JPEG = ".jpeg";
const JPG = ".jpg";
const PNG = ".png";

const apiAiService = apiai(APIAI_ACCESS_TOKEN, {language: APIAI_LANG, requestSource: "fb"});
console.log(apiAiService);

const sessionIds = new Map();
var secondMessage = "";
function processEvent(event) {
    var sender = event.sender.id.toString();

    if ((event.message && event.message.text) || (event.postback && event.postback.payload)) {
        var text = event.message ? event.message.text : event.postback.payload;
        // Handle a text message from this sender

        if (!sessionIds.has(sender)) {
            sessionIds.set(sender, uuid.v1());
        }

        console.log("Text", text);

        let apiaiRequest = apiAiService.textRequest(text,
            {
                sessionId: sessionIds.get(sender)
            });

        apiaiRequest.on('response', (response) => {
      
            if (isDefined(response.result)) {
                let responseText = response.result.fulfillment.speech;
                let responseData = response.result.fulfillment.data;
                let action = response.result.action;
                let messages = response.result.fulfillment.messages;
                console.log(response.result.parameters);
                let messagesDatas = [];

                if (action == "input.whatis") {
                    let param = response.result.parameters.any;
               
                    let url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${param}&limit=3&profile=strict&namespace=0&format=json`
            
                    axios.get(url)
                    .then(function (response) {
                        console.log(response.data[2][0]);

                        if (response.data[2][0].includes("may refer to:")) {
                            let responseMessage = {text: response.data[2][1]};
                            secondMessage = {text: response.data[2][2]};
                            let askMessage = {text: "Is it correct ?"};
                            messagesDatas.push(responseMessage, askMessage);
                            sendFBMessage(sender, messagesDatas, 0);
                        }
                        
                        else if (!Array.isArray(response.data[2]) || !response.data[2].length) {
                            let askMessage = {text: "Sorry, i have no idea of what " + param +" means... :("};
                            messagesDatas.push(askMessage);
                            sendFBMessage(sender, messagesDatas, 0);
                          }
                        else { 
                            let responseMessage = {text: response.data[2][0]};
                            secondMessage = {text: response.data[2][1]};
                            let askMessage = {text: "Is it correct ?"};
                            messagesDatas.push(responseMessage, askMessage);
                            sendFBMessage(sender, messagesDatas, 0);
                        } 
                    })
                    .catch(function (error) {
                      console.log(error);
                    }); 
                }
                if (action == "defaultttt.defaultttt-no") {
                    
                     
                      let secAskMessage = {text: "And now is it correct ?"};
                      messagesDatas.push(secondMessage, secAskMessage);
                      sendFBMessage(sender, messagesDatas, 0); 
                      secondMessage = "";
                }
                if (action == "input.calcul") {
                    let steps = mathsteps.simplifyExpression(text);
                    steps.forEach(step => {
                        console.log("before change: " + step.oldNode.toString());   // before change: 2 x + 2 x + x + x
                        console.log("change: " + step.changeType);                  // change: ADD_POLYNOMIAL_TERMS
                        console.log("after change: " + step.newNode.toString());    // after change: 6 x
                        console.log("# of substeps: " + step.substeps.length);      // # of substeps: 3
                    });
                }
                
                else if (isDefined(messages) && messages.length > 1) {
                    const fbDatas = messages.filter(element => element.platform == "facebook");
                    if (fbDatas.length > 0) {
                    fbDatas.forEach(value => {
                       
                        if (value.type == "0") {

                            console.log("TEEXT");
                            //
                            let newMessage =  {text: value.speech};
                            messagesDatas.push(newMessage);
                        }
                        else if (value.type == "1") {
                            let buttons = value.buttons.map(button => {
                                return {"type" : "web_url",
                                        "url": button.postback,
                                        "title": button.text}
                            });
                            console.log(buttons);
                            let newMessage = {
                                "attachment": {
                                    "type": "template",
                                    "payload": {
                                        "template_type": "generic",
                                        "elements": [{
                                            "title": value.title,
                                            "subtitle": "",
                                            "image_url": value.imageUrl,
                                            "buttons": buttons,
                                        }]
                                    }
                                }
                            }
                            messagesDatas.push(newMessage);
                        }
                        else if (value.type == "3") {
                                //sendGenericMessage(sender, value.imageUrl);
                                let newMessage =  {  
                                    attachment: {
                                        type: "image",
                                        payload: {
                                            url: value.imageUrl,
                                            is_reusable:true
                                        }
                                    }
                                };
                                messagesDatas.push(newMessage);
                        }
                        else if (value.type == "2") {
                            console.log("quickreply");
                            let quickReplies = value.replies.map(reply => {
                                return {
                                  "content_type": "text",
                                  "title": reply,
                                  "payload": reply
                                };
                              }); 
                              let newMessage = {
                                text: value.title,
                                quick_replies: quickReplies,
                            }
                            messagesDatas.push(newMessage);
                        }
                    });
                    console.log(messagesDatas);
                    sendFBMessage(sender, messagesDatas, 0);
                } else {
                    messages.forEach(value => {
                        if (value.type == "0") {
                            let newMessage = {text: value.speech};
                            messagesDatas.push(newMessage);
                        }
                    });

                    sendFBMessage(sender, messagesDatas, 0);
                }
                }
               else if (isDefined(responseData) && isDefined(responseData.facebook)) {
                    if (!Array.isArray(responseData.facebook)) {
                        try {
                            console.log(' Ici Response as formatted message');
                            sendFBMessage(sender, responseData.facebook);
                        } catch (err) {
                            sendFBMessage(sender, {text: err.message});
                        }
                    } else {
                        responseData.facebook.forEach((facebookMessage) => {
                            try {
                                if (facebookMessage.sender_action) {
                                    console.log('Response as sender action');
                                    sendFBSenderAction(sender, facebookMessage.sender_action);
                                }
                                else {
                                    console.log('Response as formatted message');
                                    sendFBMessage(sender, facebookMessage);
                                }
                            } catch (err) {
                                sendFBMessage(sender, {text: err.message});
                                console.log(err.message);
                            }
                        });
                    }
                } else if (isDefined(responseText)) {
                    // console.log('Response as text message');
                    // // facebook API limit for text length is 320,
                    // // so we must split message if needed
                    // var splittedText = splitResponse(responseText);

                    // async.eachSeries(splittedText, textPart => {
                        let newMessage = {text: responseText};
                        messagesDatas.push(newMessage);
                        console.log(messagesDatas);
                        sendFBMessage(sender, messagesDatas, 0);
                   // });
                }

            }
        });

        apiaiRequest.on('error', (error) => console.error(error));
        apiaiRequest.end();
    }
}

function splitResponse(str) {
    if (str.length <= 320) {
        return [str];
    }

    return chunkString(str, 300);
}

function chunkString(s, len) {
    var curr = len, prev = 0;

    var output = [];

    while (s[curr]) {
        if (s[curr++] == ' ') {
            output.push(s.substring(prev, curr));
            prev = curr;
            curr += len;
        }
        else {
            var currReverse = curr;
            do {
                if (s.substring(currReverse - 1, currReverse) == ' ') {
                    output.push(s.substring(prev, currReverse));
                    prev = currReverse;
                    curr = currReverse + len;
                    break;
                }
                currReverse--;
            } while (currReverse > prev)
        }
    }
    output.push(s.substr(prev));
    return output;
}

function sendFBMessage(sender, messageData, i) {
 
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: FB_PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: sender},
            message: messageData[i]
        }
    }, (error, response, body) => {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        } else {
            console.log("dans la réponse");
            if(i < messageData.length) {
                sendFBMessage(sender, messageData, i+1);
            }
        }
    });
}

function sendFBSenderAction(sender, action, callback) {
    setTimeout(() => {
        request({
            url: 'https://graph.facebook.com/v2.6/me/messages',
            qs: {access_token: FB_PAGE_ACCESS_TOKEN},
            method: 'POST',
            json: {
                recipient: {id: sender},
                sender_action: action
            }
        }, (error, response, body) => {
            if (error) {
                console.log('Error:', error);
            } else if (response.body.error) {
                console.log('Error: ', response.body.error);
            }
            if (callback) {
                callback();
            }
        });
    }, 1000);
}


function doSubscribeRequest() {
    request({
            method: 'POST',
            uri: "https://graph.facebook.com/v2.6/me/subscribed_apps?access_token=" + FB_PAGE_ACCESS_TOKEN
        },
        (error, response, body) => {
            if (error) {
                console.error('Error while subscription: ', error);
            } else {
                console.log('Subscription result: ', response.body);
            }
        });
}

function isDefined(obj) {
    if (typeof obj == 'undefined') {
        return false;
    }

    if (!obj) {
        return false;
    }

    return obj != null;
}

const app = express();

app.use(bodyParser.text({type: 'application/json'}));

app.get('/webhook/', (req, res) => {
    if (req.query['hub.verify_token'] == FB_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);

        setTimeout(() => {
            doSubscribeRequest();
        }, 3000);
    } else {
        //console.log(req);
        res.send('Error, wrong validation token');
    }
});

app.post('/webhook/', (req, res) => {
    try {
        var data = JSONbig.parse(req.body);
     
        if (data.entry) {
            let entries = data.entry;
            entries.forEach((entry) => {
                let messaging_events = entry.messaging;
                if (messaging_events) {
                    console.log(messaging_events);
                    messaging_events.forEach((event) => {
                        if (event.message && !event.message.is_echo ||
                            event.postback && event.postback.payload) {
                            processEvent(event);
                        }
                    });
                }
            });
        }

        return res.status(200).json({
            status: "ok"
        });
    } catch (err) {
        return res.status(400).json({
            status: "error",
            error: err
        });
    }

});

app.listen(REST_PORT, () => {
    console.log('Rest service ready on port ' + REST_PORT);
});

doSubscribeRequest();
