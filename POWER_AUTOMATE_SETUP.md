# Power Automate Setup for Teams Emoji Reaction Callbacks

This document explains how to set up a Power Automate flow that will send HTTP callbacks to your application when an emoji reaction is added to a message in Teams.

## Overview

The flow will:

1. Trigger when an emoji reaction is added to a message in a Teams channel
2. Extract the message details (ID, conversation ID, link, and body) along with reaction information
3. Send an HTTP GET request to your application's callback endpoint
4. Your application will automatically post the message as a question to Apache Answers and respond with a link

## Prerequisites

- Access to Power Automate (Microsoft 365 license)
- Your application running and accessible via HTTP
- The callback endpoint URL (default: `http://localhost:3000/callback/emoji`)

## Step-by-Step Setup

### 1. Create a New Flow

1. Go to [Power Automate](https://flow.microsoft.com)
2. Click **"Create"** → **"Automated cloud flow"**
3. Name your flow: `Teams Emoji Reaction Callback`
4. Choose **"When someone reacted to a message in chat"** as the trigger
5. Click **"Create"**

### 2. Configure the Trigger

1. In the trigger step, select your Teams team and channel
2. Set **Message type** to **Channel** (to monitor channel messages)
3. You can leave the other settings as default
4. Click **"Show advanced options"** if you want to filter by specific conditions

### 3. Add Compose Action to Extract Message Content

1. Click **"+ New step"**
2. Search for **"Compose"** and select **"Compose"** action
3. Configure the Compose action:
   - **Inputs**: `@{triggerBody()?['message']?['body']?['content']}`
   - **Name**: `ExtractMessageContent`

This extracts the message content that was reacted to.

### 4. Add HTTP Request Action

1. Click **"+ New step"**
2. Search for **"HTTP"** and select **"HTTP"** action
3. Configure the HTTP action:
   - **Method**: `GET`
   - **URI**: `http://your-server:3000/callback/emoji`
     - Replace `your-server` with your actual server address
     - If running locally, use `http://localhost:3000/callback/emoji`
   - **Query Parameters**: Add the following parameters:
     - `item`: `@{outputs('ExtractMessageContent')}`
     - `teamId`: `@{triggerBody()?['teamId']}`
     - `channelId`: `@{triggerBody()?['channelId']}`
     - `messageId`: `@{triggerBody()?['message']?['id']}`
     - `messageLink`: `@{triggerBody()?['message']?['link']}`
     - `tag`: `from_teams` (or your preferred tag)
     - `reactionType`: `@{triggerBody()?['reactionType']}`
     - `reactionCount`: `@{triggerBody()?['reactionCount']}`
     - `timestamp`: `@{utcNow()}`

### 5. Add Error Handling (Optional but Recommended)

1. Add a **"Configure run after"** step after the HTTP action
2. Set it to run after the HTTP action fails
3. Add a **"Send an email"** or **"Post a message in a chat or channel"** action to notify you of failures

### 5. Test the Flow

1. Click **"Save"** to save your flow
2. Click **"Test"** to test the flow
3. Add an emoji reaction to a message in the configured Teams channel
4. Check your application logs to see if the callback was received

## Expected Callback Data Structure

Your application will receive query parameters with the following structure:

```
GET /callback/emoji?item=The%20actual%20message%20content&teamId=team-id&channelId=channel-id&messageId=1234567890123456789&messageLink=https://teams.microsoft.com/l/message/...&tag=from_teams&reactionType=👍&reactionCount=1&timestamp=2024-01-15T10:30:00.000Z
```

The parameters will be:

- `item`: The message content that was reacted to (URL encoded)
- `teamId`: The Teams team ID
- `channelId`: The Teams channel ID
- `messageId`: The Teams message ID
- `messageLink`: The direct link to the Teams message
- `tag`: The tag to apply to the question (e.g., "from_teams")
- `reactionType`: The emoji that was used for the reaction
- `reactionCount`: The number of reactions of this type
- `timestamp`: When the callback was sent

## Automatic Question Creation

When your application receives a callback, it will:

1. **Extract the message content** from the Teams message that was reacted to
2. **Create a new question** in Apache Answers with:
   - **Title**: First line of the message (truncated to 50 characters)
   - **Content**: Full message content
   - **Tags**: Including the specified tag (e.g., "from_teams")
3. **Add comments** to the question with:
   - **Teams Message ID**: For tracking
   - **Emoji reaction info**: Which emoji triggered the creation
4. **Reply to Teams** with a link to the created question

Example comments that will be posted:

```
Teams Message ID: 1234567890123456789
Triggered by emoji reaction: 👍 (1 reactions)
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
curl "http://localhost:3000/callback/emoji?item=Test%20message&teamId=test-team&channelId=test-channel&messageId=test-123&messageLink=https://teams.microsoft.com/test&tag=from_teams&reactionType=👍&reactionCount=1&timestamp=2024-01-15T10:30:00.000Z"
```

Expected response:

```json
{
  "success": true,
  "message": "Teams message posted as question successfully",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "questionId": "12345"
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

- `📥 Incoming GET request to /callback/emoji`
- `😀 Received Teams emoji reaction callback:`
- `📨 Message ID: ...`
- `👥 Team ID: ...`
- `💬 Channel ID: ...`
- `🔗 Message Link: ...`
- `😀 Reaction Type: ...`
- `🔢 Reaction Count: ...`

## Security Considerations

- Consider adding authentication to your callback endpoint
- Use HTTPS in production
- Validate the incoming data structure
- Consider rate limiting to prevent abuse

## Next Steps

Once the emoji reaction callback is working, you can extend the functionality to:

- Filter reactions by specific emojis (e.g., only react to 👍 or ❓)
- Add more sophisticated message processing
- Implement reaction-based tagging (different emojis = different tags)
- Add webhook signature verification for security
- Store reaction analytics in a database
