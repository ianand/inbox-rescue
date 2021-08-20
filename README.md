## InboxRescue

InboxRescue is an iOS Shortcut that adds a "swipe to archive" feature to Gmail's mobile web interface, making it easy to archive mail as you browse your inbox.

[![Video demo of InboxRescue](https://user-images.githubusercontent.com/78809/129496801-3632d1ef-cf14-4be3-85a2-17f70c9363dd.png)](https://www.youtube.com/watch?v=TehvBxtup3I "InboxRescue Demo")


### How to use

1. Open the mobile web version of Gmail by visiting mail.google.com in Safari.
2. Activate InboxRescue by launching it from the Share Sheet in Safari.


### Setup

1. **Get a GMail API Key**: Until this app is approved by Google you'll need to manually create an API key. Follow Google's instructions for [creating a Google Cloud Project](https://developers.google.com/workspace/guides/create-project#create_a_new_google_cloud_platform_gcp_project) and enabling the Gmail API. Since this code runs as on Gmail mobile site, you'll need to create a web application OAuth 2.0 client ID with  "Authorized JavaScript origins" and "Authorized redirect URIs" set to https://mail.google.com.
2. **Create an new iOS Shortcut**: On your iOS device, launch the Shortcuts app and create a new Shortcut. The shortcut should accept webpages as input, have "Show in Share Sheet" turned on, and contain a single action of "Run JavaScript on Web Page".
3. **Copy the code**: Copy and paste the code from inboxRescue.js into the body of the "Run JavaScript on Web Page" action in your shortcut.
4. **Update the API Key**: Replace the `CLIENT_ID` variable in the shortcut body with the API key you created in Step 1.

Your InboxRescue shortcut is now ready.


