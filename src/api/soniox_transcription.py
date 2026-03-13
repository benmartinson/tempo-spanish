"""
Real-time and batch transcription using Soniox STT API.

This module handles:
1. Bidirectional WebSocket connection for real-time transcription
2. POST endpoint for batch audio file transcription

Run with the main chat_stream.py server - this module provides the transcription router.
"""

import asyncio
import json
import os
import httpx
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Soniox configuration
SONIOX_API_KEY = os.getenv("SONIOX_API_KEY")
SONIOX_WEBSOCKET_URL = "wss://stt-rt.soniox.com/transcribe-websocket"
SONIOX_API_BASE_URL = "https://api.soniox.com"

# Create router for transcription endpoints
router = APIRouter()


def get_soniox_config(api_key: str) -> dict:
    """
    Build Soniox configuration for Spanish language learning context.
    """
    return {
        # API key for authentication
        "api_key": api_key,
        #
        # Use the real-time model
        # See: soniox.com/docs/stt/models
        "model": "stt-async-v4",
        #
        # Set language to Spanish only
        # See: https://soniox.com/docs/stt/concepts/language-restrictions
        "language_hints": ["es"],
        "language_hints_strict": True,
        #
        # Audio format - client sends linear16 PCM at 16kHz mono
        # See: soniox.com/docs/stt/rt/real-time-transcription#audio-formats
        "audio_format": "pcm_s16le",
        "sample_rate": 16000,
        "num_channels": 1,
        #
        # Enable endpoint detection to finalize transcripts when speaker pauses
        # See: soniox.com/docs/stt/rt/endpoint-detection
        "enable_endpoint_detection": True,
        #
        # Context for Spanish language learning
        "context": {
            "general": [
                {"key": "domain", "value": "Language Learning"},
                {"key": "topic", "value": "Spanish conversation practice"},
            ],
        },
    }



class SonioxProxy:
    """Manages the bidirectional WebSocket connection between client and Soniox."""
    
    def __init__(self, client_ws: WebSocket):
        self.client_ws = client_ws
        self.soniox_ws = None
        self._closed = False
        self.final_tokens: list[dict] = []
    
    async def connect_to_soniox(self) -> bool:
        """Establish WebSocket connection to Soniox."""
        import websockets
        
        if not SONIOX_API_KEY:
            await self.client_ws.send_json({
                "type": "error",
                "message": "Soniox API key not configured on server"
            })
            return False
        
        try:
            self.soniox_ws = await websockets.connect(SONIOX_WEBSOCKET_URL)
            
            # Send configuration as first message
            config = get_soniox_config(SONIOX_API_KEY)
            await self.soniox_ws.send(json.dumps(config))
            
            print("Connected to Soniox")
            return True
        except Exception as e:
            print(f"Failed to connect to Soniox: {e}")
            await self.client_ws.send_json({
                "type": "error",
                "message": f"Failed to connect to Soniox: {str(e)}"
            })
            return False
    
    async def forward_audio_to_soniox(self):
        """Receive audio from client and forward to Soniox."""
        try:
            while not self._closed:
                # Receive data from client
                data = await self.client_ws.receive()
                
                if data["type"] == "websocket.disconnect":
                    break
                
                if "bytes" in data:
                    # Forward audio bytes to Soniox
                    if self.soniox_ws and not self._closed:
                        await self.soniox_ws.send(data["bytes"])
                elif "text" in data:
                    # Handle text messages (like control messages)
                    message = json.loads(data["text"])
                    if message.get("type") == "stop":
                        # Send empty string to signal end-of-audio to Soniox
                        if self.soniox_ws and not self._closed:
                            await self.soniox_ws.send("")
                        break
        except WebSocketDisconnect:
            print("Client disconnected")
        except Exception as e:
            print(f"Error forwarding audio: {e}")
        finally:
            await self.close()
    
    def _is_special_token(self, text: str) -> bool:
        """Check if a token is a special token that should be filtered out."""
        special_tokens = {"<end>", "<start>", "<unk>", "<silence>"}
        return text.strip() in special_tokens or text.startswith("<") and text.endswith(">")
    
    async def forward_transcripts_to_client(self):
        """Receive transcripts from Soniox and forward to client."""
        try:
            while not self._closed and self.soniox_ws:
                message = await self.soniox_ws.recv()
                
                if isinstance(message, str):
                    res = json.loads(message)
                    
                    # Check for error from server
                    if res.get("error_code") is not None:
                        await self.client_ws.send_json({
                            "type": "error",
                            "message": f"{res['error_code']} - {res.get('error_message', 'Unknown error')}"
                        })
                        print(f"Soniox error: {res['error_code']} - {res.get('error_message')}")
                        break
                    
                    # Parse tokens from response, filtering out special tokens
                    has_non_final = False
                    for token in res.get("tokens", []):
                        text = token.get("text", "")
                        if text and not self._is_special_token(text):
                            if token.get("is_final"):
                                # Final tokens are returned once and should be accumulated
                                self.final_tokens.append(token)
                            else:
                                # Track that we have non-final tokens (still processing)
                                has_non_final = True
                    
                    # Determine if this is a final result (endpoint detected)
                    # Final when we have tokens and no more non-final tokens pending
                    is_final = len(self.final_tokens) > 0 and not has_non_final
                    
                    # Only send when we have a final transcript
                    if is_final and self.final_tokens:
                        # Build transcript text from final tokens only
                        transcript_parts = []
                        for token in self.final_tokens:
                            transcript_parts.append(token.get("text", ""))
                        
                        transcript = "".join(transcript_parts).strip()
                        
                        # Build words array with timing and confidence info
                        words = []
                        for token in self.final_tokens:
                            word_info = {
                                "word": token.get("text", ""),
                                "start": token.get("start_ms", 0) / 1000.0,
                                "end": token.get("end_ms", 0) / 1000.0,
                                "confidence": token.get("confidence", 1.0),
                            }
                            # Include language if available
                            if token.get("language"):
                                word_info["language"] = token.get("language")
                            words.append(word_info)
                        
                        # Calculate average confidence
                        confidence = 0
                        if words:
                            confidences = [w.get("confidence", 1.0) for w in words]
                            confidence = sum(confidences) / len(confidences)
                        
                        # Send formatted response to client
                        if transcript:
                            await self.client_ws.send_json({
                                "type": "transcript",
                                "transcript": transcript,
                                "confidence": confidence,
                                "is_final": True,
                                "words": words,
                            })
                            print(f"Final transcript: {transcript}")
                        
                        # Reset for next utterance
                        self.final_tokens = []
                    
                    # Session finished
                    if res.get("finished"):
                        await self.client_ws.send_json({
                            "type": "finished",
                            "message": "Transcription session finished"
                        })
                        print("Soniox session finished")
                        break
                        
        except Exception as e:
            if not self._closed:
                print(f"Error receiving transcripts: {e}")
        finally:
            await self.close()
    
    async def close(self):
        """Close all connections."""
        if self._closed:
            return
        self._closed = True
        
        if self.soniox_ws:
            try:
                await self.soniox_ws.close()
            except:
                pass
            self.soniox_ws = None


@router.get("/ws/transcribe")
async def websocket_test():
    """Test endpoint to verify the route is accessible via HTTP."""
    return {"status": "ok", "message": "WebSocket endpoint is available. Connect via wss:// protocol."}


@router.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    """
    WebSocket endpoint for real-time audio transcription using Soniox.
    
    Client sends: Binary audio data (linear16 PCM, 16kHz, mono)
    Server sends: JSON transcript messages
    
    Message format sent to client:
    {
        "type": "transcript"
        "transcript": "the transcribed text",
        "confidence": 0.95,
        "is_final": true/false,
        "words": [{"word": "hello", "start": 0.0, "end": 0.5, "confidence": 0.95}, ...]
    }
    """
    print(f"WebSocket connection attempt from: {websocket.client}")
    print(f"WebSocket headers: {websocket.headers}")
    
    # Accept the WebSocket connection with any subprotocol
    await websocket.accept()
    print("Client connected")
    
    # Send ready message
    await websocket.send_json({
        "type": "ready",
        "message": "Connected to transcription server"
    })
    
    proxy = SonioxProxy(websocket)
    
    # Connect to Soniox
    if not await proxy.connect_to_soniox():
        await websocket.close()
        return
    
    # Notify client that Soniox is connected
    await websocket.send_json({
        "type": "connected",
        "message": "Connected to Soniox"
    })
    
    # Run both directions concurrently
    try:
        await asyncio.gather(
            proxy.forward_audio_to_soniox(),
            proxy.forward_transcripts_to_client(),
        )
    except Exception as e:
        print(f"Error in proxy: {e}")
    finally:
        await proxy.close()
        try:
            await websocket.close()
        except:
            pass
    
    print("Client session ended")


def _is_special_token(text: str) -> bool:
    """Check if a token is a special token that should be filtered out."""
    special_tokens = {"<end>", "<start>", "<unk>", "<silence>"}
    return text.strip() in special_tokens or (text.startswith("<") and text.endswith(">"))


@router.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...), language: str = "es"):
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
        raise HTTPException(status_code=500, detail="Soniox API key not configured on server")
    
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
                raise HTTPException(
                    status_code=502,
                    detail=f"Soniox file upload failed: {upload_response.text}"
                )
            
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
                raise HTTPException(
                    status_code=502,
                    detail=f"Soniox transcription failed: {transcription_response.text}"
                )
            
            transcription_id = transcription_response.json().get("id")
            print(f"Transcription created, ID: {transcription_id}")
            
            # Step 3: Poll for completion
            print("Waiting for transcription to complete...")
            max_attempts = 60  # Max 60 seconds
            for attempt in range(max_attempts):
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
                    raise HTTPException(status_code=502, detail=f"Transcription error: {error_msg}")
                
                await asyncio.sleep(1)
            else:
                # Timeout - clean up
                await client.delete(f"{SONIOX_API_BASE_URL}/v1/transcriptions/{transcription_id}", headers=headers)
                await client.delete(f"{SONIOX_API_BASE_URL}/v1/files/{file_id}", headers=headers)
                raise HTTPException(status_code=504, detail="Transcription timed out")
            
            # Step 4: Get the transcript
            transcript_response = await client.get(
                f"{SONIOX_API_BASE_URL}/v1/transcriptions/{transcription_id}/transcript",
                headers=headers,
            )
            
            if transcript_response.status_code != 200:
                print(f"Soniox transcript fetch error: {transcript_response.status_code} - {transcript_response.text}")
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to get transcript: {transcript_response.text}"
                )
            
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
