# tts_service/app.py
import os
import uuid
import hashlib
import asyncio
import logging
from pathlib import Path
from typing import Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from shutil import which

# Load env (back.env placed at BackEnd/back.env)
env_path = Path(__file__).resolve().parent.parent / "back.env"
load_dotenv(dotenv_path=env_path)

# ----- Defaults (safe) -----
BASE_DIR = Path(__file__).resolve().parent
DEFAULT_MODELS_DIR = BASE_DIR / "models"
DEFAULT_OUTPUT_DIR = BASE_DIR / "output"
DEFAULT_PIPER_BIN = str(BASE_DIR / "piper" / "piper.exe")
DEFAULT_MAX_CONCURRENT = 2

print("BASE DIR: ", BASE_DIR)
print("DEFAULT_MODELS_DIR: ", DEFAULT_MODELS_DIR)
print("DEFAULT_OUTPUT_DIR: ", DEFAULT_OUTPUT_DIR)
print("DEFAULT_PIPER_BIN: ", DEFAULT_PIPER_BIN)
# ----- Configuration (use env vars if present; otherwise defaults) -----
# PIPER_BIN = os.environ.get("PIPER_BIN") or DEFAULT_PIPER_BIN
# PIPER_MODELS_DIR = Path(os.environ.get("PIPER_MODELS_DIR") or DEFAULT_MODELS_DIR)
# DEFAULT_MODEL = os.environ.get("PIPER_DEFAULT_MODEL", "en_US-lessac-medium.onnx")
# OUTPUT_DIR = Path(os.environ.get("PIPER_OUTPUT_DIR") or DEFAULT_OUTPUT_DIR)
# LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
PIPER_BIN = DEFAULT_PIPER_BIN
PIPER_MODELS_DIR = Path(DEFAULT_MODELS_DIR)
DEFAULT_MODEL = os.environ.get("PIPER_DEFAULT_MODEL", "en_US-lessac-medium.onnx")
OUTPUT_DIR = Path(DEFAULT_OUTPUT_DIR)
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()

try:
    MAX_CONCURRENT_PIPER = int(os.environ.get("PIPER_MAX_CONCURRENT") or DEFAULT_MAX_CONCURRENT)
except ValueError:
    MAX_CONCURRENT_PIPER = DEFAULT_MAX_CONCURRENT

# Ensure output dir exists
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
PIPER_MODELS_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=LOG_LEVEL)
logger = logging.getLogger("tts_service")

app = FastAPI(title="Piper TTS Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

semaphore = asyncio.Semaphore(MAX_CONCURRENT_PIPER)

class TTSRequest(BaseModel):
    text: str
    model: Optional[str] = None

def find_piper_binary():
    """
    Strategy:
      1) If PIPER_BIN env was provided and exists -> use it.
      2) Check local packaged binary: tts_service/piper/(piper.exe or piper)
      3) Fallback to system PATH which (looks for 'piper').
    """
    # 1) explicit env
    if PIPER_BIN:
        try:
            p = Path(PIPER_BIN)
            if p.exists():
                return str(p)
        except Exception:
            pass

    # 2) local packaged binary (tts_service/piper/piper.exe)
    exe_name = "piper.exe" if os.name == "nt" else "piper"
    local = Path(__file__).resolve().parent / "piper" / exe_name
    if local.exists():
        return str(local)

    # 3) system PATH
    found = which("piper")
    if found:
        return found

    return None

@app.get("/health")
async def health():
    piper_found = bool(find_piper_binary())
    return {
        "ok": True,
        "piper": piper_found,
        "piper_bin": find_piper_binary(),
        "models_dir": str(PIPER_MODELS_DIR),
        "default_model": DEFAULT_MODEL,
    }

@app.post("/synthesize")
async def synthesize(req: TTSRequest):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text must be provided")

    model_file = req.model or DEFAULT_MODEL
    model_path = PIPER_MODELS_DIR / model_file
    if not model_path.exists():
        raise HTTPException(status_code=500, detail=f"model not found: {model_path}")

    piper_bin = find_piper_binary()
    if not piper_bin:
        raise HTTPException(status_code=500, detail="piper binary not found in PATH or PIPER_BIN or tts_service/piper")

    # Cache key (deterministic)
    key = hashlib.sha256((model_file + "::" + text).encode("utf8")).hexdigest()
    out_name = f"tts_{key}.wav"
    out_path = OUTPUT_DIR / out_name
    if out_path.exists():
        logger.info("Cache hit for text (model=%s)", model_file)
        return FileResponse(str(out_path), media_type="audio/wav", filename=out_name)

    # Build command
    cmd = [piper_bin, "--model", str(model_path), "--output_file", str(out_path)]
    logger.info("Calling piper: %s (model=%s)", piper_bin, model_file)

    async with semaphore:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate(input=text.encode("utf-8"))
        rc = process.returncode

    if rc != 0:
        stderr_snip = stderr.decode(errors="ignore")[:1000]
        logger.error("Piper failed rc=%s stderr=%s", rc, stderr_snip)
        raise HTTPException(status_code=500, detail=f"Piper failed: rc={rc} stderr={stderr_snip}")

    if not out_path.exists():
        raise HTTPException(status_code=500, detail="Piper did not produce output file")

    return FileResponse(str(out_path), media_type="audio/wav", filename=out_name)
