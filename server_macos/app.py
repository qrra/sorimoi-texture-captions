from __future__ import annotations

import os
import platform
import sys
import threading
import time
import importlib.util

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

CLIENT_HEADER = "sorimoi-browser-v1"
SAMPLE_RATE = 16_000
MAX_SAMPLES = SAMPLE_RATE * 8
MODEL_ID = os.environ.get("SORIMOI_MLX_MODEL", "mlx-community/whisper-base-mlx")
_model_lock = threading.Lock()
_available = (sys.platform == "darwin" and platform.machine().lower() in {"arm64", "aarch64"}
              and importlib.util.find_spec("mlx_whisper") is not None)

app = FastAPI(title="Sorimoi local speech accelerator", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"chrome-extension://[a-p]{32}",
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Sorimoi-Client", "X-Sample-Rate", "X-Language"],
)


def verify_client(request: Request) -> None:
    origin = request.headers.get("origin", "")
    if request.headers.get("x-sorimoi-client") != CLIENT_HEADER:
        raise HTTPException(403, "소리모이 확장 요청만 허용합니다.")
    if not origin.startswith("chrome-extension://") or len(origin) > 100:
        raise HTTPException(403, "확장 프로그램 출처를 확인할 수 없습니다.")


@app.get("/health")
async def health(request: Request):
    verify_client(request)
    return {"ready": _available, "engine": "mlx-whisper", "model": MODEL_ID if _available else None}


@app.post("/api/transcribe-chunk")
async def transcribe_chunk(request: Request):
    verify_client(request)
    if not _available:
        raise HTTPException(503, "Apple Silicon macOS에서만 사용할 수 있습니다.")
    if request.headers.get("x-sample-rate") != str(SAMPLE_RATE):
        raise HTTPException(415, "16kHz 오디오만 처리합니다.")
    language = request.headers.get("x-language", "ko")
    if language not in {"ko", "en", "auto"}:
        raise HTTPException(400, "지원하지 않는 언어입니다.")
    content_length = request.headers.get("content-length", "0")
    if not content_length.isdigit() or int(content_length) > MAX_SAMPLES * 4:
        raise HTTPException(413, "8초 이하의 Float32 PCM만 처리합니다.")
    body = await request.body()
    if len(body) % 4 or len(body) > MAX_SAMPLES * 4:
        raise HTTPException(413, "8초 이하의 Float32 PCM만 처리합니다.")
    audio = np.frombuffer(body, dtype="<f4")
    if not 1 <= audio.size <= MAX_SAMPLES or not np.isfinite(audio).all():
        raise HTTPException(400, "오디오 구간이 비었거나 잘못되었습니다.")
    started = time.perf_counter()
    try:
        import mlx_whisper

        # MLX Whisper keeps its model holder cached; serialize calls to avoid
        # overlapping GPU work from repeated short audio windows.
        with _model_lock:
            result = mlx_whisper.transcribe(
                audio,
                path_or_hf_repo=MODEL_ID,
                language=None if language == "auto" else language,
                word_timestamps=True,
                condition_on_previous_text=False,
                temperature=0.0,
                beam_size=1,
                verbose=False,
            )
    except Exception as error:
        raise HTTPException(503, f"MLX Whisper 분석 실패: {type(error).__name__}") from error
    words = []
    for segment in result.get("segments", []):
        for word in segment.get("words") or []:
            start, end = word.get("start"), word.get("end")
            text = str(word.get("word", "")).strip()
            if isinstance(start, (int, float)) and isinstance(end, (int, float)) and end > start and text:
                words.append({"text": text, "timestamp": [float(start), float(end)]})
    return {
        "text": str(result.get("text", "")).strip(),
        "chunks": words[:100],
        "duration": audio.size / SAMPLE_RATE,
        "elapsed_ms": round((time.perf_counter() - started) * 1000),
        "engine": "mlx-whisper",
        "model": MODEL_ID,
    }
