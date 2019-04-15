/*
 * 
 */

'use strict';

var express = require('express');	// app server
const axios = require('axios');		// HTTP Client
const https = require('https');
var bodyParser = require('body-parser'); // parser for post requests
var _ = require('lodash');

var app = express();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());

const API_VERSION = '2019-02-28';
//const API_VERSION = '2018-07-10';

console.log("app-axios.js: V2.0.1");
console.log("env.ASSISTANT_IAM_APIKEY: " + process.env.ASSISTANT_IAM_APIKEY);
console.log("env.WORKSPACE_ID: " + process.env.WORKSPACE_ID);
console.log("env.ASSISTANT_URL: " + process.env.ASSISTANT_URL);

var uri = '/v1/workspaces/' + process.env.WORKSPACE_ID + '/message?version=' + API_VERSION;

const instance = axios.create({
	method:'post',
	baseURL: process.env.ASSISTANT_URL,
	url: uri,
	auth: {
	  username: 'apikey',
	  password: process.env.ASSISTANT_IAM_APIKEY
	},
	httpsAgent: new https.Agent({  
		rejectUnauthorized: false
	}),
	headers: {'Content-Type': 'application/json'},
	data: {
		input: {
	    text: 'Hello'
		}
	}
});

function expressPostCallback(req, res) {
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
    workspace_id: process.env.WORKSPACE_ID,
    context: req.body.context || {},
    input: req.body.input || {}
  };
  
  instance.defaults.data = payload;
  
  instance.request()
	  .then(function (response) {
//	      console.log(JSON.stringify(response.data));
	      
	      if (!response.data.output) 
	    	    response.data.output = {};
	      
	      res.json(response.data);
	  })
	  .catch(function (error) {
	    console.log('Assistant host communication error: ' + error);
		return res.status(500).json(error);
	    
	  });
};

/*
 * endpoint to be called from the client side
 */
app.post('/api/message', expressPostCallback);

/*
 * Ping the backend on initialization
 */

console.log("---- Performing Initialization Backend Ping Test ...");

let initReq = {};
initReq.body = {input: {text: 'Hello'}};

let initRes = {};
initRes.status = function(code){console.log('Assistant host communication error: ' + error);};
initRes.json = function(json){console.log('Ping results: ' + JSON.stringify(json))};

expressPostCallback(initReq, initRes);

  
module.exports = app;