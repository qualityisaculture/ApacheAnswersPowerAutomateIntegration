# Power Automate Setup for Teams Message Callbacks

This document explains how to set up a Power Automate flow that will send HTTP callbacks to your application after a message is posted to Teams.

## Overview

The flow will:

1. Trigger when a message is posted to a Teams channel
2. Extract the message details (ID, conversation ID, link, and body)
3. Send an HTTP GET request to your application's callback endpoint
4. Your application will automatically post a comment to the original Apache Answers post with the Teams message link and IDs

## Prerequisites

- Access to Power Automate (Microsoft 365 license)
- Your application running and accessible via HTTP
- The callback endpoint URL (default: `http://localhost:3000/callback/power-automate`)

## Step-by-Step Setup

### 1. Create a New Flow

1. Go to [Power Automate](https://flow.microsoft.com)
2. Click **"Create"** → **"Automated cloud flow"**
3. Name your flow: `Teams Message Callback`
4. Choose **"When a message is posted (V3)"** as the trigger
5. Click **"Create"**

### 2. Configure the Trigger

1. In the trigger step, select your Teams team and channel
2. You can leave the other settings as default
3. Click **"Show advanced options"** if you want to filter by specific conditions

### 3. Add Compose Action to Extract Post ID

1. Click **"+ New step"**
2. Search for **"Compose"** and select **"Compose"** action
3. Configure the Compose action:
   - **Inputs**: `@{last(split(triggerBody()?['body']?['content'], ' '))}`
   - **Name**: `ExtractPostId`

This extracts the Post ID from the last word in the message body (the Post ID appears as the last text block).

### 4. Add HTTP Request Action

1. Click **"+ New step"**
2. Search for **"HTTP"** and select **"HTTP"** action
3. Configure the HTTP action:
   - **Method**: `GET`
   - **URI**: `http://your-server:3000/callback/power-automate`
     - Replace `your-server` with your actual server address
     - If running locally, use `http://localhost:3000/callback/power-automate`
   - **Query Parameters**: Add the following parameters:
     - `messageId`: `@{triggerBody()?['id']}`
     - `conversationId`: `@{triggerBody()?['conversationId']}`
     - `messageLink`: `@{triggerBody()?['link']}`
     - `body`: `@{triggerBody()?['body']?['content']}`
     - `postId`: `@{outputs('ExtractPostId')}`
     - `timestamp`: `@{utcNow()}`

### 5. Add Error Handling (Optional but Recommended)

1. Add a **"Configure run after"** step after the HTTP action
2. Set it to run after the HTTP action fails
3. Add a **"Send an email"** or **"Post a message in a chat or channel"** action to notify you of failures

### 5. Test the Flow

1. Click **"Save"** to save your flow
2. Click **"Test"** to test the flow
3. Post a message in the configured Teams channel
4. Check your application logs to see if the callback was received

## Expected Callback Data Structure

Your application will receive query parameters with the following structure:

```
GET /callback/power-automate?messageId=1234567890123456789&conversationId=19:conversation-id@thread.skype&messageLink=https://teams.microsoft.com/l/message/...&body=The%20actual%20message%20content&postId=abc123&timestamp=2024-01-15T10:30:00.000Z
```

The parameters will be:

- `messageId`: The Teams message ID
- `conversationId`: The Teams conversation ID
- `messageLink`: The direct link to the Teams message
- `body`: The message content (URL encoded)
- `postId`: The Apache Answers Post ID (extracted from the message body)
- `timestamp`: When the callback was sent

## Automatic Comment Posting

When your application receives a callback, it will:

1. **Extract the Apache Answers Post ID** from the message body (included in the Teams message)
2. **Post a comment** to the original Apache Answers post with:
   - **First line**: The Teams message link
   - **Second line**: `Message Id: {messageId}`
   - **Third line**: `Conversation Id: {conversationId}`

Example comment that will be posted:

```
https://teams.microsoft.com/l/message/...
Message Id: 1234567890123456789
Conversation Id: 19:conversation-id@thread.skype
```

## Environment Variables

Add the following to your `.env` file to configure the callback service:

```env
# Callback service configuration
CALLBACK_PORT=3000
```

## Testing the Setup

### 1. Start Your Application

```bash
npm run dev
```

You should see logs indicating:

- HTTP server started on port 3000
- Callback endpoint available at the specified URL
- Health check endpoint available

### 2. Test the Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "Apache Answers Teams Integration"
}
```

### 3. Test the Callback Endpoint

```bash
curl "http://localhost:3000/callback/power-automate?messageId=test-123&conversationId=test-conversation&messageLink=https://teams.microsoft.com/test&body=Test%20message&postId=abc123&timestamp=2024-01-15T10:30:00.000Z"
```

Expected response:

```json
{
  "success": true,
  "message": "Callback received and logged successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Troubleshooting

### Common Issues

1. **Connection Refused**: Make sure your application is running and accessible
2. **404 Not Found**: Check that the callback endpoint URL is correct
3. **Power Automate Flow Not Triggering**: Verify the Teams channel configuration
4. **JSON Parsing Errors**: Check the JSON structure in the HTTP request body

### Logs to Check

Your application will log:

- Incoming HTTP requests
- Callback data received
- Any errors during processing

Look for these log entries:

- `📥 Incoming POST request to /callback/power-automate`
- `🔄 Received Power Automate callback:`
- `📨 Message ID: ...`
- `💬 Conversation ID: ...`
- `🔗 Message Link: ...`
- `📝 Message Body: ...`

## Security Considerations

- Consider adding authentication to your callback endpoint
- Use HTTPS in production
- Validate the incoming data structure
- Consider rate limiting to prevent abuse

## Next Steps

Once the basic callback logging is working, you can extend the functionality to:

- Store callback data in a database
- Add the message link as a comment to Apache Answers posts
- Implement more sophisticated message processing
- Add webhook signature verification for security
