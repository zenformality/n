# n - AI Assistant

A sophisticated web-based AI assistant for Arch Linux, similar to JARVIS and ULTRON.

## Features

- **AI-Powered Chat**: Natural language interaction via OpenCode Zen API
- **Terminal Emulator**: Full terminal access through web interface
- **System Monitoring**: Real-time CPU, memory, disk, and process monitoring
- **Package Management**: Install, remove, and update Arch Linux packages (pacman/yay/paru)
- **File Management**: Read, write, upload, and delete files
- **Web Search**: Built-in web search capabilities
- **Voice Input**: Speech-to-text support
- **Voice Output (TTS)**: Text-to-speech for AI responses using Web Speech API
- **Arch Linux Compatible**: Designed specifically for Arch Linux environments

## Requirements

- Arch Linux
- Python 3.9+
- Node.js (optional, for serving frontend)
- OpenCode Zen API key (optional, for AI features)

## Installation

### 1. Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install system dependencies (optional)
sudo pacman -S python-psutil python-httpx
```

### 2. Configure AI (Optional)

Set the OpenCode Zen API key:

```bash
export OPENCODE_ZEN_KEY="your-api-key-here"
```

### 3. Run the Backend

```bash
cd backend
python server.py
```

The server will start at `http://localhost:8000`

### 4. Access the Interface

Open your browser and navigate to `http://localhost:8000` or serve the frontend:

```bash
# Serve frontend
cd frontend
python -m http.server 8080
```

Then open `http://localhost:8080`

## Architecture

```
n/
├── backend/
│   ├── server.py          # FastAPI backend server
│   └── requirements.txt   # Python dependencies
└── frontend/
    ├── index.html         # Main HTML interface
    ├── styles.css         # JARVIS-like styling
    └── app.js            # Frontend JavaScript
```

## API Endpoints

- `GET /api/status` - System status and info
- `POST /api/command` - Execute system command
- `POST /api/chat` - Chat with AI
- `POST /api/tts` - Text-to-speech synthesis
- `POST /api/install` - Install package
- `POST /api/remove` - Remove package
- `POST /api/update` - Update system
- `GET /api/packages` - List installed packages
- `GET /api/processes` - List running processes
- `POST /api/file/read` - Read file
- `POST /api/file/write` - Write file
- `DELETE /api/file` - Delete file
- `POST /api/search` - Web search
- `WS /ws` - WebSocket for real-time communication

## Security

⚠️ **Warning**: This assistant has full system control. Use with caution:
- All commands are executed with the permissions of the running user
- Package installation requires sudo (configured for your system)
- File operations can modify any accessible files
- Use in a secure, controlled environment only

## Configuration

Environment variables:
- `OPENCODE_ZEN_KEY` - OpenCode Zen API key for AI features
- `OPENCODE_ZEN_API` - Custom API endpoint (default: OpenCode Zen)

## Arch Linux Specific Features

- Automatic detection of pacman/yay/paru
- AUR package support via yay or paru
- System update with `yay -Syu` or `paru -Syu`
- Native Arch package management

## Troubleshooting

1. **WebSocket connection fails**: Ensure the backend server is running on port 8000
2. **AI not responding**: Check if OPENCODE_ZEN_KEY is set correctly
3. **Package installation fails**: Ensure you have sudo configured or run with appropriate permissions
4. **Port already in use**: Change the port in server.py or free up port 8000

## License

MIT
