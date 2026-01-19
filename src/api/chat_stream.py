"""
FastAPI WebSocket server that proxies audio to DeepGram for real-time transcription
and provides chat functionality with OpenAI.

This server acts as a bridge between the React Native app and DeepGram's ASR service,
keeping the API key secure on the server side.

Run with: uvicorn src.api.chat_stream:app --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import json
import os
from typing import Optional, List

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

# Load environment variables
load_dotenv()

# DeepGram configuration
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
# Using v1 API with Nova-3 for Spanish support
DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen"

# OpenAI configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# System prompt for Spanish conversation practice
SPANISH_CONVERSATION_SYSTEM_PROMPT = """You are a friendly person having a conversation in Spanish.

Guidelines:
- Respond only in Spanish.
- Keep responses conversational and somewhat brief, don't be too verbose.
- Never correct the user's grammar or vocabulary, just respond naturally in Spanish.
- Ask follow-up questions to keep the conversation going
- Only text, no emojis or other formatting."""

# System prompt for generating initial conversation starters
INITIAL_PROMPT_SYSTEM_PROMPT = """Generate an engaging, natural conversation starter in Spanish.

Guidelines:
- Respond only in Spanish.
- Make it interesting and encourage natural conversation.
- Keep it to 1-2 sentences.
- Focus on everyday topics like daily life, hobbies, interests, etc.
- Be friendly and conversational.
- Only text, no emojis or other formatting."""


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []

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
        
        # Build DeepGram WebSocket URL with parameters for Nova-3 Spanish
        params = (
            f"?model=nova-3"
            f"&language=es"
            f"&encoding=linear16"
            f"&sample_rate=16000"
            f"&punctuate=true"
            f"&interim_results=true"
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
                    msg_type = data.get("type", "")
                    
                    # V2/Flux API: transcript and words are directly on the message
                    if "transcript" in data and data["transcript"]:
                        transcript = data.get("transcript", "")
                        words = data.get("words", [])
                        is_final = data.get("is_final", True)  # Flux results are typically final
                        
                        # Calculate average confidence from words
                        confidence = 0
                        if words:
                            confidence = sum(w.get("confidence", 0) for w in words) / len(words)
                        
                        # Send formatted response to client
                        await self.client_ws.send_json({
                            "type": "transcript",
                            "transcript": transcript,
                            "confidence": confidence,
                            "is_final": is_final,
                            "words": words,
                        })
                        print(f"Transcript: {transcript}")
                    
                    # V1 API fallback: transcript nested under channel.alternatives
                    elif "channel" in data:
                        alternatives = data.get("channel", {}).get("alternatives", [])
                        if alternatives:
                            transcript = alternatives[0].get("transcript", "")
                            confidence = alternatives[0].get("confidence", 0)
                            words = alternatives[0].get("words", [])
                            is_final = data.get("is_final", False)
                            
                            if transcript:
                                await self.client_ws.send_json({
                                    "type": "transcript",
                                    "transcript": transcript,
                                    "confidence": confidence,
                                    "is_final": is_final,
                                    "words": words,
                                })
                    
                    elif msg_type == "Metadata" or msg_type == "Connected":
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
        "deepgram_configured": bool(DEEPGRAM_API_KEY),
        "openai_configured": bool(OPENAI_API_KEY)
    }


@app.post("/initial-message")
async def initial_message():
    """
    Generate an initial conversation starter message.
    """
    if not openai_client:
        return {"error": "OpenAI API key not configured"}

    try:
        messages = [
            {"role": "system", "content": INITIAL_PROMPT_SYSTEM_PROMPT},
            {"role": "user", "content": "Generate an engaging conversation starter in Spanish."}
        ]

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=100,
            temperature=0.8,  # Slightly higher temperature for more variety
        )

        initial_message = response.choices[0].message.content

        return {
            "response": initial_message,
            "status": "complete"
        }

    except Exception as e:
        print(f"Error generating initial message: {e}")
        return {"error": str(e)}


@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Chat endpoint that returns responses from GPT-4o-mini.
    """
    if not openai_client:
        return {"error": "OpenAI API key not configured"}

    try:
        # Build messages array with system prompt and history
        messages = [{"role": "system", "content": SPANISH_CONVERSATION_SYSTEM_PROMPT}]

        # Add conversation history
        for msg in request.history:
            messages.append({"role": msg.role, "content": msg.content})

        # Add the new user message
        messages.append({"role": "user", "content": request.message})
        
        # Create completion (non-streaming for React Native compatibility)
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=500,
            temperature=0.7,
        )
        
        assistant_message = response.choices[0].message.content
        
        return {
            "response": assistant_message,
            "status": "complete"
        }
        
    except Exception as e:
        print(f"Error in chat: {e}")
        return {"error": str(e)}


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
