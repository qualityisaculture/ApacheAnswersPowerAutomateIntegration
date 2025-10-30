# Apache Answers - Microsoft Teams Power Automate Integration

A bidirectional integration tool that synchronizes posts between Apache Answers and Microsoft Teams channels using Power Automate.

## Overview

This tool enables seamless communication between Apache Answers and Microsoft Teams by:

- **Answers → Teams**: When someone creates a post in Apache Answers, it automatically posts to a designated Teams channel
- **Teams → Answers**: When someone posts in the Teams channel, it creates a corresponding post in Apache Answers

## Features

- Bidirectional synchronization between Apache Answers and Microsoft Teams
- Real-time post notifications
- Automated content formatting
- Error handling and logging
- Configurable channel and forum mappings

## Prerequisites

- Apache Answers instance with API access
- Microsoft Teams with Power Automate access
- Azure AD app registration for authentication
- Power Automate premium license (for custom connectors)

## Next Steps

1. Set up authentication and API access
2. Create Power Automate flows for bidirectional sync
3. Implement webhook endpoints for real-time updates
4. Configure channel and forum mappings
5. Test integration with sample posts
6. Deploy and monitor the integration

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Apache Answers instance with API access
- (Optional) API key for authentication

### Installation

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd apache-answers-bot
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Configure environment variables**:

   ```bash
   cp env.example .env
   ```

   Edit the `.env` file with your configuration:

   ```env
   # Apache Answers Configuration
   ANSWERS_BASE_URL=https://your-answers-instance.com
   ANSWERS_ACCESS_TOKEN=your_access_token_here
   ANSWERS_EMAIL=your_email@example.com
   ANSWERS_PASSWORD=your_password

   # Monitoring Configuration
   CHECK_INTERVAL_MS=30000
   LOG_LEVEL=info

   # Teams Configuration
   TEAMS_DEFAULT_WEBHOOK_URL=your_default_teams_webhook_url
   TEAMS_CHANNELS=[{"tags":["javascript","typescript"],"webhookUrl":"your_js_teams_webhook","channelName":"JavaScript"},{"tags":["python","django"],"webhookUrl":"your_python_teams_webhook","channelName":"Python"}]
   ```

### Getting Your Access Token

Apache Answers uses **access tokens** instead of API keys. To get your access token:

1. **Set up your credentials** in the `.env` file:

   ```env
   ANSWERS_BASE_URL=https://your-answers-instance.com
   ANSWERS_EMAIL=your_email@example.com
   ANSWERS_PASSWORD=your_password
   ```

2. **Get your access token**:

   ```bash
   npm run get-token
   ```

3. **Copy the token** to your `.env` file:
   ```env
   ANSWERS_ACCESS_TOKEN=your_access_token_here
   ```

**Alternative method** (manual):

1. Go to your Apache Answers instance
2. Open the Swagger UI: `https://your-instance.com/swagger/index.html`
3. Use the `/answer/api/v1/user/login/email` endpoint
4. Provide your email and password
5. Copy the `access_token` from the response

### Running the Application

**Development mode** (with auto-reload):

```bash
npm run dev
```

**Production mode**:

```bash
npm run build
npm start
```

**Watch mode** (for development):

```bash
npm run watch
```

### What It Does

The integration will:

- **Monitor Apache Answers**: Check for new posts every 30 seconds (configurable)
- **Route to Teams**: Automatically send new posts to appropriate Teams channels based on tags
- **Rich Messages**: Create beautiful Adaptive Cards in Teams with:
  - Post title and description
  - Author information
  - Creation timestamp
  - Tags and metadata
  - Direct link to the Apache Answers post

### Configuration Options

| Environment Variable        | Description                                                          | Default                   |
| --------------------------- | -------------------------------------------------------------------- | ------------------------- |
| `ANSWERS_BASE_URL`          | Your Apache Answers instance URL                                     | `https://meta.answer.dev` |
| `ANSWERS_ACCESS_TOKEN`      | Access token for authentication (get with `npm run get-token`)       | -                         |
| `ANSWERS_EMAIL`             | Email for authentication (required to get token)                     | -                         |
| `ANSWERS_PASSWORD`          | Password for authentication (required to get token)                  | -                         |
| `CHECK_INTERVAL_MS`         | How often to check for new posts (milliseconds)                      | `30000`                   |
| `LOG_LEVEL`                 | Logging level (debug, info, warn, error)                             | `info`                    |
| `TEAMS_DEFAULT_WEBHOOK_URL` | Default Teams webhook URL (fallback for posts without matching tags) | -                         |
| `TEAMS_CHANNELS`            | JSON array of channel mappings with tags and webhook URLs            | `[]`                      |

### Teams Integration

The integration supports automatic posting to Microsoft Teams channels based on post tags:

#### **Default Channel**

Set `TEAMS_DEFAULT_WEBHOOK_URL` to post all new questions to a default Teams channel.

#### **Tag-Based Channels**

Use `TEAMS_CHANNELS` to route posts to specific channels based on their tags:

```json
[
  {
    "tags": ["javascript", "typescript"],
    "webhookUrl": "https://your-js-teams-webhook-url",
    "channelName": "JavaScript"
  },
  {
    "tags": ["python", "django"],
    "webhookUrl": "https://your-python-teams-webhook-url",
    "channelName": "Python"
  },
  {
    "tags": ["general", "help"],
    "webhookUrl": "https://your-general-teams-webhook-url",
    "channelName": "General"
  }
]
```

#### **How It Works**

1. **New post detected** in Apache Answers
2. **Tags analyzed** to find matching channels
3. **Posts sent** to all matching Teams channels
4. **Fallback** to default channel if no matches found
5. **Rich cards** displayed in Teams with post details

### Logs

The application creates log files in the `logs/` directory:

- `combined.log` - All log messages
- `error.log` - Error messages only

Console output includes colored, formatted logs for easy monitoring.

## Production Deployment

For production deployment on Ubuntu as a systemd service, see the **[deployment directory](./deployment/README.md)**.

### Quick Deployment

```bash
# On your Ubuntu server
cd /opt/apache-answers-bot/deployment
sudo ./install-systemd.sh
```

This will:
- Create a dedicated `apache-answers-bot` system user
- Install the service as `apache-answers-bot`
- Set up FHS-compliant logging in `/var/log/apache-answers-bot/`
- Configure automatic log rotation
- Enable the service to start on boot

For detailed instructions, troubleshooting, and configuration options, see:
- **[Deployment Guide](./deployment/SYSTEMD_DEPLOYMENT.md)** - Complete installation guide
- **[Quick Reference](./deployment/SYSTEMD_QUICKREF.md)** - Common commands
- **[Logging Setup](./deployment/LOGGING_SETUP.md)** - Log configuration details

## Contributing

This project is in early development. Please check back for contribution guidelines.

## License

_License information to be added._
