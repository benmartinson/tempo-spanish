"""
Batch transcription using AssemblyAI API.

This module handles POST endpoint for batch audio file transcription.

Run with the main chat_stream.py server - this module provides the transcription router.
"""

import json
import os
import tempfile

import assemblyai as aai
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from auth import check_credits

# Load environment variables
load_dotenv()

# AssemblyAI configuration
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")

# Create router for transcription endpoints
router = APIRouter()


@router.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...), language: str = "es", user_id: str = Depends(check_credits)):
    """
    Batch transcription endpoint - accepts an audio file and returns the complete transcript.

    Accepts: WAV audio file (16kHz, mono, 16-bit PCM)
    Returns: JSON with transcript and word timings

    Response format:
    {
        "transcript": "the transcribed text",
        "confidence": 0.95,
        "words": [{"word": "hello", "start": 0.0, "end": 0.5, "confidence": 0.95}, ...]
    }
    """
    if not ASSEMBLYAI_API_KEY:
        raise HTTPException(status_code=500, detail="Transcription service is not configured")

    try:
        # Read the uploaded file
        audio_data = await file.read()

        if len(audio_data) == 0:
            raise HTTPException(status_code=400, detail="Empty audio file")

        print(f"Received audio file: {file.filename}, size: {len(audio_data)} bytes")

        aai.settings.api_key = ASSEMBLYAI_API_KEY

        # Write audio to a temp file since AssemblyAI SDK expects a file path
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name

        try:
            config = aai.TranscriptionConfig(
                speech_models=["universal-3-pro"],
                language_code=language,
                prompt="Preserve all disfluencies exactly as spoken including verbal hesitations, restarts, and self-corrections.",
            )

            transcriber = aai.Transcriber(config=config)
            transcript = transcriber.transcribe(tmp_path)
        finally:
            os.unlink(tmp_path)

        if transcript.status == aai.TranscriptStatus.error:
            print(f"AssemblyAI transcription error: {transcript.error}")
            raise HTTPException(status_code=502, detail="Transcription failed")

        print(f"AssemblyAI transcript: {transcript.text}")
        print(f"AssemblyAI words: {json.dumps([{'word': w.text, 'start': w.start, 'end': w.end, 'confidence': w.confidence} for w in (transcript.words or [])], indent=2)}")

        text = transcript.text or ""
        words = []

        if transcript.words:
            for w in transcript.words:
                words.append({
                    "word": w.text,
                    "start": w.start / 1000.0,
                    "end": w.end / 1000.0,
                    "confidence": w.confidence,
                })

        avg_confidence = 0.0
        if words:
            avg_confidence = sum(w["confidence"] for w in words) / len(words)

        return JSONResponse({
            "transcript": text,
            "confidence": avg_confidence,
            "words": words,
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


# ── Groq Whisper (commented out) ─────────────────────────────────────
#
# import json
# import os
# from groq import Groq
#
# GROQ_API_KEY = os.getenv("GROQ_API_KEY")
#
# @router.post("/api/transcribe")
# async def transcribe_audio(file: UploadFile = File(...), language: str = "es", user_id: str = Depends(check_credits)):
#     if not GROQ_API_KEY:
#         raise HTTPException(status_code=500, detail="Transcription service is not configured")
#     try:
#         audio_data = await file.read()
#         if len(audio_data) == 0:
#             raise HTTPException(status_code=400, detail="Empty audio file")
#         print(f"Received audio file: {file.filename}, size: {len(audio_data)} bytes")
#         client = Groq(api_key=GROQ_API_KEY)
#         result = client.audio.transcriptions.create(
#             file=(file.filename or "audio.wav", audio_data, file.content_type or "audio/wav"),
#             model="whisper-large-v3-turbo",
#             language=language,
#             temperature=0.0,
#             response_format="verbose_json",
#             timestamp_granularities=["word"],
#         )
#         raw = result.model_dump() if hasattr(result, "model_dump") else result
#         print(f"Groq response: {json.dumps(raw, indent=2, default=str)}")
#         transcript = raw.get("text", "")
#         words = []
#         if raw.get("words"):
#             for w in raw["words"]:
#                 words.append({
#                     "word": w["word"],
#                     "start": w["start"],
#                     "end": w["end"],
#                     "confidence": 1.0,
#                 })
#         return JSONResponse({
#             "transcript": transcript,
#             "confidence": 1.0,
#             "words": words,
#         })
#     except HTTPException:
#         raise
#     except Exception as e:
#         print(f"Transcription error: {e}")
#         raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
