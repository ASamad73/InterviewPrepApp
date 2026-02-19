# stt_service/app.py
from logging import config
import os
import uuid
import shutil
import tempfile
import logging
from pathlib import Path
from typing import Optional
from concurrent.futures import ThreadPoolExecutor
import asyncio
from dotenv import load_dotenv

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from pydantic import BaseModel

# faster-whisper import (ensure installed in your venv)
from faster_whisper import WhisperModel

env_path = Path(__file__).resolve().parent.parent / "back.env"

load_dotenv(dotenv_path=env_path)

# Configuration via env
MODEL_SIZE = os.environ.get("WHISPER_MODEL", "small")  # tiny/base/small/medium/large
print("Model size is: ", MODEL_SIZE)
DEVICE = os.environ.get("WHISPER_DEVICE")       # "cuda" for GPU
MAX_UPLOAD_MB = int(os.environ.get("STT_MAX_UPLOAD_MB"))  # max upload size in MB
WORKERS = int(os.environ.get("STT_WORKERS"))  # threadpool workers for transcription

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=LOG_LEVEL)
logger = logging.getLogger("stt_service")

app = FastAPI(title="STT Service - faster-whisper")

# initialize model once (can be heavy)
logger.info("Loading Whisper model %s on device %s", MODEL_SIZE, DEVICE)
model = WhisperModel(MODEL_SIZE, device=DEVICE)

# threadpool for CPU-bound transcription
executor = ThreadPoolExecutor(max_workers=WORKERS)

class TranscribeResponse(BaseModel):
    text: str
    segments: list
    model: str
    device: str

@app.get("/health")
async def health():
    return {"ok": True, "model": MODEL_SIZE, "device": DEVICE}

@app.get("/info")
async def info():
    return {"model": MODEL_SIZE, "device": DEVICE}

# helper: run transcribe in threadpool
def _transcribe_sync(in_path: str, language: Optional[str], task: str):
    # model.transcribe can be CPU heavy; run in threadpool
    segments, info = model.transcribe(in_path, language=language, task=task)
    text = " ".join([s.text.strip() for s in segments]).strip()
    segs = [{"start": s.start, "end": s.end, "text": s.text} for s in segments]
    return {"text": text, "segments": segs, "model_info": info._asdict() if hasattr(info, "_asdict") else str(info)}

@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(file: UploadFile = File(...), language: Optional[str] = Form(None), task: Optional[str] = Form("transcribe")):
    """
    Accepts uploaded audio file (webm/mp3/wav). Converts nothing here (ffmpeg conversion can be done elsewhere).
    - task: "transcribe" or "translate"
    """
    # basic size guard on in-memory file (UploadFile streams to disk though)
    # we still write to a tmp file to preserve filename
    tmpdir = tempfile.mkdtemp(prefix="stt_")
    in_path = os.path.join(tmpdir, f"{uuid.uuid4().hex}_{file.filename}")

    try:
        # save uploaded file to disk
        with open(in_path, "wb") as f:
            content = await file.read()
            size_mb = len(content) / (1024 * 1024)
            if size_mb > MAX_UPLOAD_MB:
                raise HTTPException(status_code=413, detail=f"Upload too large ({size_mb:.1f} MB). Limit: {MAX_UPLOAD_MB} MB")
            f.write(content)

        logger.info("Saved uploaded file to %s (%.2f MB)", in_path, size_mb)

        # run transcription in threadpool to avoid blocking
        loop = asyncio.get_event_loop()
        out = await loop.run_in_executor(executor, _transcribe_sync, in_path, language, task)

        return {"text": out["text"], "segments": out["segments"], "model": MODEL_SIZE, "device": DEVICE}
    except HTTPException:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise
    except Exception as e:
        logger.exception("Transcription error")
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # ensure cleanup
        try:
            if os.path.exists(in_path):
                os.remove(in_path)
            shutil.rmtree(tmpdir, ignore_errors=True)
        except Exception:
            pass
