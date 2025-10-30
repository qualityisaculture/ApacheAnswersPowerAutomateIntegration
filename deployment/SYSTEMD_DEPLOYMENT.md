# systemd Deployment Guide for Ubuntu

This guide explains how to deploy the Apache Answers - Microsoft Teams Integration as a systemd service on Ubuntu with log rotation.

## Log Directory Structure

This deployment uses the **Filesystem Hierarchy Standard (FHS)** for log storage with a symlink approach:

```
/var/log/apache-answers-bot/     <- Actual log files (FHS standard)
    ├── combined.log
    ├── error.log
    └── (rotated logs)

/opt/apache-answers-bot/logs/  <- Symlink to /var/log/apache-answers-bot
```

**Why this approach?**
- ✅ **FHS Compliant**: Logs are stored in `/var/log/` (standard location)
- ✅ **No Code Changes**: Application code remains unchanged
- ✅ **Tool Compatibility**: Log aggregation tools expect logs in `/var/log/`
- ✅ **Transparent**: Application writes to `logs/` but files end up in `/var/log/`

## Prerequisites

- Ubuntu 18.04 or newer
- Node.js installed (v16 or higher)
- Application deployed to `/opt/apache-answers-bot`
- Root or sudo access

## Deployment Steps

### 1. Create Dedicated User

For security, run the application as a dedicated non-root user:

```bash
# Create system user (no login shell, no home directory)
sudo useradd --system --no-create-home --shell /bin/false apache-answers-bot

# If you prefer a user with a home directory:
# sudo useradd --system --create-home --shell /bin/bash apache-answers-bot
```

### 2. Set Up Application Directory

```bash
# Ensure the application is in the correct location
cd /opt/apache-answers-bot

# Install dependencies
sudo npm ci --only=production

# Build the application
sudo npm run build

# Create logs directory
sudo mkdir -p logs

# Set ownership to the service user
sudo chown -R apache-answers-bot:apache-answers-bot /opt/apache-answers-bot

# Set appropriate permissions
sudo chmod 755 /opt/apache-answers-bot
sudo chmod 755 /opt/apache-answers-bot/dist
sudo chmod 775 /opt/apache-answers-bot/logs

# Secure the .env file (contains sensitive data)
sudo chmod 600 /opt/apache-answers-bot/.env
```

### 3. Configure Environment Variables

Ensure your `.env` file is properly configured:

```bash
sudo nano /opt/apache-answers-bot/.env
```

Verify all required environment variables are set (see `env.example` for reference).

### 4. Install systemd Service

```bash
# Copy the service file to systemd directory
sudo cp /opt/apache-answers-bot/apache-answers-bot.service \
    /etc/systemd/system/apache-answers-bot.service

# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable apache-answers-bot.service
```

### 5. Configure Log Rotation

```bash
# Copy logrotate configuration
sudo cp /opt/apache-answers-bot/apache-answers-bot.logrotate \
    /etc/logrotate.d/apache-answers-bot

# Set correct permissions
sudo chmod 644 /etc/logrotate.d/apache-answers-bot

# Test logrotate configuration
sudo logrotate -d /etc/logrotate.d/apache-answers-bot

# Force a test rotation (optional)
sudo logrotate -f /etc/logrotate.d/apache-answers-bot
```

### 6. Configure journald (Optional but Recommended)

systemd logs to journald by default. Configure retention:

```bash
sudo nano /etc/systemd/journald.conf
```

Add or modify these settings:

```ini
[Journal]
# Keep 1GB of logs
SystemMaxUse=1G

# Keep logs for 30 days
MaxRetentionSec=30d

# Compress logs
Compress=yes
```

Restart journald:

```bash
sudo systemctl restart systemd-journald
```

### 7. Start the Service

```bash
# Start the service
sudo systemctl start apache-answers-bot.service

# Check status
sudo systemctl status apache-answers-bot.service

# View real-time logs
sudo journalctl -u apache-answers-bot.service -f

# View application logs (Winston logs)
sudo tail -f /opt/apache-answers-bot/logs/combined.log
```

## Service Management Commands

### Basic Operations

```bash
# Start service
sudo systemctl start apache-answers-bot

# Stop service
sudo systemctl stop apache-answers-bot

# Restart service
sudo systemctl restart apache-answers-bot

# Reload configuration (if supported)
sudo systemctl reload apache-answers-bot

# Check status
sudo systemctl status apache-answers-bot

# Enable on boot
sudo systemctl enable apache-answers-bot

# Disable on boot
sudo systemctl disable apache-answers-bot
```

### Viewing Logs

```bash
# View all logs
sudo journalctl -u apache-answers-bot

# Follow logs in real-time
sudo journalctl -u apache-answers-bot -f

# View logs from today
sudo journalctl -u apache-answers-bot --since today

# View last 100 lines
sudo journalctl -u apache-answers-bot -n 100

# View logs with priority (errors only)
sudo journalctl -u apache-answers-bot -p err

# View logs in specific time range
sudo journalctl -u apache-answers-bot --since "2024-01-01 00:00:00" --until "2024-01-02 00:00:00"

# Export logs to file
sudo journalctl -u apache-answers-bot > /tmp/service-logs.txt

# View application-specific logs (Winston) - in standard FHS location
sudo tail -f /var/log/apache-answers-bot/combined.log
sudo tail -f /var/log/apache-answers-bot/error.log

# Or via symlink (same logs)
sudo tail -f /opt/apache-answers-bot/logs/combined.log
sudo tail -f /opt/apache-answers-bot/logs/error.log

# View rotated logs
sudo ls -lh /var/log/apache-answers-bot/
sudo zcat /var/log/apache-answers-bot/combined.log-20240101.gz
```

## Troubleshooting

### Service Won't Start

```bash
# Check service status for error messages
sudo systemctl status apache-answers-bot -l

# View detailed error logs
sudo journalctl -u apache-answers-bot -n 50 --no-pager

# Check if the executable exists
ls -l /opt/apache-answers-bot/dist/index.js

# Check permissions
sudo ls -la /opt/apache-answers-bot

# Test running manually as the service user
sudo -u apache-answers-bot /usr/bin/node /opt/apache-answers-bot/dist/index.js
```

### Common Issues

**1. Permission Denied**
```bash
# Fix ownership
sudo chown -R apache-answers-bot:apache-answers-bot /opt/apache-answers-bot

# Fix .env permissions
sudo chmod 600 /opt/apache-answers-bot/.env
sudo chown apache-answers-bot:apache-answers-bot /opt/apache-answers-bot/.env
```

**2. Port Already in Use**
```bash
# Check what's using port 3000
sudo netstat -tlnp | grep 3000
# or
sudo ss -tlnp | grep 3000

# Kill the process or change CALLBACK_PORT in .env
```

**3. Module Not Found**
```bash
# Reinstall dependencies
cd /opt/apache-answers-bot
sudo -u apache-answers-bot npm ci --only=production
```

**4. Environment Variables Not Loading**
```bash
# Verify .env file exists and is readable
sudo ls -la /opt/apache-answers-bot/.env

# Check service file has correct EnvironmentFile path
sudo cat /etc/systemd/system/apache-answers-bot.service | grep EnvironmentFile

# Reload systemd after changes
sudo systemctl daemon-reload
sudo systemctl restart apache-answers-bot
```

### Check Service Health

```bash
# Check if service is active
systemctl is-active apache-answers-bot

# Check if service is enabled
systemctl is-enabled apache-answers-bot

# View service resource usage
systemd-cgtop

# Check specific service resources
systemctl status apache-answers-bot
```

## Updating the Application

When deploying updates:

```bash
# 1. Navigate to application directory
cd /opt/apache-answers-bot

# 2. Pull latest code (if using git)
sudo -u apache-answers-bot git pull

# 3. Install dependencies
sudo -u apache-answers-bot npm ci --only=production

# 4. Rebuild
sudo -u apache-answers-bot npm run build

# 5. Restart service
sudo systemctl restart apache-answers-bot

# 6. Verify it's running
sudo systemctl status apache-answers-bot
sudo journalctl -u apache-answers-bot -n 20
```

## Monitoring and Maintenance

### Set Up Email Alerts (Optional)

Install mail utilities:

```bash
sudo apt-get install mailutils
```

Create monitoring script at `/opt/apache-answers-bot/monitor.sh`:

```bash
#!/bin/bash
if ! systemctl is-active --quiet apache-answers-bot; then
    echo "Apache Answers Teams Integration is DOWN" | mail -s "Service Alert" admin@example.com
fi
```

Add to crontab:

```bash
sudo crontab -e
```

Add line:

```
*/5 * * * * /opt/apache-answers-bot/monitor.sh
```

### Disk Space Monitoring

```bash
# Check log disk usage (actual location)
du -sh /var/log/apache-answers-bot/
du -sh /var/log/journal/

# Clean old journal logs manually if needed
sudo journalctl --vacuum-time=7d
sudo journalctl --vacuum-size=500M
```

## Security Hardening

The provided service file includes several security features:

- ✅ Runs as non-root user (`apache-answers-bot`)
- ✅ `NoNewPrivileges=true` - Prevents privilege escalation
- ✅ `PrivateTmp=true` - Isolates /tmp directory
- ✅ `ProtectSystem=strict` - Read-only system directories
- ✅ `ProtectHome=true` - Blocks access to home directories
- ✅ `ReadWritePaths` - Only logs directory is writable

### Additional Security Steps

```bash
# Enable firewall (if not already enabled)
sudo ufw enable

# Allow only necessary ports
sudo ufw allow 3000/tcp comment 'Apache Answers Teams Integration'

# Check open ports
sudo ss -tlnp

# Review service security
systemd-analyze security apache-answers-bot
```

## Backup Recommendations

```bash
# Backup configuration and logs
sudo tar -czf apache-answers-bot-backup-$(date +%Y%m%d).tar.gz \
    /opt/apache-answers-bot/.env \
    /var/log/apache-answers-bot/ \
    /etc/systemd/system/apache-answers-bot.service

# Automated daily backup (add to crontab)
0 2 * * * tar -czf /backup/apache-answers-bot-$(date +\%Y\%m\%d).tar.gz /opt/apache-answers-bot/.env /var/log/apache-answers-bot/
```

## Performance Tuning

If you need to adjust resource limits, edit the service file:

```bash
sudo nano /etc/systemd/system/apache-answers-bot.service
```

Uncomment and adjust these lines:

```ini
MemoryMax=512M
CPUQuota=50%
```

Then reload and restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart apache-answers-bot
```

## Uninstall

To completely remove the service:

```bash
# Stop and disable service
sudo systemctl stop apache-answers-bot
sudo systemctl disable apache-answers-bot

# Remove service file
sudo rm /etc/systemd/system/apache-answers-bot.service

# Remove logrotate config
sudo rm /etc/logrotate.d/apache-answers-bot

# Reload systemd
sudo systemctl daemon-reload

# Optionally remove user
sudo userdel apache-answers-bot

# Optionally remove application directory
sudo rm -rf /opt/apache-answers-bot
```

## Quick Reference Card

```bash
# Start/Stop/Restart
sudo systemctl start apache-answers-bot
sudo systemctl stop apache-answers-bot
sudo systemctl restart apache-answers-bot

# Status
sudo systemctl status apache-answers-bot

# Logs (live)
sudo journalctl -u apache-answers-bot -f

# Application logs
sudo tail -f /opt/apache-answers-bot/logs/combined.log

# Reload after config changes
sudo systemctl daemon-reload
sudo systemctl restart apache-answers-bot
```