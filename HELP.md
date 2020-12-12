## A module for controlling spotify via the Web API.   

### Setup

Go to [here](https://developer.spotify.com/dashboard/applications) and create an application.    
Copy the Client ID and Client Secret and add them to the config boxes.  
Set https://spotauth.github.io as your Redirect URL both in the Config and on the spotify application you created.  
When you save the modules config a URL will be placed on your clipboard, go to this URL and then copy the Approval Code into the config.  
This time when you save the config an Access Token and Refresh Token will be placed on your clip board, put those into their correct boxes.  
Now go assign the "Copy the ID of the current Active Device" button, start playing music on the device you wish to control and then press the button you just assigned.  
Now paste the Device ID that the button placed on your clipboard int he Device ID config box.  
The module is now fully configured and should work without issue.  

If you have an issues with the module please open an issue on the module's GitHub repo or message Peter Stather on the official Slack.

