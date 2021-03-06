/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

'use strict';

var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var AssistantV1 = require('watson-developer-cloud/assistant/v1'); // watson SDK
var _ = require('lodash');

var app = express();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());

const API_VERSION = '2019-02-28';
//const API_VERSION = '2018-07-10';

// Create the service wrapper
const assistant = new AssistantV1({
  version: API_VERSION,
  iam_apikey: process.env.ASSISTANT_PASSWORD,
  url: process.env.ASSISTANT_URL,
  disable_ssl_verification: true
});

console.log("app.js: V1.0.5");
console.log("env.ASSISTANT_IAM_APIKEY: " + process.env.ASSISTANT_IAM_APIKEY);
console.log("env.WORKSPACE_ID: " + process.env.WORKSPACE_ID);
console.log("env.ASSISTANT_URL: " + process.env.ASSISTANT_URL);

function dumpIfExists(name, env_value)
{
	if (env_value)
	{
		console.log(name + ': ' + env_value);
	}
}

dumpIfExists('env.SERVICE_NAME_USERNAME: ', process.env.SERVICE_NAME_USERNAME);
dumpIfExists('env.SERVICE_NAME_PASSWORD: ', process.env.SERVICE_NAME_PASSWORD);
dumpIfExists('env.SERVICE_NAME_IAM_APIKEY: ', process.env.SERVICE_NAME_IAM_APIKEY);
dumpIfExists('env.SERVICE_NAME_IAM_URL: ', process.env.SERVICE_NAME_IAM_URL);
dumpIfExists('env.SERVICE_NAME_IAM_ACCESS_TOKEN: ', process.env.SERVICE_NAME_IAM_ACCESS_TOKEN);
dumpIfExists('env.SERVICE_NAME_URL: ', process.env.SERVICE_NAME_URL);
dumpIfExists('env.VCAP_SERVICES: ', process.env.VCAP_SERVICES);

console.log("Assistant _options properties: " + Object.getOwnPropertyNames(assistant._options));
console.log("opt.version: " + assistant._options.version);
console.log("opt.rejectUnauthorized: " + assistant._options.rejectUnauthorized);
console.log("opt.disable_ssl_verification: " + assistant._options.disable_ssl_verification);

function dumpCredentials(id)
{
	console.log("------------- " + id + " Credentials -------------");
	console.log("opt.iam_apikey: " + assistant._options.iam_apikey);
	console.log("opt.url: " + assistant._options.url);
}

dumpCredentials("Initial");

// Endpoint to be call from the client side
app.post('/api/message', function (req, res) {
  let workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  
  if (!workspace || workspace === '<workspace-id>') 
  {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/assistant-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/assistant-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    });
  }
  
  let payload = {
    workspace_id: workspace,
    context: req.body.context || {},
    input: req.body.input || {}
  };
  
//  console.log('client -> login_reqd: ' + (_.has(payload.context, 'login_reqd') ? payload.context.login_reqd : 'null'));

  // Send the input to the assistant service
  assistant.message(payload, function (err, data) {
	  
	  dumpCredentials("Request");
	  
    if (err) 
	{
    	console.log('Assistant host communication error: ' + err);
    	return res.status(500).json(err);
	}

    // This is a fix for now, as since Assistant version 2018-07-10,
    // output text can now be in output.generic.text
    if (data.output.text.length === 0 && _.has(data.output, 'generic')) 
    	if (_.isArray(data.output.generic)) 
	        if (_.has(data.output.generic[0], 'text')) 
	        	data.output.text = data.output.generic[0].text;
	        else 
	        	if (_.has(data.output.generic[0], 'title')) 
	        		data.output.text = data.output.generic[0].title;
    
//    console.log('client <- login_reqd: ' + (_.has(data.context, 'login_reqd') ? data.context.login_reqd : 'null'));

    return res.json(updateMessage(payload, data));
  });
});

/**
 * Updates the response text using the intent confidence
 * 
 * @param {Object}
 *            input The request to the Assistant service
 * @param {Object}
 *            response The response from the Assistant service
 * @return {Object} The response with the updated message
 */
function updateMessage(input, response) 
{
  var responseText = null;
  
  if (!response.output) 
    response.output = {};
  else 
    return response;
  
  if (response.intents && response.intents[0]) 
  {
    var intent = response.intents[0];
    // Depending on the confidence of the response the app can return different
	// messages.
    // The confidence will vary depending on how well the system is trained. The
	// service will always try to assign
    // a class/intent to the input. If the confidence is low, then it suggests
	// the service is unsure of the
    // user's intent . In these cases it is usually best to return a
	// disambiguation message
    // ('I did not understand your intent, please rephrase your question',
	// etc..)
    if (intent.confidence >= 0.75) 
    	responseText = 'I understood your intent was ' + intent.intent;
    else 
    	if (intent.confidence >= 0.5) 
    		responseText = 'I think your intent was ' + intent.intent;
    	else 
    		responseText = 'I did not understand your intent';
  }
  
  response.output.text = responseText;
  return response;
}

module.exports = app;