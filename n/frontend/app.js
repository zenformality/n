class nAssistant {
    constructor() {
        this.ws = null;
        this.apiBase = 'http://localhost:8000/api';
        this.currentSection = 'chat';
        this.isConnected = false;
        this.ttsEnabled = false;
        this.speakerButtonEnabled = true;
        
        this.init();
    }

    init() {
        this.connectWebSocket();
        this.setupNavigation();
        this.setupChat();
        this.setupTerminal();
        this.setupSystem();
        this.setupFiles();
        this.setupTTS();
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);
        
        document.addEventListener('DOMContentLoaded', () => {
            this.refreshSystemInfo();
            setInterval(() => this.refreshSystemInfo(), 5000);
        });
    }

    connectWebSocket() {
        const wsUrl = `ws://${window.location.hostname}:8000/ws`;
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                document.getElementById('connection-status').textContent = 'Connected';
                document.getElementById('status-indicator').textContent = 'ONLINE';
                document.getElementById('status-indicator').style.color = 'var(--success)';
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.isConnected = false;
                document.getElementById('connection-status').textContent = 'Disconnected';
                document.getElementById('status-indicator').textContent = 'OFFLINE';
                document.getElementById('status-indicator').style.color = 'var(--error)';
                setTimeout(() => this.connectWebSocket(), 3000);
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (e) {
            console.error('Failed to connect WebSocket:', e);
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'command_result':
                this.displayTerminalResult(data.data);
                break;
            case 'chat_response':
                this.displayChatMessage(data.response, 'n');
                break;
            case 'status':
                this.updateSystemInfo(data.data);
                break;
        }
    }

    setupNavigation() {
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const section = btn.dataset.section;
                document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
                document.getElementById(`${section}-section`).classList.add('active');
                this.currentSection = section;
            });
        });
    }

    setupChat() {
        const chatInput = document.getElementById('chat-input');
        const chatSend = document.getElementById('chat-send');
        const voiceBtn = document.getElementById('voice-btn');
        
        const sendMessage = async () => {
            const message = chatInput.value.trim();
            if (!message) return;
            
            this.displayChatMessage(message, 'user');
            chatInput.value = '';
            
            try {
                const response = await fetch(`${this.apiBase}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message })
                });
                
                const data = await response.json();
                this.displayChatMessage(data.response, 'n');
                
                if (data.mode === 'ai' && data.response.includes('```bash')) {
                    const commands = this.extractCommands(data.response);
                    for (const cmd of commands) {
                        await this.executeCommand(cmd);
                    }
                }
            } catch (error) {
                this.displayChatMessage(`Error: ${error.message}`, 'n', true);
            }
        };
        
        chatSend.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
        
        voiceBtn.addEventListener('click', () => {
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                const recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = false;
                
                recognition.onstart = () => {
                    voiceBtn.style.background = 'var(--warning)';
                };
                
                recognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript;
                    chatInput.value = transcript;
                };
                
                recognition.onend = () => {
                    voiceBtn.style.background = '';
                };
                
                recognition.start();
            } else {
                alert('Speech recognition not supported in this browser');
            }
        });
    }

    setupTerminal() {
        const terminalInput = document.getElementById('terminal-input');
        
        const execute = async () => {
            const command = terminalInput.value.trim();
            if (!command) return;
            
            this.addTerminalLine(`n:~$ ${command}`);
            terminalInput.value = '';
            
            if (command === 'clear') {
                document.getElementById('terminal-output').innerHTML = '';
                return;
            }
            
            if (this.ws && this.isConnected) {
                this.ws.send(JSON.stringify({ type: 'command', command }));
            } else {
                try {
                    const response = await fetch(`${this.apiBase}/command`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ command })
                    });
                    const data = await response.json();
                    this.displayTerminalResult(data);
                } catch (error) {
                    this.addTerminalLine(`Error: ${error.message}`, true);
                }
            }
        };
        
        terminalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') execute();
        });
    }

    setupSystem() {
        document.getElementById('cpu-usage').innerHTML = '<div class="loading">Loading...</div>';
        document.getElementById('memory-usage').innerHTML = '<div class="loading">Loading...</div>';
        document.getElementById('disk-usage').innerHTML = '<div class="loading">Loading...</div>';
    }

    setupFiles() {
        const fileRead = document.getElementById('file-read');
        const fileUpload = document.getElementById('file-upload');
        const fileUploadInput = document.getElementById('file-upload-input');
        
        fileRead.addEventListener('click', async () => {
            const path = document.getElementById('file-path').value;
            try {
                const response = await fetch(`${this.apiBase}/file/read`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command: path })
                });
                const data = await response.json();
                document.getElementById('file-content').textContent = data.success 
                    ? data.content 
                    : `Error: ${data.error}`;
            } catch (error) {
                document.getElementById('file-content').textContent = `Error: ${error.message}`;
            }
        });
        
        fileUpload.addEventListener('click', () => fileUploadInput.click());
        
        fileUploadInput.addEventListener('change', async () => {
            const file = fileUploadInput.files[0];
            if (!file) return;
            
            const path = document.getElementById('file-path').value || `/tmp/${file.name}`;
            const formData = new FormData();
            formData.append('file', file);
            formData.append('path', path);
            
            try {
                const response = await fetch(`${this.apiBase}/file/write?path=${encodeURIComponent(path)}`, {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                document.getElementById('file-content').textContent = data.success
                    ? `File uploaded successfully to ${path}\nSize: ${data.size} bytes`
                    : `Error: ${data.error}`;
            } catch (error) {
                document.getElementById('file-content').textContent = `Error: ${error.message}`;
            }
        });
    }

    setupTTS() {
        const ttsToggle = document.getElementById('tts-toggle');
        if (!ttsToggle) return;
        
        ttsToggle.addEventListener('click', () => {
            this.ttsEnabled = !this.ttsEnabled;
            ttsToggle.style.background = this.ttsEnabled 
                ? 'linear-gradient(135deg, #00ff88, #00d4ff)' 
                : '';
            ttsToggle.textContent = this.ttsEnabled ? '🔇' : '🔊';
        });
    }

    async speakText(text) {
        if (!this.ttsEnabled) return;
        
        const cleanText = text.replace(/[`*_~]/g, '').substring(0, 500);
        if (!cleanText) return;
        
        try {
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(cleanText);
                utterance.rate = 1.0;
                utterance.pitch = 0.9;
                utterance.volume = 1.0;
                
                const voices = speechSynthesis.getVoices();
                const preferredVoice = voices.find(voice => 
                    voice.lang.startsWith('en') && voice.name.includes('Google')
                ) || voices.find(voice => voice.lang.startsWith('en'));
                if (preferredVoice) utterance.voice = preferredVoice;
                
                speechSynthesis.cancel();
                speechSynthesis.speak(utterance);
            }
        } catch (error) {
            console.error('TTS error:', error);
        }
    }

    displayChatMessage(message, sender, isError = false) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender === 'user' ? 'user-message' : 'n-message'} ${isError ? 'error-message' : ''}`;
        
        const speakerButton = this.speakerButtonEnabled ? 
            `<button class="speak-btn" data-message="${this.escapeHtml(message)}">🔊</button>` : '';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${sender === 'user' ? 'U' : 'n'}</div>
            <div class="message-content">
                <p>${this.escapeHtml(message)}</p>
                ${sender === 'n' ? speakerButton : ''}
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        if (sender === 'n' && this.ttsEnabled) {
            this.speakText(message);
        }
        
        const speakBtn = messageDiv.querySelector('.speak-btn');
        if (speakBtn) {
            speakBtn.addEventListener('click', () => {
                this.speakText(speakBtn.dataset.message);
            });
        }
    }

    addTerminalLine(text, isError = false) {
        const output = document.getElementById('terminal-output');
        const line = document.createElement('div');
        line.className = `terminal-line ${isError ? 'error-message' : ''}`;
        line.textContent = text;
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }

    displayTerminalResult(result) {
        if (result.stdout) {
            this.addTerminalLine(result.stdout);
        }
        if (result.stderr) {
            this.addTerminalLine(result.stderr, true);
        }
        if (!result.success && !result.stderr) {
            this.addTerminalLine(`Command failed with code ${result.return_code}`, true);
        }
    }

    async executeCommand(command) {
        try {
            const response = await fetch(`${this.apiBase}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command })
            });
            const data = await response.json();
            this.displayTerminalResult(data);
        } catch (error) {
            this.addTerminalLine(`Error: ${error.message}`, true);
        }
    }

    async refreshSystemInfo() {
        try {
            const response = await fetch(`${this.apiBase}/status`);
            const data = await response.json();
            this.updateSystemInfo(data.system);
            
            if (this.currentSection === 'system') {
                this.loadProcesses();
                this.loadPackages();
            }
        } catch (error) {
            console.error('Failed to refresh system info:', error);
        }
    }

    updateSystemInfo(info) {
        if (!info) return;
        
        document.getElementById('system-info').innerHTML = `
            <div>OS: ${info.os} ${info.os_version}</div>
            <div>Architecture: ${info.architecture}</div>
            <div>Hostname: ${info.hostname}</div>
            <div>CPU Cores: ${info.cpu_count}</div>
            <div>Uptime: ${info.uptime}</div>
        `;
        
        document.getElementById('cpu-usage').innerHTML = `
            <div>Usage: ${psutil?.cpu_percent() || 'N/A'}%</div>
            <div>Cores: ${info.cpu_count}</div>
        `;
        
        document.getElementById('memory-usage').innerHTML = `
            <div>Total: ${info.memory.total} GB</div>
            <div>Available: ${info.memory.available} GB</div>
            <div>Used: ${info.memory.percent}%</div>
        `;
        
        document.getElementById('disk-usage').innerHTML = `
            <div>Total: ${info.disk.total} GB</div>
            <div>Available: ${info.disk.available} GB</div>
            <div>Used: ${info.disk.percent}%</div>
        `;
    }

    async loadProcesses() {
        try {
            const response = await fetch(`${this.apiBase}/processes`);
            const data = await response.json();
            const container = document.getElementById('processes-list');
            
            container.innerHTML = data.processes.slice(0, 20).map(proc => `
                <div class="process-item">
                    <span>${proc.name}</span>
                    <span>PID: ${proc.pid}</span>
                    <span>CPU: ${proc.cpu_percent.toFixed(1)}%</span>
                    <span>MEM: ${proc.memory_percent.toFixed(1)}%</span>
                </div>
            `).join('');
        } catch (error) {
            document.getElementById('processes-list').textContent = 'Failed to load';
        }
    }

    async loadPackages() {
        try {
            const response = await fetch(`${this.apiBase}/packages`);
            const data = await response.json();
            document.getElementById('packages-count').innerHTML = `
                <div>Total Packages: ${data.count}</div>
            `;
        } catch (error) {
            document.getElementById('packages-count').textContent = 'Failed to load';
        }
    }

    updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        document.getElementById('current-time').textContent = timeString;
    }

    extractCommands(text) {
        const commands = [];
        const regex = /```bash\n([\s\S]*?)```/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            commands.push(match[1].trim());
        }
        return commands;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const psutil = typeof window !== 'undefined' ? null : null;
const n = new nAssistant();
