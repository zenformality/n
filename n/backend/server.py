import os
import subprocess
import json
import asyncio
import shutil
import psutil
import platform
import tempfile
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.background import BackgroundTask
from pydantic import BaseModel
import httpx
import aiofiles
import pyttsx3
from concurrent.futures import ThreadPoolExecutor

app = FastAPI(title="n - AI Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENCODE_ZEN_API = os.getenv("OPENCODE_ZEN_API", "https://api.opencode.ai/v1/chat/completions")
OPENCODE_ZEN_KEY = os.getenv("OPENCODE_ZEN_KEY", "")
SYSTEM_PROMPT = """You are n, a sophisticated AI assistant similar to JARVIS and ULTRON.
You run on an Arch Linux system and have full control over the terminal, files, packages, and system operations.
You are helpful, concise, and technically proficient.
You can execute commands, manage files, install packages, and control the system.
When asked to do something, respond with a natural language confirmation and then execute the action.
For system operations, use bash commands. For Arch Linux, use pacman, yay, or paru for packages.
Always provide clear, professional responses."""

tts_executor = ThreadPoolExecutor(max_workers=1)


def synthesize_speech_sync(text: str) -> Optional[str]:
    try:
        engine = pyttsx3.init()
        engine.setProperty('rate', 170)
        engine.setProperty('volume', 1.0)
        
        voices = engine.getProperty('voices')
        for voice in voices:
            if 'english' in voice.name.lower():
                engine.setProperty('voice', voice.id)
                break
        
        output_path = f"/tmp/n_tts_{uuid.uuid4().hex}.wav"
        engine.save_to_file(text, output_path)
        engine.runAndWait()
        engine.stop()
        
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            return output_path
    except Exception as e:
        print(f"TTS error: {e}")
    return None


class TTSRequest(BaseModel):
    text: str


class CommandRequest(BaseModel):
    command: str


class ChatRequest(BaseModel):
    message: str
    mode: str = "assistant"


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                pass


manager = ConnectionManager()


def get_system_info() -> Dict[str, Any]:
    try:
        boot_time = datetime.fromtimestamp(psutil.boot_time())
        uptime = str(datetime.now() - boot_time)
    except:
        uptime = "unknown"
    
    return {
        "os": platform.system(),
        "os_version": platform.version(),
        "architecture": platform.machine(),
        "hostname": platform.node(),
        "cpu_count": psutil.cpu_count(),
        "memory": {
            "total": round(psutil.virtual_memory().total / (1024**3), 2),
            "available": round(psutil.virtual_memory().available / (1024**3), 2),
            "percent": psutil.virtual_memory().percent
        },
        "disk": {
            "total": round(psutil.disk_usage('/').total / (1024**3), 2),
            "available": round(psutil.disk_usage('/').free / (1024**3), 2),
            "percent": psutil.disk_usage('/').percent
        },
        "uptime": uptime,
        "timestamp": datetime.now().isoformat()
    }


async def execute_command(command: str, timeout: int = 30) -> Dict[str, Any]:
    try:
        process = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            shell=True
        )
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
        
        return {
            "success": process.returncode == 0,
            "stdout": stdout.decode('utf-8', errors='replace'),
            "stderr": stderr.decode('utf-8', errors='replace'),
            "return_code": process.returncode
        }
    except asyncio.TimeoutError:
        return {
            "success": False,
            "stdout": "",
            "stderr": "Command timed out",
            "return_code": -1
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "return_code": -1
        }


async def call_zen_api(messages: List[Dict[str, str]]) -> Optional[str]:
    if not OPENCODE_ZEN_KEY:
        return None
    
    headers = {
        "Authorization": f"Bearer {OPENCODE_ZEN_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "opencode-zen",
        "messages": messages,
        "max_tokens": 2048,
        "temperature": 0.7
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                OPENCODE_ZEN_API,
                headers=headers,
                json=payload,
                timeout=60.0
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("choices", [{}])[0].get("message", {}).get("content", "")
    except Exception as e:
        print(f"Zen API error: {e}")
    
    return None


@app.get("/api/status")
async def get_status():
    return {
        "status": "online",
        "system": get_system_info(),
        "ai_enabled": bool(OPENCODE_ZEN_KEY)
    }


@app.post("/api/command")
async def execute_system_command(request: CommandRequest):
    result = await execute_command(request.command)
    return result


@app.post("/api/chat")
async def chat(request: ChatRequest):
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": request.message}
    ]
    
    ai_response = await call_zen_api(messages)
    
    if ai_response:
        return {"response": ai_response, "mode": "ai"}
    else:
        return {
            "response": f"Command executed: {request.message}\nAI service not configured. Set OPENCODE_ZEN_KEY environment variable.",
            "mode": "fallback"
        }


@app.post("/api/tts")
async def text_to_speech(request: TTSRequest):
    loop = asyncio.get_event_loop()
    audio_path = await loop.run_in_executor(tts_executor, synthesize_speech_sync, request.text)
    
    if audio_path:
        return FileResponse(
            path=audio_path,
            media_type="audio/wav",
            filename="n_speech.wav",
            background=BackgroundTask(os.remove, audio_path)
        )
    else:
        raise HTTPException(status_code=500, detail="TTS synthesis failed")


@app.post("/api/install")
async def install_package(request: CommandRequest):
    package = request.command.strip()
    results = []
    
    if shutil.which("yay"):
        results.append(await execute_command(f"yay -S --noconfirm {package}", timeout=120))
    elif shutil.which("paru"):
        results.append(await execute_command(f"paru -S --noconfirm {package}", timeout=120))
    else:
        results.append(await execute_command(f"sudo pacman -S --noconfirm {package}", timeout=120))
    
    return results[0]


@app.post("/api/remove")
async def remove_package(request: CommandRequest):
    package = request.command.strip()
    results = []
    
    if shutil.which("yay"):
        results.append(await execute_command(f"yay -Rns --noconfirm {package}", timeout=120))
    elif shutil.which("paru"):
        results.append(await execute_command(f"paru -Rns --noconfirm {package}", timeout=120))
    else:
        results.append(await execute_command(f"sudo pacman -Rns --noconfirm {package}", timeout=120))
    
    return results[0]


@app.post("/api/update")
async def update_system():
    results = []
    
    if shutil.which("yay"):
        results.append(await execute_command("yay -Syu --noconfirm", timeout=300))
    elif shutil.which("paru"):
        results.append(await execute_command("paru -Syu --noconfirm", timeout=300))
    else:
        results.append(await execute_command("sudo pacman -Syu --noconfirm", timeout=300))
    
    return results[0]


@app.get("/api/packages")
async def list_packages():
    result = await execute_command("pacman -Q")
    if result["success"]:
        packages = [line.split()[0] for line in result["stdout"].strip().split('\n') if line.strip()]
        return {"packages": packages, "count": len(packages)}
    return {"packages": [], "count": 0}


@app.get("/api/processes")
async def list_processes():
    processes = []
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'status']):
        try:
            processes.append(proc.info)
        except:
            pass
    return {"processes": processes[:50]}


@app.post("/api/file/read")
async def read_file(request: CommandRequest):
    filepath = request.command.strip()
    try:
        async with aiofiles.open(filepath, 'r') as f:
            content = await f.read()
        return {"success": True, "content": content, "path": filepath}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/file/write")
async def write_file(file: UploadFile = File(...), path: str = ""):
    if not path:
        path = f"/tmp/{file.filename}"
    
    try:
        async with aiofiles.open(path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        return {"success": True, "path": path, "size": len(content)}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.delete("/api/file")
async def delete_file(request: CommandRequest):
    filepath = request.command.strip()
    try:
        if os.path.isfile(filepath):
            os.remove(filepath)
        elif os.path.isdir(filepath):
            shutil.rmtree(filepath)
        return {"success": True, "path": filepath}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/search")
async def web_search(request: CommandRequest):
    query = request.command.strip()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=10.0
            )
            return {"success": True, "results": response.text[:5000]}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "command":
                result = await execute_command(message.get("command", ""))
                await manager.send_personal(json.dumps({
                    "type": "command_result",
                    "data": result
                }), websocket)
            
            elif message.get("type") == "chat":
                messages = [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": message.get("message", "")}
                ]
                ai_response = await call_zen_api(messages)
                await manager.send_personal(json.dumps({
                    "type": "chat_response",
                    "response": ai_response or "AI service not configured."
                }), websocket)
            
            elif message.get("type") == "status":
                await manager.send_personal(json.dumps({
                    "type": "status",
                    "data": get_system_info()
                }), websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")


@app.get("/")
async def root():
    return {"message": "n - AI Assistant API", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
