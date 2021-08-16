/*

Inbox Rescue

InboxRescue is an iOS Shortcut that adds a "swipe to archive" feature to Gmail's mobile web interface, making it easy to archive mail as you browse your inbox. Visit https://github.com/ianand/inbox-rescue for more information.
 
MIT License

Copyright (C) 2021 Ishan Anand

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/


//
// Until this app is approved by Google, you'll need to manually create a Gmail 
// API key and set it here.
//
var CLIENT_ID = '';

//
// iOS Shortcut Javascript is isolated from the runtime JavaScript on the page
// which breaks the auth flow. To work around this, the core Inbox Rescue 
// source code in injected as script tag rather than executed directly. This 
// executes Inbox Rescue in the runtime JS of the page itself.
//
var inboxRescueCoreSource=`
(function() {
		
	console.log("InboxRescue: starting...");
    
  /* Notification UI */
  var NotificationUI = {
    installed: false,
    element: null,
    channels: {},
    install: function() {
      this.element = document.createElement("div");
      this.element.setAttribute("style", "display:none; opacity: 0.9;background-color: red;position: fixed;z-index:1000;top:0px;left:0px;padding: 3px 5px;color: white;");
      this.element.setAttribute("id", "inboxRescueNotification");
      document.body.appendChild(this.element);
      this.installed = true;
    },
    getMessageForAllChannels: function() {
      var keys = getObjectKeys(this.channels);
      var accumlator = "";
      for(var i =0; i<keys.length;i++) {
        var msg = this.channels[keys[i]].message;
        if(msg) {
          msg += " (" + this.channels[keys[i]].count + ")";
          accumlator += msg;
          if(i < keys.length - 1 ) {
            accumlator += " / ";
          } 
        }
      }
      return accumlator;
    },
    updateDisplayedMessage: function() {
      // Update the total displayed message for all channels
      var msg = this.getMessageForAllChannels();
      this.element.innerHTML = msg;
      console.log("InboxRescue Notification: " + msg);
      if(msg && this.element.style.display != "block") {
        this.element.style.display = "block";
      } else if (!msg && this.element.style.display != "none") {
        this.element.style.display = "none";
      }      
    },
    show: function(channelName,txt) {
      
      // Update the message for this channel
      var channel = this.channels[channelName];
      if(!channel) {
        channel = {count:0, message:""};
        this.channels[channelName] = channel;
      }
      
      channel.message = txt;
      channel.count += 1;

      this.updateDisplayedMessage();
    },
    hide: function(channelName) {
      var channel = this.channels[channelName];
      if(!channel) {
        return;
      }
      
      channel.count += -1;
      if(channel.count <= 0) {
        channel.message = "";
      }
      
      this.updateDisplayedMessage();
    }
  };

  
  var getObjectKeys = function(obj){
     var keys = [];
     for(var key in obj){
        keys.push(key);
     }
     return keys;
  }

  /* Extract threadId from URL. 
     Returns false if no id is found. */
  function threadIdFromUrl(URL) {
    /* Example URL: https://mail.google.com/mail/mu/mp/466/#cv/priority/%5Esmartlabel_personal/14b9a37b8f5a5537*/ 
    var matches = URL.match(/\\/([0-9A-Fa-f]+)$/); 
    if(matches && matches.length == 2) {
      return matches[1];
    }
    return false;
  }


  function archiveThread(threadId) {
		// Archive a threadID
    NotificationUI.show("archive", "Archiving");
		gapi.client.gmail.users.threads.modify( {
			'userId': "me", 
			'id': threadId,
			'resource': {
				"removeLabelIds": ["INBOX"]
			}
		}).execute(res => {
		      console.log(res);
					var status = false;
					if(res.id) {
						status = true;
					}
					archiveThreadCallback({success: status});

		    });
  }
	
  function archiveThreadCallback(obj){
    if(!obj || !(obj.success) ) {
      alert("An error occurred!")
    }
    NotificationUI.hide("archive","");
  }
	
	function installGoogleApi() {
		var initGoogleApi = function() {
			console.log("InboxRescue: loading gapi")
			window.gapi.load('client:auth2', function() { 
		    var SCOPES = 'https://www.googleapis.com/auth/gmail.modify';
		    var CLIENT_ID = '${CLIENT_ID}';
		    var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"];
		    if(CLIENT_ID == "") {
					alert("No CLIENT_ID was set. Please create an API key with Google and copy it into the source code of your shortcut.")
				}
				
		      window.gapi.client.init({
		        'clientId': CLIENT_ID,
		        'scope': SCOPES,
		        'discoveryDocs': DISCOVERY_DOCS,
		      }).then(function() { 
						console.log("InboxRescue: gapi client initialized");
						// Prompt to authorize
						if(!gapi.auth2.getAuthInstance().isSignedIn.get()) {
							gapi.auth2.getAuthInstance().signIn();
						} else {
							 console.log("InboxRescue: user signed in");
						}
					})
			})
		}
		
		var waitForGoogleApi = function () {
			if(window.gapi) {
				initGoogleApi();
			} else {
				console.log("InboxRescue: ...waiting for gapi...");
				setTimeout(function() {waitForGoogleApi()}, 500);
			}
		}

		var x = document.createElement("script");
		x.src= "https://apis.google.com/js/api.js";
		x.addEventListener("load", function() {waitForGoogleApi()})
		document.body.appendChild(x);
	}
	installGoogleApi();
	
	
	
  /* Swipe To Archive Checkbox */
  var checkbox = false;
  var isCheckboxInstalled = false;

	/* Run by the polling function to install Swipe To Archive.
		Install process is done in stages, so this function is repeatedly called
	  by the polling function and returns true once setup is complete. 
	*/
	// TODO: Remove this ugly hack that requires setup in stages	
	function installSwipeToArchive() {
		
		/* Don't do anything until gapi is initialized */
		if(!(window.gapi && window.gapi.client)) {
			return false;
		}
		
		
    /* Setup the Swipe-to-Archive Checkbox if not installed */
    if(!isCheckboxInstalled) {
      var zc = document.getElementsByClassName("rm");
      if(!zc || !zc[1]) {
        return;
      }
      zc[1].innerHTML = 

        "<div " + 
            "style='height: 44px;float:left;color:black;font-size: 12px;padding-left:8px;-webkit-tap-highlight-color: rgba(0,0,0,0); -webkit-tap-highlight-color: transparent;'" +
              /* Make the label tappable so checkbox isn't hard to hit */
             "onclick='if(event.target != this) {return;};this.children[0].checked=!this.children[0].checked;'"+ 
         ">" +
          "<input "+
              "style='position: relative;top:2px;'" + 
              "type='checkbox' " +
              "id='inboxRescueSwipeToArchiveCheckbox'"+
              "checked='true'" +
            "/>" +
          "Archive"+
        "</div>";
      isCheckboxInstalled = true;
      return false;
    }
		
    /* Save handle to the Swipe-to-Archive Checkbox */
    if(!checkbox) {
      checkbox = document.getElementById("inboxRescueSwipeToArchiveCheckbox");
      if(!checkbox) {
        /* Delay in DOM insertion. Try again on next interval. */
        return false;
      }
    }
		
		return true;
	}
	
	
  /* State used by swipe-to-archive polling function */
  var lastURL = window.location.href;
  var lastBox = false;
  
  /* swipe-to-archive polling function */
  setInterval(function() {
		
		/* Install swipe to archive */
		if(!installSwipeToArchive()) {
			return;
		}
		
    /* Install the NotificationUI */
    if(!NotificationUI.installed) {
      NotificationUI.install();
    }


    /* Check if a swipe has occurred by detecting a thread-to-thread URL change. */
    var currentURL = window.location.href;
    var currentBox = checkbox.checked;

    /* If location change and both current and previous screens were threads */
    if( (currentURL != lastURL) && 
      threadIdFromUrl(lastURL) && 
      threadIdFromUrl(currentURL)) {  
        
      /* If archive box was checked during swipe, then archive the message */
      if(lastBox) {
        console.log("InboxRescue: Archiving message " + threadIdFromUrl(lastURL));
        archiveThread(threadIdFromUrl(lastURL));
      }
    }
  
    lastURL = currentURL;
    lastBox = currentBox;
  }, 250);
  

  console.log("InboxRescue: ...waiting for initialization to complete");
})();`


// Inject the core code of Inbox Rescue into the DOM 
var nonce = document.getElementsByTagName("script")[0].getAttribute("nonce");
console.log("nonce " + nonce);
var s = document.createElement('script');
s.type = 'text/javascript';
s.setAttribute("nonce", nonce);
s.appendChild(document.createTextNode(inboxRescueCoreSource));
document.body.appendChild(s);

// Required for iOS Shortcuts to signal completion
completion([]);