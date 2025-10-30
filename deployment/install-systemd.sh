#!/bin/bash
#
# Installation script for Apache Answers Teams Integration systemd service
# This script must be run with sudo
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
# Dynamically determine application directory from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

SERVICE_USER="apache-answers-bot"
SERVICE_NAME="apache-answers-bot"
SERVICE_FILE="apache-answers-bot.service"
LOGROTATE_FILE="apache-answers-bot.logrotate"

# Functions
print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run with sudo"
        echo "Usage: sudo ./install-systemd.sh"
        exit 1
    fi
}

check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        echo "Please install Node.js v16 or higher first"
        echo "See: $APP_DIR/deployment/NODEJS_INSTALLATION.md"
        exit 1
    fi

    NODE_VERSION=$(node -v)
    NODE_PATH=$(which node)

    # Check if Node.js is from nvm (in user home directory)
    if [[ "$NODE_PATH" == *".nvm"* ]]; then
        print_warning "Node.js appears to be installed via nvm: $NODE_PATH"
        echo ""
        echo "⚠️  WARNING: nvm-installed Node.js may not work with systemd!"
        echo ""
        echo "For production, Node.js should be installed system-wide."
        echo "Expected locations: /usr/bin/node or /usr/local/bin/node"
        echo ""
        echo "Options:"
        echo "  1. Install Node.js system-wide (recommended)"
        echo "     See: $APP_DIR/deployment/NODEJS_INSTALLATION.md"
        echo ""
        echo "  2. Create a system-wide symlink"
        echo "     sudo ln -sf $NODE_PATH /usr/local/bin/node"
        echo ""
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Installation cancelled"
            exit 1
        fi
    else
        print_success "Node.js found: $NODE_VERSION at $NODE_PATH"
    fi
}

check_app_dir() {
    if [ ! -d "$APP_DIR" ]; then
        print_error "Application directory not found: $APP_DIR"
        exit 1
    fi
    print_success "Application directory found: $APP_DIR"
}

check_env_file() {
    if [ ! -f "$APP_DIR/.env" ]; then
        print_warning ".env file not found"
        echo "Please create $APP_DIR/.env from env.example"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        print_success ".env file found"
    fi
}

create_service_user() {
    print_info "Creating service user: $SERVICE_USER"
    if id "$SERVICE_USER" &>/dev/null; then
        print_warning "User $SERVICE_USER already exists"
    else
        useradd --system --no-create-home --shell /bin/false "$SERVICE_USER"
        print_success "Created user: $SERVICE_USER"
    fi
}

install_dependencies() {
    print_info "Installing Node.js dependencies..."
    cd "$APP_DIR"

    # Install all dependencies (including dev) for building
    npm ci
    print_success "Dependencies installed"
}

build_application() {
    print_info "Building application..."
    cd "$APP_DIR"

    npm run build
    print_success "Application built"
}

setup_directories() {
    print_info "Setting up directories and permissions..."

    # Create standard FHS log directory
    mkdir -p /var/log/apache-answers-bot
    chown "$SERVICE_USER:$SERVICE_USER" /var/log/apache-answers-bot
    chmod 755 /var/log/apache-answers-bot
    print_success "Created log directory: /var/log/apache-answers-bot"

    # Remove existing logs directory if it exists and is a directory (not a symlink)
    if [ -d "$APP_DIR/logs" ] && [ ! -L "$APP_DIR/logs" ]; then
        print_info "Moving existing logs to /var/log/apache-answers-bot..."
        # Move any existing log files
        if [ "$(ls -A $APP_DIR/logs 2>/dev/null)" ]; then
            mv "$APP_DIR/logs"/*.log /var/log/apache-answers-bot/ 2>/dev/null || true
            print_success "Existing logs moved"
        fi
        rmdir "$APP_DIR/logs"
    fi

    # Remove symlink if it exists
    if [ -L "$APP_DIR/logs" ]; then
        rm "$APP_DIR/logs"
        print_info "Removed existing symlink"
    fi

    # Create symlink from app logs to /var/log
    ln -s /var/log/apache-answers-bot "$APP_DIR/logs"
    print_success "Created symlink: $APP_DIR/logs -> /var/log/apache-answers-bot"

    # Set ownership
    chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

    # Set permissions
    chmod 755 "$APP_DIR"
    chmod 755 "$APP_DIR/dist"

    # Secure .env file if it exists
    if [ -f "$APP_DIR/.env" ]; then
        chmod 600 "$APP_DIR/.env"
        chown "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/.env"
        print_success ".env file secured"
    fi

    print_success "Directories and permissions configured"
}

install_systemd_service() {
    print_info "Installing systemd service..."

    # Copy service file and replace placeholder paths with actual application directory
    if [ -f "$APP_DIR/deployment/$SERVICE_FILE" ]; then
        # Replace {{APP_DIR}} placeholder with actual directory
        sed "s|{{APP_DIR}}|$APP_DIR|g" "$APP_DIR/deployment/$SERVICE_FILE" > "/etc/systemd/system/$SERVICE_FILE"
        chmod 644 "/etc/systemd/system/$SERVICE_FILE"
        print_success "Service file installed"
    else
        print_error "Service file not found: $APP_DIR/deployment/$SERVICE_FILE"
        exit 1
    fi

    # Reload systemd
    systemctl daemon-reload
    print_success "systemd reloaded"

    # Enable service
    systemctl enable "$SERVICE_NAME"
    print_success "Service enabled (will start on boot)"
}

install_logrotate() {
    print_info "Installing logrotate configuration..."

    if [ -f "$APP_DIR/deployment/$LOGROTATE_FILE" ]; then
        cp "$APP_DIR/deployment/$LOGROTATE_FILE" "/etc/logrotate.d/$SERVICE_NAME"
        chmod 644 "/etc/logrotate.d/$SERVICE_NAME"
        print_success "Logrotate configuration installed"

        # Test logrotate configuration
        print_info "Testing logrotate configuration..."
        logrotate -d "/etc/logrotate.d/$SERVICE_NAME" > /dev/null 2>&1
        print_success "Logrotate configuration valid"
    else
        print_warning "Logrotate file not found: $APP_DIR/deployment/$LOGROTATE_FILE"
        echo "Skipping logrotate installation"
    fi
}

start_service() {
    print_info "Starting service..."

    systemctl start "$SERVICE_NAME"
    sleep 2

    if systemctl is-active --quiet "$SERVICE_NAME"; then
        print_success "Service started successfully"
    else
        print_error "Service failed to start"
        echo "Check logs with: sudo journalctl -u $SERVICE_NAME -n 50"
        exit 1
    fi
}

show_status() {
    print_info "Service status:"
    systemctl status "$SERVICE_NAME" --no-pager -l
}

print_summary() {
    echo ""
    print_header "Installation Complete!"
    echo ""
    echo "Service: $SERVICE_NAME"
    echo "Status: $(systemctl is-active $SERVICE_NAME)"
    echo "Enabled: $(systemctl is-enabled $SERVICE_NAME)"
    echo ""
    print_info "Useful commands:"
    echo "  Start:   sudo systemctl start $SERVICE_NAME"
    echo "  Stop:    sudo systemctl stop $SERVICE_NAME"
    echo "  Restart: sudo systemctl restart $SERVICE_NAME"
    echo "  Status:  sudo systemctl status $SERVICE_NAME"
    echo "  Logs:    sudo journalctl -u $SERVICE_NAME -f"
    echo ""
    print_info "Application logs (via symlink):"
    echo "  $APP_DIR/logs/combined.log -> /var/log/apache-answers-bot/combined.log"
    echo "  $APP_DIR/logs/error.log -> /var/log/apache-answers-bot/error.log"
    echo ""
    print_info "For more information, see:"
    echo "  $APP_DIR/deployment/SYSTEMD_DEPLOYMENT.md"
    echo ""
}

# Main installation flow
main() {
    print_header "Apache Answers Teams Integration Installer"
    echo ""

    # Pre-flight checks
    check_root
    check_node
    check_app_dir
    check_env_file

    echo ""
    print_info "This will install $SERVICE_NAME as a systemd service"
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Installation cancelled"
        exit 0
    fi

    echo ""

    # Installation steps
    create_service_user
    install_dependencies
    build_application
    setup_directories
    install_systemd_service
    install_logrotate
    start_service

    echo ""
    show_status
    echo ""
    print_summary
}

# Run main function
main