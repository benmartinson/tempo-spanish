"""
FastAPI WebSocket server that proxies audio to DeepGram for real-time transcription.

This server acts as a bridge between the React Native app and DeepGram's ASR service,
keeping the API key secure on the server side.

Run with: uvicorn src.api.chat_stream:app --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import json
import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
load_dotenv()

# DeepGram configuration
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen"

app = FastAPI(title="SpeakUp Spanish ASR Proxy")

# Enable CORS for all origins (configure appropriately for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DeepgramProxy:
    """Manages the bidirectional WebSocket connection between client and DeepGram."""
    
    def __init__(self, client_ws: WebSocket):
        self.client_ws = client_ws
        self.deepgram_ws: Optional[asyncio.StreamWriter] = None
        self._closed = False
    
    async def connect_to_deepgram(self) -> bool:
        """Establish WebSocket connection to DeepGram."""
        import websockets
        
        if not DEEPGRAM_API_KEY:
            await self.client_ws.send_json({
                "type": "error",
                "message": "DeepGram API key not configured on server"
            })
            return False
        
        # Build DeepGram WebSocket URL with parameters
        params = (
            f"?model=nova-2"
            f"&language=en"
            f"&smart_format=true"
            f"&interim_results=true"
            f"&encoding=linear16"
            f"&sample_rate=16000"
            f"&channels=1"
        )
        
        url = f"{DEEPGRAM_WS_URL}{params}"
        headers = {"Authorization": f"Token {DEEPGRAM_API_KEY}"}
        
        try:
            self.deepgram_ws = await websockets.connect(url, additional_headers=headers)
            print("Connected to DeepGram")
            return True
        except Exception as e:
            print(f"Failed to connect to DeepGram: {e}")
            await self.client_ws.send_json({
                "type": "error",
                "message": f"Failed to connect to DeepGram: {str(e)}"
            })
            return False
    
    async def forward_audio_to_deepgram(self):
        """Receive audio from client and forward to DeepGram."""
        try:
            while not self._closed:
                # Receive binary audio data from client
                data = await self.client_ws.receive()
                
                if data["type"] == "websocket.disconnect":
                    break
                
                if "bytes" in data:
                    # Forward audio bytes to DeepGram
                    if self.deepgram_ws and not self._closed:
                        await self.deepgram_ws.send(data["bytes"])
                elif "text" in data:
                    # Handle text messages (like control messages)
                    message = json.loads(data["text"])
                    if message.get("type") == "stop":
                        break
        except WebSocketDisconnect:
            print("Client disconnected")
        except Exception as e:
            print(f"Error forwarding audio: {e}")
        finally:
            await self.close()
    
    async def forward_transcripts_to_client(self):
        """Receive transcripts from DeepGram and forward to client."""
        try:
            while not self._closed and self.deepgram_ws:
                message = await self.deepgram_ws.recv()
                
                if isinstance(message, str):
                    # Parse and forward transcript to client
                    data = json.loads(message)
                    
                    # Extract transcript from DeepGram response
                    if "channel" in data:
                        alternatives = data.get("channel", {}).get("alternatives", [])
                        if alternatives:
                            transcript = alternatives[0].get("transcript", "")
                            confidence = alternatives[0].get("confidence", 0)
                            words = alternatives[0].get("words", [])
                            is_final = data.get("is_final", False)
                            
                            # Send formatted response to client
                            await self.client_ws.send_json({
                                "type": "transcript",
                                "transcript": transcript,
                                "confidence": confidence,
                                "is_final": is_final,
                                "words": words,
                            })
                    elif data.get("type") == "Metadata":
                        # Forward metadata
                        await self.client_ws.send_json({
                            "type": "metadata",
                            "data": data
                        })
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
        
        if self.deepgram_ws:
            try:
                await self.deepgram_ws.close()
            except:
                pass
            self.deepgram_ws = None


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "SpeakUp Spanish ASR Proxy"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "deepgram_configured": bool(DEEPGRAM_API_KEY)
    }


@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    """
    WebSocket endpoint for real-time audio transcription.
    
    Client sends: Binary audio data (linear16 PCM, 16kHz, mono)
    Server sends: JSON transcript messages
    """
    await websocket.accept()
    print("Client connected")
    
    # Send ready message
    await websocket.send_json({
        "type": "ready",
        "message": "Connected to transcription server"
    })
    
    proxy = DeepgramProxy(websocket)
    
    # Connect to DeepGram
    if not await proxy.connect_to_deepgram():
        await websocket.close()
        return
    
    # Notify client that DeepGram is connected
    await websocket.send_json({
        "type": "connected",
        "message": "Connected to DeepGram"
    })
    
    # Run both directions concurrently
    try:
        await asyncio.gather(
            proxy.forward_audio_to_deepgram(),
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
