# systemd Quick Reference

## Installation

```bash
# Copy files to /opt/ApacheAnswersPowerAutomateIntegration
# Configure .env file
# Run installer
sudo ./install-systemd.sh
```

## Service Control

```bash
# Start
sudo systemctl start apache-answers-bot

# Stop
sudo systemctl stop apache-answers-bot

# Restart
sudo systemctl restart apache-answers-bot

# Status
sudo systemctl status apache-answers-bot

# Enable on boot
sudo systemctl enable apache-answers-bot

# Disable on boot
sudo systemctl disable apache-answers-bot
```

## Viewing Logs

```bash
# Real-time systemd logs
sudo journalctl -u apache-answers-bot -f

# Last 100 lines
sudo journalctl -u apache-answers-bot -n 100

# Today's logs
sudo journalctl -u apache-answers-bot --since today

# Logs between dates
sudo journalctl -u apache-answers-bot --since "2024-01-01" --until "2024-01-02"

# Error logs only
sudo journalctl -u apache-answers-bot -p err

# Application logs (Winston) - stored in /var/log but accessible via symlink
sudo tail -f /var/log/apache-answers-bot/combined.log
sudo tail -f /var/log/apache-answers-bot/error.log

# Or via symlink
sudo tail -f /opt/ApacheAnswersPowerAutomateIntegration/logs/combined.log
sudo tail -f /opt/ApacheAnswersPowerAutomateIntegration/logs/error.log

# List rotated logs
ls -lh /var/log/apache-answers-bot/
```

## Health Checks

```bash
# Is service running?
systemctl is-active apache-answers-bot

# Is service enabled?
systemctl is-enabled apache-answers-bot

# Port check
sudo ss -tlnp | grep 3000

# HTTP health check
curl http://localhost:3000/health
```

## Troubleshooting

```bash
# Check status with full details
sudo systemctl status apache-answers-bot -l --no-pager

# View recent errors
sudo journalctl -u apache-answers-bot -p err -n 50

# Test manual run as service user
sudo -u apache-answers-bot /usr/bin/node /opt/ApacheAnswersPowerAutomateIntegration/dist/index.js

# Check file permissions
sudo ls -la /opt/ApacheAnswersPowerAutomateIntegration

# Verify .env file
sudo ls -la /opt/ApacheAnswersPowerAutomateIntegration/.env

# Check port conflicts
sudo netstat -tlnp | grep 3000
```

## Configuration Changes

```bash
# After editing service file
sudo systemctl daemon-reload
sudo systemctl restart apache-answers-bot

# After editing .env
sudo systemctl restart apache-answers-bot

# View current environment
sudo systemctl show apache-answers-bot --property=Environment
```

## Log Management

```bash
# Force log rotation
sudo logrotate -f /etc/logrotate.d/apache-answers-bot

# Test logrotate config
sudo logrotate -d /etc/logrotate.d/apache-answers-bot

# Clean old journal logs
sudo journalctl --vacuum-time=7d
sudo journalctl --vacuum-size=500M

# Check journal disk usage
journalctl --disk-usage
```

## Updates

```bash
cd /opt/ApacheAnswersPowerAutomateIntegration

# Pull changes (if using git)
sudo -u apache-answers-bot git pull

# Install dependencies
sudo -u apache-answers-bot npm ci --only=production

# Rebuild
sudo -u apache-answers-bot npm run build

# Restart service
sudo systemctl restart apache-answers-bot

# Check status
sudo systemctl status apache-answers-bot
sudo journalctl -u apache-answers-bot -n 20
```

## Monitoring

```bash
# Resource usage
systemd-cgtop

# Service details
systemctl show apache-answers-bot

# Security analysis
systemd-analyze security apache-answers-bot

# Service startup time
systemd-analyze blame
```

## File Locations

```
Application:     /opt/ApacheAnswersPowerAutomateIntegration
Service File:    /etc/systemd/system/apache-answers-bot.service
Logrotate:       /etc/logrotate.d/apache-answers-bot
App Logs:        /var/log/apache-answers-bot/ (FHS standard location)
                 /opt/ApacheAnswersPowerAutomateIntegration/logs/ (symlink)
System Logs:     journalctl -u apache-answers-bot
Environment:     /opt/ApacheAnswersPowerAutomateIntegration/.env
```

## Emergency Commands

```bash
# Force stop
sudo systemctl kill apache-answers-bot

# Disable and stop
sudo systemctl disable --now apache-answers-bot

# Reset failed state
sudo systemctl reset-failed apache-answers-bot

# Check what's preventing startup
sudo journalctl -xe
```

## Common Issues

**Service won't start:**
```bash
sudo journalctl -u apache-answers-bot -n 50 --no-pager
sudo systemctl status apache-answers-bot -l
```

**Port in use:**
```bash
sudo ss -tlnp | grep 3000
sudo kill <PID>
```

**Permission denied:**
```bash
sudo chown -R apache-answers-bot:apache-answers-bot /opt/ApacheAnswersPowerAutomateIntegration
sudo chmod 600 /opt/ApacheAnswersPowerAutomateIntegration/.env
```

**Module not found:**
```bash
cd /opt/ApacheAnswersPowerAutomateIntegration
sudo -u apache-answers-bot npm ci --only=production
```