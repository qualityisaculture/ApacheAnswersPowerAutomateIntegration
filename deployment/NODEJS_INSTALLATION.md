# Node.js Installation for Production

systemd services require Node.js to be installed system-wide (not via nvm) to be accessible to service accounts.

## Why System-Wide Installation?

- **nvm installs are user-specific** - Only available to the user who installed it
- **systemd doesn't load shell profiles** - `.bashrc` and `.bash_profile` are not sourced
- **Service users have no home directory** - System users like `apache-answers-bot` can't access `~/.nvm`

## Recommended: Install Node.js System-Wide

### Option 1: Using NodeSource Repository (Recommended)

This provides the latest Node.js versions and is maintained by the Node.js team.

```bash
# Install Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Check Node.js location (should be /usr/bin/node)
which node
```

**For other versions:**
```bash
# Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Node.js 21.x (Current)
curl -fsSL https://deb.nodesource.com/setup_21.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Option 2: Using Ubuntu Snap

Snap packages are isolated but Node.js snap creates system-wide symlinks.

```bash
# Install Node.js via snap
sudo snap install node --classic

# Verify
node --version
which node  # Should show /snap/bin/node
```

### Option 3: Manual Binary Installation

Download and install Node.js binary to `/usr/local`.

```bash
# Download Node.js (adjust version as needed)
cd /tmp
wget https://nodejs.org/dist/v20.10.0/node-v20.10.0-linux-x64.tar.xz

# Extract to /usr/local
sudo tar -xJf node-v20.10.0-linux-x64.tar.xz -C /usr/local --strip-components=1

# Verify
node --version
which node  # Should show /usr/local/bin/node
```

## Alternative: Use Existing nvm Installation

If you must use the existing nvm installation, you have two options:

### Option A: Update Service File with Full Path

Find your Node.js path:
```bash
# While logged in as the user with nvm
which node
# Example output: /home/youruser/.nvm/versions/node/v20.10.0/bin/node
```

Update the service file's `ExecStart` line:
```ini
ExecStart=/home/youruser/.nvm/versions/node/v20.10.0/bin/node /opt/apache-answers-bot/dist/index.js
```

**Cons:**
- ⚠️ Breaks if Node version changes
- ⚠️ Depends on user's home directory
- ⚠️ Not best practice for production

### Option B: Create System-Wide Symlink

```bash
# Find current Node.js path
nvm which current
# Example: /home/youruser/.nvm/versions/node/v20.10.0/bin/node

# Create symlink (as root)
sudo ln -sf /home/youruser/.nvm/versions/node/v20.10.0/bin/node /usr/local/bin/node
sudo ln -sf /home/youruser/.nvm/versions/node/v20.10.0/bin/npm /usr/local/bin/npm

# Verify
which node  # Should show /usr/local/bin/node
node --version
```

**Cons:**
- ⚠️ Must update symlink when Node version changes
- ⚠️ Dependency on user's nvm installation

## Migrating from nvm to System-Wide

If you currently have nvm and want to migrate:

```bash
# 1. Note your current Node.js version
node --version

# 2. Install Node.js system-wide (see Option 1 above)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Verify system-wide installation
which node  # Should be /usr/bin/node (not ~/.nvm/...)

# 4. Optionally, keep nvm for development
#    The system-wide Node.js will be used by systemd
#    nvm will still work in your shell
```

## Verification

After installing Node.js system-wide:

```bash
# Check Node.js is in system PATH
which node
# Should output: /usr/bin/node or /usr/local/bin/node
# Should NOT output: /home/user/.nvm/...

# Test as root
sudo node --version

# Test as service user (if created)
sudo -u apache-answers-bot node --version

# Verify npm
which npm
sudo npm --version
```

## Updating the Application

After system-wide Node.js installation:

```bash
# Navigate to application
cd /opt/apache-answers-bot

# Install dependencies (will use system Node.js)
npm ci --only=production

# Build
npm run build

# Test the service
sudo systemctl restart apache-answers-bot
sudo systemctl status apache-answers-bot
```

## Troubleshooting

### "node: command not found" in systemd

**Cause:** Node.js not installed system-wide or not in PATH.

**Solution:**
```bash
# Check if node exists
ls -la /usr/bin/node
ls -la /usr/local/bin/node

# If not found, install system-wide (see above)
```

### Service fails with "Cannot find module"

**Cause:** Dependencies installed with user's nvm but service uses different Node.js.

**Solution:**
```bash
cd /opt/apache-answers-bot
sudo rm -rf node_modules package-lock.json
npm ci --only=production
npm run build
```

### Different Node.js versions

**Cause:** System Node.js version differs from nvm version.

**Solution:**
```bash
# Check what version you need
cat package.json | grep '"node"'

# Install matching version system-wide
# See "Using NodeSource Repository" above
```

## Recommended Approach

For production systemd services:

1. ✅ **Use NodeSource repository** - Latest versions, well-maintained
2. ✅ **Install to /usr/bin** - Standard location, works with all services
3. ✅ **Keep nvm for development** - nvm remains useful for development work
4. ✅ **Document the version** - Note Node.js version in deployment docs

## Summary

```bash
# Best Practice Installation (3 commands)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version && which node
```

After this, the systemd service will work without any modifications! 🎉
