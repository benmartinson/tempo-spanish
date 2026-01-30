"""
Real-time transcription using Soniox STT WebSocket API.

This module handles the bidirectional WebSocket connection between the client app
and Soniox's real-time speech-to-text service.

Run with the main chat_stream.py server - this module provides the transcription router.
"""

import asyncio
import json
import os
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Soniox configuration
SONIOX_API_KEY = os.getenv("SONIOX_API_KEY")
SONIOX_WEBSOCKET_URL = "wss://stt-rt.soniox.com/transcribe-websocket"

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
        "model": "stt-rt-v3",
        #
        # Set language hints for Spanish (primary) and English
        # See: soniox.com/docs/stt/concepts/language-hints
        "language_hints": ["es", "en"],
        #
        # Enable language identification to detect which language is being spoken
        # See: soniox.com/docs/stt/concepts/language-identification
        "enable_language_identification": True,
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
                    # Collect all tokens (both final and non-final) for immediate feedback
                    current_tokens = []
                    has_non_final = False
                    
                    for token in res.get("tokens", []):
                        text = token.get("text", "")
                        if text and not self._is_special_token(text):
                            current_tokens.append(token)
                            if token.get("is_final"):
                                # Final tokens are returned once and should be accumulated
                                self.final_tokens.append(token)
                            else:
                                has_non_final = True
                    
                    # Send transcript immediately if we have any tokens
                    # This provides real-time feedback for shadow practice
                    if current_tokens:
                        # Build transcript text from current tokens
                        transcript_parts = []
                        for token in current_tokens:
                            transcript_parts.append(token.get("text", ""))
                        
                        transcript = "".join(transcript_parts).strip()
                        
                        # Build words array with timing and confidence info
                        words = []
                        for token in current_tokens:
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
                        
                        # Determine if this batch is final (no non-final tokens)
                        is_final = not has_non_final
                        
                        # Send formatted response to client
                        if transcript:
                            await self.client_ws.send_json({
                                "type": "transcript",
                                "transcript": transcript,
                                "confidence": confidence,
                                "is_final": is_final,
                                "words": words,
                            })
                            print(f"{'Final' if is_final else 'Interim'} transcript: {transcript}")
                        
                        # Reset final_tokens when we've sent a final result
                        if is_final:
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
        "type": "transcript",
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
