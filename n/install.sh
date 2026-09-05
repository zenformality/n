#!/bin/bash

echo "╔══════════════════════════════════════════════════════════╗"
echo "║           n - AI Assistant Installer (Arch Linux)       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Install system dependencies
echo "[1/4] Installing system dependencies..."
sudo pacman -Sy --needed --noconfirm python python-pip python-psutil python-httpx

# Install Python dependencies
echo "[2/4] Installing Python dependencies..."
cd "$(dirname "$0")/backend"
pip install -r requirements.txt --break-system-packages 2>/dev/null || pip install -r requirements.txt --user

# Install AUR helper if not present
echo "[3/4] Checking for AUR helper..."
if ! command -v yay &> /dev/null && ! command -v paru &> /dev/null; then
    echo "Installing yay..."
    sudo pacman -S --needed --noconfirm git base-devel
    git clone https://aur.archlinux.org/yay.git /tmp/yay
    cd /tmp/yay
    makepkg -si --noconfirm
    cd -
else
    echo "AUR helper already installed ($(command -v yay || command -v paru))"
fi

# Create systemd service
echo "[4/4] Creating systemd service..."
sudo tee /etc/systemd/system/n-assistant.service > /dev/null <<EOF
[Unit]
Description=n AI Assistant
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(which python3) server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable n-assistant.service

echo ""
echo "✓ Installation complete!"
echo ""
echo "To start n:"
echo "  cd backend && python3 server.py"
echo ""
echo "Or use systemd:"
echo "  sudo systemctl start n-assistant"
echo ""
echo "Access the web interface at: http://localhost:8000"
echo ""
echo "Optional: Set AI API key"
echo "  export OPENCODE_ZEN_KEY='your-key-here'"
