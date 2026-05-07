"""
Batch transcription — Groq Whisper (primary) with Soniox fallback on 429.

Run with the main chat_stream.py server - this module provides the transcription router.
"""

import json
import os
import asyncio
import httpx

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from auth import check_credits
from groq import Groq

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SONIOX_API_KEY = os.getenv("SONIOX_API_KEY")
SONIOX_API_BASE_URL = "https://api.soniox.com"

# TEMP: set to True to test Soniox fallback without hitting Groq.
FORCE_SONIOX_FALLBACK = True

import time as _time
_groq_backoff_until = 0.0

router = APIRouter()


def _is_special_token(text: str) -> bool:
    special_tokens = {"<end>", "<start>", "<unk>", "<silence>"}
    return text.strip() in special_tokens or (text.startswith("<") and text.endswith(">"))


async def _transcribe_soniox(audio_data: bytes, filename: str, language: str) -> dict:
    """Fallback transcription via Soniox."""
    if not SONIOX_API_KEY:
        raise HTTPException(status_code=500, detail="Soniox fallback not configured")

    print("Falling back to Soniox transcription...")

    async with httpx.AsyncClient(timeout=120.0) as client:
        headers = {"Authorization": f"Bearer {SONIOX_API_KEY}"}

        upload_response = await client.post(
            f"{SONIOX_API_BASE_URL}/v1/files",
            headers=headers,
            files={"file": (filename, audio_data, "audio/wav")},
        )
        if upload_response.status_code not in (200, 201):
            print(f"Soniox file upload error: {upload_response.status_code} - {upload_response.text}")
            raise HTTPException(status_code=502, detail="Transcription service unavailable")

        file_id = upload_response.json().get("id")

        transcription_response = await client.post(
            f"{SONIOX_API_BASE_URL}/v1/transcriptions",
            headers={**headers, "Content-Type": "application/json"},
            json={
                "model": "stt-async-v4",
                "file_id": file_id,
                "language_hints": [language],
                "language_hints_strict": True,
            },
        )
        if transcription_response.status_code not in (200, 201):
            print(f"Soniox transcription create error: {transcription_response.status_code}")
            await client.delete(f"{SONIOX_API_BASE_URL}/v1/files/{file_id}", headers=headers)
            raise HTTPException(status_code=502, detail="Transcription failed")

        transcription_id = transcription_response.json().get("id")

        for _ in range(60):
            status_response = await client.get(
                f"{SONIOX_API_BASE_URL}/v1/transcriptions/{transcription_id}",
                headers=headers,
            )
            status_data = status_response.json()
            status = status_data.get("status")

            if status == "completed":
                break
            elif status == "error":
                await client.delete(f"{SONIOX_API_BASE_URL}/v1/transcriptions/{transcription_id}", headers=headers)
                await client.delete(f"{SONIOX_API_BASE_URL}/v1/files/{file_id}", headers=headers)
                raise HTTPException(status_code=502, detail="Transcription failed")
            await asyncio.sleep(1)
        else:
            await client.delete(f"{SONIOX_API_BASE_URL}/v1/transcriptions/{transcription_id}", headers=headers)
            await client.delete(f"{SONIOX_API_BASE_URL}/v1/files/{file_id}", headers=headers)
            raise HTTPException(status_code=504, detail="Transcription request timed out")

        transcript_response = await client.get(
            f"{SONIOX_API_BASE_URL}/v1/transcriptions/{transcription_id}/transcript",
            headers=headers,
        )
        if transcript_response.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to retrieve transcript")

        result = transcript_response.json()
        print(f"Soniox response: {json.dumps(result, indent=2)}")

        await client.delete(f"{SONIOX_API_BASE_URL}/v1/transcriptions/{transcription_id}", headers=headers)
        await client.delete(f"{SONIOX_API_BASE_URL}/v1/files/{file_id}", headers=headers)

        transcript_parts = []
        words = []

        if "tokens" in result:
            for token in result["tokens"]:
                text = token.get("text", "")
                if text and not _is_special_token(text):
                    transcript_parts.append(text)
                    word_info = {
                        "word": text,
                        "start": token.get("start_ms", 0) / 1000.0,
                        "end": token.get("end_ms", 0) / 1000.0,
                        "confidence": token.get("confidence", 1.0),
                    }
                    if token.get("language"):
                        word_info["language"] = token.get("language")
                    words.append(word_info)
        elif "words" in result:
            for word_data in result["words"]:
                text = word_data.get("text", word_data.get("word", ""))
                if text and not _is_special_token(text):
                    transcript_parts.append(text)
                    words.append({
                        "word": text,
                        "start": word_data.get("start_ms", word_data.get("start", 0)) / 1000.0 if "start_ms" in word_data else word_data.get("start", 0),
                        "end": word_data.get("end_ms", word_data.get("end", 0)) / 1000.0 if "end_ms" in word_data else word_data.get("end", 0),
                        "confidence": word_data.get("confidence", 1.0),
                    })
        elif "text" in result:
            transcript_parts.append(result["text"])
        elif "transcript" in result:
            transcript_parts.append(result["transcript"])

        transcript = "".join(transcript_parts).strip()

        confidence = 0.0
        if words:
            confidences = [w.get("confidence", 1.0) for w in words]
            confidence = sum(confidences) / len(confidences)

        return {
            "transcript": transcript,
            "confidence": confidence,
            "words": words,
        }


# @router.post("/api/test_transcribe")  # TEMP: no-auth route for rate limit testing (remove after testing)
# async def test_transcribe_audio(file: UploadFile = File(...), language: str = "es"):
#     return await transcribe_audio(file=file, language=language, user_id="test")


@router.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...), language: str = "es", user_id: str = Depends(check_credits)):
    try:
        audio_data = await file.read()
        if len(audio_data) == 0:
            raise HTTPException(status_code=400, detail="Empty audio file")

        filename = file.filename or "audio.wav"
        print(f"Received audio file: {filename}, size: {len(audio_data)} bytes")

        global _groq_backoff_until

        if FORCE_SONIOX_FALLBACK:
            print("FORCE_SONIOX_FALLBACK enabled, using Soniox directly")
            result = await _transcribe_soniox(audio_data, filename, language)
            return JSONResponse(result)

        # If we're in backoff period, skip Groq entirely
        if _time.time() < _groq_backoff_until:
            remaining = int(_groq_backoff_until - _time.time())
            print(f"Groq in backoff ({remaining}s remaining), using Soniox directly")
            result = await _transcribe_soniox(audio_data, filename, language)
            return JSONResponse(result)

        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail="Transcription service is not configured")

        try:
            client = Groq(api_key=GROQ_API_KEY, max_retries=0)
            result = client.audio.transcriptions.create(
                file=(filename, audio_data, file.content_type or "audio/wav"),
                model="whisper-large-v3-turbo",
                temperature=0.0,
                response_format="verbose_json",
                timestamp_granularities=["word"],
            )
            raw = result.model_dump() if hasattr(result, "model_dump") else result
            print(f"Groq response: {json.dumps(raw, indent=2, default=str)}")

            transcript = raw.get("text", "")
            words = []
            if raw.get("words"):
                for w in raw["words"]:
                    words.append({
                        "word": w["word"],
                        "start": w["start"],
                        "end": w["end"],
                        "confidence": 1.0,
                    })
            return JSONResponse({
                "transcript": transcript,
                "confidence": 1.0,
                "words": words,
            })

        except Exception as groq_err:
            err_str = str(groq_err).lower()
            if "429" in err_str or "rate" in err_str:
                if "minute" in err_str:
                    backoff = 60
                elif "hour" in err_str:
                    backoff = 3600
                else:
                    backoff = 3600
                print(f"Groq rate limited: {groq_err}")
                print(f"Groq backoff set for {backoff}s")
                _groq_backoff_until = _time.time() + backoff
                result = await _transcribe_soniox(audio_data, filename, language)
                return JSONResponse(result)
            raise

    except HTTPException:
        raise
    except Exception as e:
        print(f"Groq transcription error: {e}, trying Soniox fallback...")
        try:
            result = await _transcribe_soniox(audio_data, filename, language)
            return JSONResponse(result)
        except Exception as soniox_err:
            print(f"Soniox fallback also failed: {soniox_err}")
            raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
