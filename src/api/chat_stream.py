"""
FastAPI server for Spanish language learning with chat functionality and real-time transcription.

This server provides:
- Chat endpoints using OpenAI for conversation practice
- Real-time transcription via Soniox (in soniox_transcription.py)

Run with: uvicorn src.api.chat_stream:app --host 0.0.0.0 --port 8000 --reload
"""

import os
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

# Import the transcription router
from src.api.soniox_transcription import router as transcription_router

# Load environment variables
load_dotenv()

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

# System prompt for generating sentence continuation suggestions
SUGGESTION_SYSTEM_PROMPT = """You are helping a Spanish language learner continue their sentence.
Given their partial sentence and conversation context, suggest the next 2-3 words in Spanish.

Rules:
- Return ONLY 3-4 Spanish words that naturally continue their sentence
- No punctuation, no explanation, just the continuation words
- Match the tone and topic of the conversation
- If the partial sentence is empty or very short, suggest a conversation starter phrase"""

# System prompt for autocorrecting transcript errors
AUTOCORRECT_SYSTEM_PROMPT = """You are a transcript correction assistant for Spanish speech.
Fix only clear errors in the transcript:
- Spelling mistakes
- Missing or incorrect punctuation
- Words that obviously don't fit the sentence context (likely misheard)

Rules:
- Return ONLY the corrected text, nothing else
- Keep the same meaning and structure
- Don't change words unless they are clearly wrong
- If the transcript is fine, return it unchanged"""


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


class SuggestionRequest(BaseModel):
    partial_transcript: str
    history: List[ChatMessage] = []


class AutocorrectRequest(BaseModel):
    transcript: str


app = FastAPI(title="SpeakUp Spanish API")

# Enable CORS for all origins (configure appropriately for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the transcription router (provides /ws/transcribe endpoint)
app.include_router(transcription_router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "SpeakUp Spanish API"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    from src.api.soniox_transcription import SONIOX_API_KEY
    return {
        "status": "ok",
        "soniox_configured": bool(SONIOX_API_KEY),
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


@app.post("/suggestion")
async def suggestion(request: SuggestionRequest):
    """
    Generate a 2-3 word suggestion to continue the user's sentence.
    """
    if not openai_client:
        return {"error": "OpenAI API key not configured"}

    try:
        # Build context from conversation history
        context_messages = []
        for msg in request.history:
            context_messages.append(f"{msg.role}: {msg.content}")
        
        conversation_context = "\n".join(context_messages) if context_messages else "No previous conversation"
        
        # Build the prompt for the suggestion
        user_prompt = f"""Conversation context:
{conversation_context}

The user is currently saying: "{request.partial_transcript}"

Suggest 2-3 words to continue their sentence."""

        messages = [
            {"role": "system", "content": SUGGESTION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ]

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=80,  # Keep it short for quick suggestions
            temperature=0.7,
        )

        suggestion_text = " ".join(response.choices[0].message.content.strip().split()[:5]) + '...'

        return {
            "suggestion": suggestion_text,
            "status": "complete"
        }

    except Exception as e:
        print(f"Error generating suggestion: {e}")
        return {"error": str(e)}


@app.post("/autocorrect")
async def autocorrect(request: AutocorrectRequest):
    """
    Autocorrect the user's transcript for spelling, punctuation, and obvious word errors.
    Simplified endpoint - no conversation history needed for basic corrections.
    """
    if not openai_client:
        return {"error": "OpenAI API key not configured"}

    # Don't process empty transcripts
    if not request.transcript.strip():
        return {"corrected": "", "status": "complete"}

    try:
        # Simple prompt - just correct the transcript
        user_prompt = f'Correct this Spanish transcript: "{request.transcript}"'

        messages = [
            {"role": "system", "content": AUTOCORRECT_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ]

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=200,
            temperature=0.3,  # Lower temperature for more consistent corrections
        )

        corrected_text = response.choices[0].message.content.strip()
        
        # Remove any surrounding quotes the model might add
        if corrected_text.startswith('"') and corrected_text.endswith('"'):
            corrected_text = corrected_text[1:-1]

        return {
            "corrected": corrected_text,
            "status": "complete"
        }

    except Exception as e:
        print(f"Error autocorrecting transcript: {e}")
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
