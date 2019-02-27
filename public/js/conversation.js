// The ConversationPanel module is designed to handle
// all display and behaviors of the conversation column of the app.
/* eslint no-unused-vars: "off" */
/* global Api: true, Common: true*/

var ConversationPanel = (function()
{
	var settings = {
		selectors : {
			chatBox : '#scrollingChat',
			fromUser : '.from-user',
			fromWatson : '.from-watson',
			latest : '.latest'
		},
		authorTypes : {
			user : 'user',
			watson : 'watson'
		}
	};
	
	/*
	 * This describes the state that our pretend user can be in with the 
	 * dealership.
	 */
	const cmdMap = {
		prefix: 'vss',
		states: [
			'none',
			'dropoff',
			'inspect',
			'notstarted',
			'inprocess',
			'complete'
		]
	};
	
	var currentVehicleServiceStatus;
	const spawnTabTriggerIntent = 'vehicle-inspection-process';

	// Publicly accessible methods defined
	return {
		init : init,
		inputKeyDown : inputKeyDown,
		login : login
	};

	// Initialize the module
	function init()
	{
		chatUpdateSetup();
		
		getQueryParm();
		let initContext = {vehicle_service_status: currentVehicleServiceStatus};
		
		Api.sendRequest('', initContext);
		setupInputBox();
	}
	
	function getQueryParm()
	{
		let queryStr = window.location.search;
		
		if (queryStr)
		{
			let cmdIndex = queryStr.indexOf(cmdMap.prefix);
			let newVss = undefined;
			
			if (cmdIndex !== -1)
			{
				let inputBox = {
					value: queryStr.substring(cmdIndex)
				};
				
				isCommand(inputBox);
			}
		}
		else
			currentVehicleServiceStatus = cmdMap.states[0];
	}
	
	
	// Set up callbacks on payload setters in Api module
	// This causes the displayMessage function to be called when messages are sent / received
	function chatUpdateSetup()
	{
		var currentRequestPayloadSetter = Api.setRequestPayload;
		Api.setRequestPayload = function(newPayloadStr)
		{
			currentRequestPayloadSetter.call(Api, newPayloadStr);
			displayMessage(JSON.parse(newPayloadStr), settings.authorTypes.user);
		};

		var currentResponsePayloadSetter = Api.setResponsePayload;
		Api.setResponsePayload = function(newPayloadStr)
		{
			currentResponsePayloadSetter.call(Api, newPayloadStr);
			displayMessage(JSON.parse(newPayloadStr), settings.authorTypes.watson);
		};
	}

	// Set up the input box to underline text as it is typed
	// This is done by creating a hidden dummy version of the input box that
	// is used to determine what the width of the input text should be.
	// This value is then used to set the new width of the visible input box.
	function setupInputBox()
	{
		var input = document.getElementById('textInput');
		var dummy = document.getElementById('textInputDummy');
		var minFontSize = 14;
		var maxFontSize = 16;
		var minPadding = 4;
		var maxPadding = 6;

		// If no dummy input box exists, create one
		if (dummy === null)
		{
			var dummyJson = {
				'tagName' : 'div',
				'attributes' : [ {
					'name' : 'id',
					'value' : 'textInputDummy'
				} ]
			};

			dummy = Common.buildDomElement(dummyJson);
			document.body.appendChild(dummy);
		}

		function adjustInput()
		{
			if (input.value === '')
			{
				// If the input box is empty, remove the underline
				input.classList.remove('underline');
				input.setAttribute('style', 'width:' + '100%');
				input.style.width = '100%';
			}
			else
			{
				// otherwise, adjust the dummy text to match, and then set the width of
				// the visible input box to match it (thus extending the underline)
				input.classList.add('underline');
				var txtNode = document.createTextNode(input.value);
				[ 'font-size', 'font-style', 'font-weight', 'font-family', 'line-height', 'text-transform',
						'letter-spacing' ].forEach(function(index)
				{
					dummy.style[index] = window.getComputedStyle(input, null).getPropertyValue(index);
				});
				dummy.textContent = txtNode.textContent;

				var padding = 0;
				var htmlElem = document.getElementsByTagName('html')[0];
				var currentFontSize = parseInt(window.getComputedStyle(htmlElem, null).getPropertyValue('font-size'),
						10);
				if (currentFontSize)
				{
					padding = Math.floor((currentFontSize - minFontSize) / (maxFontSize - minFontSize)
							* (maxPadding - minPadding) + minPadding);
				}
				else
				{
					padding = maxPadding;
				}

				var widthValue = (dummy.offsetWidth + padding) + 'px';
				input.setAttribute('style', 'width:' + widthValue);
				input.style.width = widthValue;
			}
		}

		// Any time the input changes, or the window resizes, adjust the size of the input box
		input.addEventListener('input', adjustInput);
		window.addEventListener('resize', adjustInput);

		// Trigger the input event once to set up the input box and dummy element
		Common.fireEvent(input, 'input');
	}

	// Display a user or Watson message that has just been sent/received
	function displayMessage(newPayload, typeValue)
	{
		var isUser = isUserMessage(typeValue);
		var textExists = (newPayload.input && newPayload.input.text) || (newPayload.output && newPayload.output.text);
		
		// Take local action when intent is receive from Watson
		if (!isUser && newPayload.intents) 
		{
			for (let i = 0; i < newPayload.intents.length; i++) 
			{
			    let intent = newPayload.intents[i];
			    
			    // Open QR Code tab
			    if (intent.intent === spawnTabTriggerIntent && newPayload.context && newPayload.context.sim_mobile_host) 
			    {
			    	if (newPayload.context.sim_mobile_host_auto_open && newPayload.context.sim_mobile_host_auto_open === true)
		    		{
			    		if (intent.confidence > 0.85)
		    			{
			    			window.open(newPayload.context.sim_mobile_host, '_blank');
			    			console.log("Attempt create QR tab with intent conf: " + intent.confidence);
		    			}
			    		else
			    			console.log("QR tab NOT created due low confidence: " + intent.confidence);
		    		}
			    	else
			    		console.log("QR tab NOT created due to flags: context.sim_mobile_host_auto_open");
			    }
			}
		} 
		
		if (isUser !== null && textExists)
		{
			if (newPayload.context && newPayload.context.login_reqd && newPayload.context.login_reqd === "y")
			{
				let respPayload = Api.getResponsePayload();
				
				if (respPayload.context.login_reqd)
					respPayload.context.login_reqd = "n";
				
				let login_id_name = (newPayload.context.id_name ?  newPayload.context.id_name : "");
				document.getElementById('id01_title').innerHTML = 'Please login with your ' + login_id_name + ' ID';
				document.getElementById('id01').style.display='block';
			}
			
			// Create new message DOM element
			var messageDivs = buildMessageDomElements(newPayload, isUser);
			var chatBoxElement = document.querySelector(settings.selectors.chatBox);
			var previousLatest = chatBoxElement.querySelectorAll((isUser ? settings.selectors.fromUser
					: settings.selectors.fromWatson)
					+ settings.selectors.latest);
			// Previous "latest" message is no longer the most recent
			if (previousLatest)
			{
				Common.listForEach(previousLatest, function(element)
				{
					element.classList.remove('latest');
				});
			}

			messageDivs.forEach(function(currentDiv)
			{
				chatBoxElement.appendChild(currentDiv);
				// Class to start fade in animation
				currentDiv.classList.add('load');
			});
			// Move chat to the most recent messages when new messages are added
			scrollToChatBottom();
		}
	}

	// Checks if the given typeValue matches with the user "name", the Watson "name", or neither
	// Returns true if user, false if Watson, and null if neither
	// Used to keep track of whether a message was from the user or Watson
	function isUserMessage(typeValue)
	{
		if (typeValue === settings.authorTypes.user)
		{
			return true;
		}
		else
			if (typeValue === settings.authorTypes.watson)
			{
				return false;
			}
		return null;
	}

	// Constructs new DOM element from a message payload
	function buildMessageDomElements(newPayload, isUser)
	{
		var textArray = isUser ? newPayload.input.text : newPayload.output.text;
		if (Object.prototype.toString.call(textArray) !== '[object Array]')
		{
			textArray = [ textArray ];
		}

		var outMsg = '';

		if (newPayload.output !== undefined)
		{
			if (newPayload.output.generic !== undefined)
			{
				var options = null;

				var preference = 'text';

				for (var i = 0; i < newPayload.output.generic.length; i++)
				{
					if (newPayload.output.generic[i].options !== undefined)
					{
						options = newPayload.output.generic[i].options;
					}
				}
				if (options !== null)
				{
					if (preference === 'text')
					{
						outMsg += '<ul>';
						for (i = 0; i < options.length; i++)
						{
							if (options[i].value)
							{
								outMsg += '<li>' + options[i].label + '</li>';
							}
						}
						outMsg += '</ul>';
					}
				}
			}
		}

		textArray[textArray.length - 1] += outMsg;

		var messageArray = [];

		textArray.forEach(function(currentText)
		{
			if (currentText)
			{
				var messageJson = {
					// <div class='segments'>
					'tagName' : 'div',
					'classNames' : [ 'segments' ],
					'children' : [ {
						// <div class='from-user/from-watson latest'>
						'tagName' : 'div',
						'classNames' : [ (isUser ? 'from-user' : 'from-watson'), 'latest',
								((messageArray.length === 0) ? 'top' : 'sub') ],
						'children' : [ {
							// <div class='message-inner'>
							'tagName' : 'div',
							'classNames' : [ 'message-inner' ],
							'children' : [ {
								// <p>{messageText}</p>
								'tagName' : 'p',
								'text' : currentText
							} ]
						} ]
					} ]
				};
				messageArray.push(Common.buildDomElement(messageJson));
			}
		});

		return messageArray;
	}

	// Scroll to the bottom of the chat window (to the most recent messages)
	// Note: this method will bring the most recent user message into view,
	//   even if the most recent message is from Watson.
	//   This is done so that the "context" of the conversation is maintained in the view,
	//   even if the Watson message is long.
	function scrollToChatBottom()
	{
		var scrollingChat = document.querySelector('#scrollingChat');

		// Scroll to the latest message sent by the user
		var scrollEl = scrollingChat.querySelector(settings.selectors.fromUser + settings.selectors.latest);
		if (scrollEl)
		{
			scrollingChat.scrollTop = scrollEl.offsetTop;
		}
	}
	
	/*
	 * Surprise, surprise - we don't actually login anywhere.
	 */
	function login()
	{
		document.getElementById('id01').style.display='none';
		let textInput = document.getElementById('textInput');
		textInput.value = 'yes';	// TODO: FIX!!
		let login_event = {keyCode: 13};
		
		inputKeyDown(login_event, textInput);
		
		return false;
	}

	// Handles the submission of input
	function inputKeyDown(event, inputBox)
	{
		// Submit on enter key, disallowing blank messages
		if (event.keyCode === 13 && inputBox.value)
		{
			if (inputBox.value.trim())	// only non-blank
			{
				if (!isCommand(inputBox))
				{
					// Retrieve the context from the previous server response
					let context;
					let latestResponse = Api.getResponsePayload();
					
					if (latestResponse)
					{
						context = latestResponse.context;
						context['vehicle_service_status'] = currentVehicleServiceStatus;
					}
					else
					{
						context = {vehicle_service_status: currentVehicleServiceStatus};
					}
					
					// Send the user message
					Api.sendRequest(inputBox.value, context);
				}
			}

			// Clear input box for further messages
			inputBox.value = '';
			Common.fireEvent(inputBox, 'input');
		}
	}
		
	function isCommand(inputBox)
	{
		let rc = false;
		
//		window.open('http://localhost:3001/?vss=dropoff', '_blank');
		
		if (inputBox.value.trim().startsWith(cmdMap.prefix))
		{
			rc = true; 
			
			if (inputBox.value.trim() === cmdMap.prefix)
			{
				console.log("state: " + currentVehicleServiceStatus);
			}
			else
			{
				let ss = inputBox.value.trim().split(/[=\s]+/);
				let newVss = undefined;
				
				if (ss.length === 2)
				{
					newVss = cmdMap.states.find( state => state === ss[1] );
					
					if (newVss != undefined)
					{
						currentVehicleServiceStatus = newVss;
						console.log("new state: " + currentVehicleServiceStatus);
						
					}
					else
						console.log("state not changed: " + currentVehicleServiceStatus);
				}
			}
			return rc;
		}
			
	}
}());