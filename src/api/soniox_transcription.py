"""
Batch transcription using Soniox STT API.

This module handles POST endpoint for batch audio file transcription.

Run with the main chat_stream.py server - this module provides the transcription router.
"""

import asyncio
import json
import os
import httpx

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from auth import check_credits

# Load environment variables
load_dotenv()

# Soniox configuration
SONIOX_API_KEY = os.getenv("SONIOX_API_KEY")
SONIOX_API_BASE_URL = "https://api.soniox.com"

# Create router for transcription endpoints
router = APIRouter()


def _is_special_token(text: str) -> bool:
    """Check if a token is a special token that should be filtered out."""
    special_tokens = {"<end>", "<start>", "<unk>", "<silence>"}
    return text.strip() in special_tokens or (text.startswith("<") and text.endswith(">"))


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
    if not SONIOX_API_KEY:
        raise HTTPException(status_code=500, detail="Transcription service is not configured")

    try:
        # Read the uploaded file
        audio_data = await file.read()

        if len(audio_data) == 0:
            raise HTTPException(status_code=400, detail="Empty audio file")

        print(f"Received audio file: {file.filename}, size: {len(audio_data)} bytes")

        # Use Soniox async file transcription API
        # https://soniox.com/docs/stt/async/async-transcription
        async with httpx.AsyncClient(timeout=120.0) as client:
            headers = {"Authorization": f"Bearer {SONIOX_API_KEY}"}

            # Step 1: Upload the file to get a file_id
            print("Uploading file to Soniox...")
            upload_response = await client.post(
                f"{SONIOX_API_BASE_URL}/v1/files",
                headers=headers,
                files={
                    "file": (file.filename or "audio.wav", audio_data, "audio/wav"),
                },
            )

            if upload_response.status_code not in (200, 201):
                print(f"Soniox file upload error: {upload_response.status_code} - {upload_response.text}")
                raise HTTPException(status_code=502, detail="Transcription service unavailable")

            file_id = upload_response.json().get("id")
            print(f"File uploaded, ID: {file_id}")

            # Step 2: Create transcription request
            print("Creating transcription...")
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
                print(f"Soniox transcription create error: {transcription_response.status_code} - {transcription_response.text}")
                # Clean up uploaded file
                await client.delete(f"{SONIOX_API_BASE_URL}/v1/files/{file_id}", headers=headers)
                raise HTTPException(status_code=502, detail="Transcription failed")

            transcription_id = transcription_response.json().get("id")
            print(f"Transcription created, ID: {transcription_id}")

            # Step 3: Poll for completion
            print("Waiting for transcription to complete...")
            max_attempts = 60  # Max 60 seconds
            for _ in range(max_attempts):
                status_response = await client.get(
                    f"{SONIOX_API_BASE_URL}/v1/transcriptions/{transcription_id}",
                    headers=headers,
                )
                status_data = status_response.json()
                status = status_data.get("status")

                if status == "completed":
                    print("Transcription completed!")
                    break
                elif status == "error":
                    error_msg = status_data.get("error_message", "Unknown error")
                    print(f"Transcription error: {error_msg}")
                    # Clean up
                    await client.delete(f"{SONIOX_API_BASE_URL}/v1/transcriptions/{transcription_id}", headers=headers)
                    await client.delete(f"{SONIOX_API_BASE_URL}/v1/files/{file_id}", headers=headers)
                    raise HTTPException(status_code=502, detail="Transcription failed")

                await asyncio.sleep(1)
            else:
                # Timeout - clean up
                await client.delete(f"{SONIOX_API_BASE_URL}/v1/transcriptions/{transcription_id}", headers=headers)
                await client.delete(f"{SONIOX_API_BASE_URL}/v1/files/{file_id}", headers=headers)
                raise HTTPException(status_code=504, detail="Transcription request timed out")

            # Step 4: Get the transcript
            transcript_response = await client.get(
                f"{SONIOX_API_BASE_URL}/v1/transcriptions/{transcription_id}/transcript",
                headers=headers,
            )

            if transcript_response.status_code != 200:
                print(f"Soniox transcript fetch error: {transcript_response.status_code} - {transcript_response.text}")
                raise HTTPException(status_code=502, detail="Failed to retrieve transcript")

            result = transcript_response.json()
            print(f"Soniox response: {json.dumps(result, indent=2)}")

            # Clean up: delete transcription and file
            await client.delete(f"{SONIOX_API_BASE_URL}/v1/transcriptions/{transcription_id}", headers=headers)
            await client.delete(f"{SONIOX_API_BASE_URL}/v1/files/{file_id}", headers=headers)

            # Parse the response to extract transcript and words
            # The /v1/transcriptions/{id}/transcript endpoint returns a tokens array
            transcript_parts = []
            words = []

            if "tokens" in result:
                # Tokens array format (primary response format)
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
                        # Include language if available
                        if token.get("language"):
                            word_info["language"] = token.get("language")
                        words.append(word_info)
            elif "words" in result:
                # Alternative words array format
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
                # Simple text response
                transcript_parts.append(result["text"])
            elif "transcript" in result:
                # Transcript field in response
                transcript_parts.append(result["transcript"])

            transcript = "".join(transcript_parts).strip()

            # Calculate average confidence
            confidence = 0.0
            if words:
                confidences = [w.get("confidence", 1.0) for w in words]
                confidence = sum(confidences) / len(confidences)

            return JSONResponse({
                "transcript": transcript,
                "confidence": confidence,
                "words": words,
            })

    except HTTPException:
        raise
    except Exception as e:
        print(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
