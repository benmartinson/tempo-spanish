"""
OpenAI Realtime transcription session broker.

The mobile/web client uses these routes to obtain short-lived Realtime
credentials without exposing the server API key.
"""

import os

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from auth import check_credits, ensure_credits

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_REALTIME_TRANSCRIPTION_MODEL = os.getenv(
    "OPENAI_REALTIME_TRANSCRIPTION_MODEL",
    "gpt-realtime-whisper",
)

router = APIRouter()


class RealtimeTranscriptionSessionRequest(BaseModel):
    language: str = "es"
    targetLanguage: str | None = None
    model: str | None = None
    prompt: str | None = None


@router.post("/api/realtime-transcription/session")
async def create_realtime_transcription_session(
    request: RealtimeTranscriptionSessionRequest,
    _user_id: str = Depends(ensure_credits),
):
    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="OpenAI Realtime transcription is not configured",
        )

    model = request.model or OPENAI_REALTIME_TRANSCRIPTION_MODEL
    language = request.targetLanguage or request.language
    payload = {
        "expires_after": {
            "anchor": "created_at",
            "seconds": 600,
        },
        "session": {
            "type": "transcription",
            "audio": {
                "input": {
                    "format": {
                        "type": "audio/pcm",
                        "rate": 24000,
                    },
                    "noise_reduction": {
                        "type": "near_field",
                    },
                    "transcription": {
                        "model": model,
                        "language": language,
                        "prompt": request.prompt or "",
                    },
                },
            },
            "include": [
                "item.input_audio_transcription.logprobs",
            ],
        },
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/realtime/client_secrets",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except Exception as err:
        print(f"Realtime client secret request failed: {err}")
        raise HTTPException(status_code=502, detail="Realtime session failed")

    if response.status_code >= 400:
        print(
            "OpenAI Realtime client secret error: "
            f"{response.status_code} - {response.text}"
        )
        raise HTTPException(status_code=502, detail="Realtime session failed")

    data = response.json()
    secret_value = data.get("value") or data.get("client_secret", {}).get("value")
    expires_at = data.get("expires_at") or data.get("client_secret", {}).get(
        "expires_at"
    )

    if not secret_value:
        print(f"Unexpected Realtime client secret response: {data}")
        raise HTTPException(status_code=502, detail="Realtime session failed")

    return JSONResponse(
        {
            "client_secret": secret_value,
            "expires_at": expires_at,
            "model": model,
        }
    )


@router.post("/api/realtime-transcription/charge")
async def charge_realtime_transcription(_user_id: str = Depends(check_credits)):
    return {"status": "ok"}
