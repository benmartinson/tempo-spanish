"""
Batch transcription — Groq Whisper (primary) with Soniox fallback on 429.

Run with the main chat_stream.py server - this module provides the transcription router.
"""

import json
import os
import asyncio
import httpx
import math
import struct
import wave
from io import BytesIO

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from auth import deduct_credits, verify_jwt
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


def _read_ebml_vint(data: bytes, offset: int) -> tuple[int, int] | None:
    if offset >= len(data):
        return None

    first = data[offset]
    mask = 0x80
    length = 1
    while length <= 8 and not (first & mask):
        mask >>= 1
        length += 1

    if length > 8 or offset + length > len(data):
        return None

    value = first & (mask - 1)
    for index in range(1, length):
        value = (value << 8) | data[offset + index]

    return value, length


def _read_webm_element_payload(data: bytes, element_id: bytes) -> bytes | None:
    offset = data.find(element_id)
    while offset >= 0:
        size_offset = offset + len(element_id)
        size = _read_ebml_vint(data, size_offset)
        if size:
            payload_size, size_length = size
            payload_start = size_offset + size_length
            payload_end = payload_start + payload_size
            if payload_end <= len(data):
                return data[payload_start:payload_end]
        offset = data.find(element_id, offset + 1)
    return None


def _get_webm_duration_seconds(audio_data: bytes) -> float | None:
    duration_payload = _read_webm_element_payload(audio_data, b"\x44\x89")
    if not duration_payload:
        return None

    timecode_scale_payload = _read_webm_element_payload(audio_data, b"\x2a\xd7\xb1")
    timecode_scale = (
        int.from_bytes(timecode_scale_payload, "big")
        if timecode_scale_payload
        else 1_000_000
    )

    if len(duration_payload) == 4:
        duration_units = struct.unpack(">f", duration_payload)[0]
    elif len(duration_payload) == 8:
        duration_units = struct.unpack(">d", duration_payload)[0]
    else:
        return None

    return float(duration_units) * timecode_scale / 1_000_000_000


def _get_wav_duration_seconds(audio_data: bytes) -> float | None:
    try:
        with wave.open(BytesIO(audio_data), "rb") as wav:
            frame_rate = wav.getframerate()
            if frame_rate <= 0:
                return None
            return wav.getnframes() / float(frame_rate)
    except Exception:
        return None


def _get_mp3_duration_seconds(audio_data: bytes) -> float | None:
    offset = 0
    if audio_data.startswith(b"ID3") and len(audio_data) >= 10:
        size = (
            ((audio_data[6] & 0x7F) << 21)
            | ((audio_data[7] & 0x7F) << 14)
            | ((audio_data[8] & 0x7F) << 7)
            | (audio_data[9] & 0x7F)
        )
        offset = 10 + size

    sample_rates = {
        0b11: [44100, 48000, 32000],
        0b10: [22050, 24000, 16000],
        0b00: [11025, 12000, 8000],
    }
    samples_per_frame = {
        (0b11, 0b01): 384,
        (0b11, 0b10): 1152,
        (0b11, 0b11): 1152,
        (0b10, 0b01): 384,
        (0b10, 0b10): 1152,
        (0b10, 0b11): 576,
        (0b00, 0b01): 384,
        (0b00, 0b10): 1152,
        (0b00, 0b11): 576,
    }

    duration = 0.0
    frames = 0
    while offset + 4 <= len(audio_data):
        header = int.from_bytes(audio_data[offset : offset + 4], "big")
        if (header & 0xFFE00000) != 0xFFE00000:
            offset += 1
            continue

        version = (header >> 19) & 0b11
        layer = (header >> 17) & 0b11
        bitrate_index = (header >> 12) & 0b1111
        sample_rate_index = (header >> 10) & 0b11
        padding = (header >> 9) & 0b1
        if (
            version == 0b01
            or layer == 0
            or bitrate_index in (0, 0b1111)
            or sample_rate_index == 0b11
            or version not in sample_rates
        ):
            offset += 1
            continue

        sample_rate = sample_rates[version][sample_rate_index]
        samples = samples_per_frame.get((version, layer))
        if not samples:
            offset += 1
            continue

        # Frame-size tables are intentionally avoided here; scanning sync words is
        # enough for duration, and prevents one malformed frame from stopping us.
        duration += samples / sample_rate
        frames += 1
        offset += 4

    return duration if frames > 0 else None


def _get_audio_duration_seconds(audio_data: bytes) -> float | None:
    return (
        _get_wav_duration_seconds(audio_data)
        or _get_webm_duration_seconds(audio_data)
        or _get_mp3_duration_seconds(audio_data)
    )


def _credit_cost_for_recording(audio_data: bytes, billing_mode: str) -> tuple[int, float | None]:
    if billing_mode != "duration":
        return 1, None

    duration_seconds = _get_audio_duration_seconds(audio_data)
    if not duration_seconds or duration_seconds <= 0:
        raise HTTPException(
            status_code=400,
            detail="Could not determine recording length",
        )

    return max(1, math.ceil(duration_seconds / 30)), duration_seconds


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
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = "es",
    billing_mode: str = "segment",
    user_id: str = Depends(verify_jwt),
):
    try:
        audio_data = await file.read()
        if len(audio_data) == 0:
            raise HTTPException(status_code=400, detail="Empty audio file")

        filename = file.filename or "audio.wav"
        print(f"Received audio file: {filename}, size: {len(audio_data)} bytes")
        credits_charged, duration_seconds = _credit_cost_for_recording(
            audio_data,
            billing_mode,
        )
        await deduct_credits(user_id, credits_charged)

        global _groq_backoff_until

        if FORCE_SONIOX_FALLBACK:
            print("FORCE_SONIOX_FALLBACK enabled, using Soniox directly")
            result = await _transcribe_soniox(audio_data, filename, language)
            result.update({"credits_charged": credits_charged, "duration_seconds": duration_seconds})
            return JSONResponse(result)

        # If we're in backoff period, skip Groq entirely
        if _time.time() < _groq_backoff_until:
            remaining = int(_groq_backoff_until - _time.time())
            print(f"Groq in backoff ({remaining}s remaining), using Soniox directly")
            result = await _transcribe_soniox(audio_data, filename, language)
            result.update({"credits_charged": credits_charged, "duration_seconds": duration_seconds})
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
                "credits_charged": credits_charged,
                "duration_seconds": duration_seconds,
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
                result.update({"credits_charged": credits_charged, "duration_seconds": duration_seconds})
                return JSONResponse(result)
            raise

    except HTTPException:
        raise
    except Exception as e:
        print(f"Groq transcription error: {e}, trying Soniox fallback...")
        try:
            result = await _transcribe_soniox(audio_data, filename, language)
            result.update({"credits_charged": credits_charged, "duration_seconds": duration_seconds})
            return JSONResponse(result)
        except Exception as soniox_err:
            print(f"Soniox fallback also failed: {soniox_err}")
            raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
