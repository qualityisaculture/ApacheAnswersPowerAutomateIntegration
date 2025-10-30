# Logging Configuration with Symlink Approach

## Overview

This deployment uses a **symlink approach** to store logs in the FHS-standard location (`/var/log/`) without requiring any code changes.

## Directory Structure

```
/var/log/apache-answers-bot/           <- Actual log files (FHS standard)
├── combined.log                          <- All log messages
├── error.log                             <- Error-level messages only
├── combined.log-20241030                 <- Rotated log (gzipped)
└── error.log-20241030                    <- Rotated error log (gzipped)

/opt/apache-answers-bot/logs/  <- Symlink pointing to above
```

## How It Works

1. **Real Directory**: `/var/log/apache-answers-bot/` is created during installation
2. **Symlink**: `/opt/apache-answers-bot/logs/` → `/var/log/apache-answers-bot/`
3. **Application**: Writes to `logs/combined.log` and `logs/error.log` (relative paths)
4. **Result**: Files actually end up in `/var/log/apache-answers-bot/` automatically

## Benefits

✅ **No Code Changes**: Application code remains completely unchanged
✅ **FHS Compliant**: Logs stored in `/var/log/` (Linux standard)
✅ **Tool Compatible**: Log aggregation tools (Logwatch, Logstash, etc.) expect logs in `/var/log/`
✅ **Transparent**: Application doesn't know logs are redirected
✅ **Flexible**: Can access logs via either path

## Accessing Logs

Both paths work identically:

```bash
# Via FHS standard path
sudo tail -f /var/log/apache-answers-bot/combined.log

# Via symlink (same file)
sudo tail -f /opt/apache-answers-bot/logs/combined.log

# List all logs
ls -lh /var/log/apache-answers-bot/
```

## Verification

After installation, verify the symlink:

```bash
# Check symlink exists and points to correct location
ls -la /opt/apache-answers-bot/logs

# Output should show:
# lrwxrwxrwx 1 apache-answers-bot apache-answers-bot 29 Oct 30 12:00 logs -> /var/log/apache-answers-bot

# Verify files are being written
ls -lh /var/log/apache-answers-bot/
```

## Log Rotation

Logrotate is configured to rotate files in `/var/log/apache-answers-bot/`:

- **Daily** rotation (or when > 100MB)
- **30 days** retention
- **Compressed** after rotation (`.gz`)
- **90 days** maximum age (hard delete)

Configuration: `/etc/logrotate.d/apache-answers-bot`

```bash
# Force rotation manually
sudo logrotate -f /etc/logrotate.d/apache-answers-bot

# Test configuration
sudo logrotate -d /etc/logrotate.d/apache-answers-bot
```

## Permissions

```bash
# Log directory
drwxr-xr-x  apache-answers-bot apache-answers-bot /var/log/apache-answers-bot/

# Log files
-rw-r--r--  apache-answers-bot apache-answers-bot combined.log
-rw-r--r--  apache-answers-bot apache-answers-bot error.log

# Symlink
lrwxrwxrwx  apache-answers-bot apache-answers-bot logs -> /var/log/apache-answers-bot
```

## Backup Considerations

When backing up, use the actual directory (not the symlink):

```bash
# Backup logs (correct)
sudo tar -czf logs-backup.tar.gz /var/log/apache-answers-bot/

# This also works but creates symlink in archive
sudo tar -czf logs-backup.tar.gz /opt/apache-answers-bot/logs/

# Best practice: use -h flag to follow symlinks
sudo tar -czfh logs-backup.tar.gz /opt/apache-answers-bot/logs/
```

## Monitoring Disk Usage

```bash
# Check log directory size
du -sh /var/log/apache-answers-bot/

# Check all /var/log usage
du -sh /var/log/*

# Monitor in real-time with watch
watch -n 60 'du -sh /var/log/apache-answers-bot/'
```

## Troubleshooting

### Symlink Broken

If the symlink is broken or missing:

```bash
# Remove broken symlink if exists
rm /opt/apache-answers-bot/logs

# Recreate symlink
ln -s /var/log/apache-answers-bot /opt/apache-answers-bot/logs

# Verify
ls -la /opt/apache-answers-bot/logs
```

### Permission Issues

If logs aren't being written:

```bash
# Fix ownership
sudo chown -R apache-answers-bot:apache-answers-bot /var/log/apache-answers-bot

# Fix permissions
sudo chmod 755 /var/log/apache-answers-bot

# Restart service
sudo systemctl restart apache-answers-bot
```

### Logs in Wrong Location

If logs appear in both locations:

```bash
# Check if it's a real directory instead of symlink
ls -la /opt/apache-answers-bot/logs

# If it's a directory (d) instead of symlink (l):
# 1. Stop service
sudo systemctl stop apache-answers-bot

# 2. Move files to /var/log
sudo mv /opt/apache-answers-bot/logs/*.log /var/log/apache-answers-bot/

# 3. Remove directory
sudo rmdir /opt/apache-answers-bot/logs

# 4. Create symlink
sudo ln -s /var/log/apache-answers-bot /opt/apache-answers-bot/logs

# 5. Fix ownership
sudo chown -h apache-answers-bot:apache-answers-bot /opt/apache-answers-bot/logs

# 6. Start service
sudo systemctl start apache-answers-bot
```

## Alternative: Environment Variable Approach

If you prefer to configure log location via environment variable instead of symlink:

1. Add to `src/services/logger.ts`:
   ```typescript
   const LOG_DIR = process.env.LOG_DIR || "logs";
   ```

2. Add to `.env`:
   ```env
   LOG_DIR=/var/log/apache-answers-bot
   ```

3. Remove symlink and use direct path

**Note**: The current symlink approach is preferred as it requires no code changes.

## Summary

The symlink approach provides a clean, transparent way to follow Linux FHS standards while keeping your application code simple and portable. Logs are in the standard location (`/var/log/`), but the application continues to work exactly as before.