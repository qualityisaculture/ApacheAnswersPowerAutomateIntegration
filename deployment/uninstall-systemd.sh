#!/bin/bash
#
# Uninstallation script for Apache Answers Teams Integration systemd service
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
        echo "Usage: sudo ./uninstall-systemd.sh"
        exit 1
    fi
}

confirm_uninstall() {
    print_warning "This will remove the $SERVICE_NAME systemd service"
    echo ""
    read -p "Are you sure you want to continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Uninstallation cancelled"
        exit 0
    fi
}

stop_service() {
    print_info "Stopping service..."
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        systemctl stop "$SERVICE_NAME"
        print_success "Service stopped"
    else
        print_info "Service is not running"
    fi
}

disable_service() {
    print_info "Disabling service..."
    if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
        systemctl disable "$SERVICE_NAME"
        print_success "Service disabled"
    else
        print_info "Service is not enabled"
    fi
}

remove_service_file() {
    print_info "Removing service file..."
    if [ -f "/etc/systemd/system/$SERVICE_FILE" ]; then
        rm "/etc/systemd/system/$SERVICE_FILE"
        print_success "Service file removed"
    else
        print_info "Service file not found"
    fi

    systemctl daemon-reload
    print_success "systemd reloaded"
}

remove_logrotate() {
    print_info "Removing logrotate configuration..."
    if [ -f "/etc/logrotate.d/$SERVICE_NAME" ]; then
        rm "/etc/logrotate.d/$SERVICE_NAME"
        print_success "Logrotate configuration removed"
    else
        print_info "Logrotate configuration not found"
    fi
}

remove_user() {
    print_info "Removing service user..."
    read -p "Remove user $SERVICE_USER? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if id "$SERVICE_USER" &>/dev/null; then
            userdel "$SERVICE_USER"
            print_success "User removed: $SERVICE_USER"
        else
            print_info "User not found: $SERVICE_USER"
        fi
    else
        print_info "User retained: $SERVICE_USER"
    fi
}

remove_logs() {
    print_warning "Log files are in: /var/log/apache-answers-bot"
    read -p "Remove log directory? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -d "/var/log/apache-answers-bot" ]; then
            rm -rf /var/log/apache-answers-bot
            print_success "Log directory removed"
        else
            print_info "Log directory not found"
        fi
    else
        print_info "Log directory retained: /var/log/apache-answers-bot"
    fi
}

remove_app_files() {
    print_warning "Application files are still in: $APP_DIR"
    read -p "Remove application directory? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -d "$APP_DIR" ]; then
            # Remove symlink if it exists
            if [ -L "$APP_DIR/logs" ]; then
                rm "$APP_DIR/logs"
                print_info "Removed log symlink"
            fi
            rm -rf "$APP_DIR"
            print_success "Application directory removed"
        else
            print_info "Application directory not found"
        fi
    else
        print_info "Application directory retained: $APP_DIR"
    fi
}

print_summary() {
    echo ""
    print_header "Uninstallation Complete!"
    echo ""
    print_success "The $SERVICE_NAME service has been removed"
    echo ""
}

# Main uninstallation flow
main() {
    print_header "Apache Answers Teams Integration Uninstaller"
    echo ""

    check_root
    confirm_uninstall

    echo ""

    # Uninstallation steps
    stop_service
    disable_service
    remove_service_file
    remove_logrotate

    echo ""
    remove_user
    echo ""
    remove_logs
    echo ""
    remove_app_files

    print_summary
}

# Run main function
main