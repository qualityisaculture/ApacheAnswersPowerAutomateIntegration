# Deployment Guide

This directory contains all files needed to deploy the Apache Answers - Microsoft Teams Integration as a systemd service on Ubuntu.

## Files in This Directory

### Service Configuration
- **`apache-answers-bot.service`** - systemd service unit file
- **`apache-answers-bot.logrotate`** - Log rotation configuration

### Installation Scripts
- **`install-systemd.sh`** - Automated installation script
- **`uninstall-systemd.sh`** - Automated uninstallation script

### Documentation
- **`NODEJS_INSTALLATION.md`** - Node.js installation guide for production (important!)
- **`SYSTEMD_DEPLOYMENT.md`** - Complete deployment guide with troubleshooting
- **`SYSTEMD_QUICKREF.md`** - Quick reference for common commands
- **`LOGGING_SETUP.md`** - Detailed logging configuration documentation

## Quick Start

> **Note**: The installation scripts automatically detect the application directory based on their location, so you can deploy the application to any directory without modifying configuration files.

### Prerequisites
- Ubuntu 18.04 or newer
- **Node.js v16 or higher (system-wide installation required)**
  - ⚠️ **Important**: If you have Node.js via nvm, see [NODEJS_INSTALLATION.md](./NODEJS_INSTALLATION.md)
  - systemd services require Node.js at `/usr/bin/node` or `/usr/local/bin/node`
- Root or sudo access
- Application can be deployed to any directory (e.g., `/opt/ApacheAnswersPowerAutomateIntegration`)

### Installation

1. **Prepare the application**:
   ```bash
   cd /opt/ApacheAnswersPowerAutomateIntegration
   cp env.example .env
   nano .env  # Configure your environment variables
   ```

2. **Run the installer**:
   ```bash
   cd /opt/ApacheAnswersPowerAutomateIntegration/deployment
   sudo ./install-systemd.sh
   ```

3. **Verify installation**:
   ```bash
   sudo systemctl status apache-answers-bot
   sudo journalctl -u apache-answers-bot -f
   ```

## What Gets Installed

- **Service User**: `apache-answers-bot` (system user, no login)
- **Service Name**: `apache-answers-bot`
- **Service File**: `/etc/systemd/system/apache-answers-bot.service`
- **Log Directory**: `/var/log/apache-answers-bot/` (FHS compliant)
- **Log Symlink**: `/opt/ApacheAnswersPowerAutomateIntegration/logs/` → `/var/log/apache-answers-bot/`
- **Logrotate Config**: `/etc/logrotate.d/apache-answers-bot`

## Common Commands

```bash
# Service control
sudo systemctl start apache-answers-bot
sudo systemctl stop apache-answers-bot
sudo systemctl restart apache-answers-bot
sudo systemctl status apache-answers-bot

# View logs
sudo journalctl -u apache-answers-bot -f
sudo tail -f /var/log/apache-answers-bot/combined.log

# Check health
curl http://localhost:3000/health
```

## Uninstallation

```bash
cd /opt/ApacheAnswersPowerAutomateIntegration/deployment
sudo ./uninstall-systemd.sh
```

## Documentation

For detailed information, see:
- **[NODEJS_INSTALLATION.md](./NODEJS_INSTALLATION.md)** - Node.js installation (read this first!)
- **[SYSTEMD_DEPLOYMENT.md](./SYSTEMD_DEPLOYMENT.md)** - Full deployment guide
- **[SYSTEMD_QUICKREF.md](./SYSTEMD_QUICKREF.md)** - Command reference
- **[LOGGING_SETUP.md](./LOGGING_SETUP.md)** - Logging details

## File Locations

```
/opt/ApacheAnswersPowerAutomateIntegration/
├── deployment/                        <- This directory
│   ├── apache-answers-bot.service
│   ├── apache-answers-bot.logrotate
│   ├── install-systemd.sh
│   ├── uninstall-systemd.sh
│   ├── NODEJS_INSTALLATION.md
│   ├── SYSTEMD_DEPLOYMENT.md
│   ├── SYSTEMD_QUICKREF.md
│   ├── LOGGING_SETUP.md
│   └── README.md                      <- You are here
├── src/                               <- Application source code
├── dist/                              <- Compiled application
├── logs/                              <- Symlink to /var/log/apache-answers-bot/
└── .env                               <- Environment configuration

/etc/systemd/system/
└── apache-answers-bot.service         <- Installed service file

/etc/logrotate.d/
└── apache-answers-bot                 <- Installed logrotate config

/var/log/apache-answers-bot/           <- Actual log files (FHS standard)
├── combined.log
├── error.log
└── (rotated logs)
```

## Support

For issues or questions:
1. Check the troubleshooting section in `SYSTEMD_DEPLOYMENT.md`
2. Review logs: `sudo journalctl -u apache-answers-bot -n 100`
3. Check service status: `sudo systemctl status apache-answers-bot -l`