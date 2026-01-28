"""
FastAPI server for Spanish language learning with chat functionality and real-time transcription.

This server provides:
- Chat endpoints using OpenAI for conversation practice
- Real-time transcription via Soniox (in soniox_transcription.py)

Run with: uvicorn src.api.chat_stream:app --host 0.0.0.0 --port 8000 --reload
"""

import os
import base64
import random
import json
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from elevenlabs.client import ElevenLabs
from pinecone import Pinecone

# Import the transcription router
from soniox_transcription import router as transcription_router

# Load environment variables
load_dotenv()

# OpenAI configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# ElevenLabs configuration
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
elevenlabs_client = ElevenLabs(api_key=ELEVENLABS_API_KEY) if ELEVENLABS_API_KEY else None

# Pinecone configuration
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
pinecone_client = Pinecone(api_key=PINECONE_API_KEY) if PINECONE_API_KEY else None


def generate_tts_audio(text: str) -> str | None:
    """Generate TTS audio and return as base64-encoded MP3."""
    if not elevenlabs_client:
        return None
    try:
        audio_generator = elevenlabs_client.text_to_speech.convert(
            text=text,
            voice_id="jBlmi27XRORxjPquUeCh",
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )
        audio_bytes = b"".join(audio_generator)
        return base64.b64encode(audio_bytes).decode("utf-8")
    except Exception as e:
        print(f"Error generating TTS audio: {e}")
        return None

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

# System prompt for generating video-based comprehension questions
VIDEO_QUESTION_SYSTEM_PROMPT = """Generate a comprehension question in Spanish based on the provided video transcript segment.

Guidelines:
- The question should be answerable from the transcript content
- Keep the question clear and focused on one concept
- Match the CEFR level if provided
- Only output the question, nothing else
- Only text, no emojis"""


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class VideoSegment(BaseModel):
    segment_id: int
    start: float
    end: float
    resolved_text: str
    cefr_level: str | None = None


class VideoBasedQuestionRequest(BaseModel):
    segments: List[VideoSegment]


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
    allow_methods=["*", "OPTIONS"],  # Explicitly include OPTIONS for preflight
    allow_headers=["*", "Upgrade", "Connection", "Sec-WebSocket-Key", "Sec-WebSocket-Version"],
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
    from soniox_transcription import SONIOX_API_KEY
    return {
        "status": "ok",
        "soniox_configured": bool(SONIOX_API_KEY),
        "openai_configured": bool(OPENAI_API_KEY),
        "elevenlabs_configured": bool(ELEVENLABS_API_KEY),
        "pinecone_configured": bool(PINECONE_API_KEY)
    }


@app.get("/video-segments/{video_id}")
async def get_video_segments(video_id: str):
    """
    Fetch all segments for a video from Pinecone.
    Returns segments sorted by segment_id.
    """
    if not pinecone_client:
        return {"error": "Pinecone API key not configured"}

    try:
        index = pinecone_client.Index("spanish-video-transcripts")
        results = index.query(
            vector=[0.0] * 1536,  # Dummy vector - we're filtering by metadata only
            filter={"video_id": {"$eq": video_id}},
            top_k=500,
            include_metadata=True
        )
        
        if not results.matches:
            return {"error": f"No segments found for video_id: {video_id}", "segments": []}
        
        # Extract and format segments
        segments = []
        for match in results.matches:
            metadata = match.metadata
            words = json.loads(metadata["words"])
            # if word is in words, add it to the vocab_map with the start and end time
            key_vocabulary = metadata["key_vocabulary"]
            translated_key_vocabulary = metadata["translated_key_vocabulary"]
            vocab_map = []

            # Create a mapping from key_vocabulary to its translation for O(1) lookups
            vocab_to_translation = dict(zip(key_vocabulary, translated_key_vocabulary))

            # Function to check if consecutive words match a phrase
            def find_phrase_matches(words_list, phrase):
                phrase_words = [w.strip(".,!?") for w in phrase.lower().split()]
                phrase_len = len(phrase_words)
                # also need to strip punctuation from the words
                words_list = [{**word, "word": word["word"].strip(".,!?")} for word in words_list]

                for i in range(len(words_list) - phrase_len + 1):
                    # Check if consecutive words match the phrase
                    if all(words_list[i + j]["word"].lower() == phrase_words[j]
                           for j in range(phrase_len)):
                        # Return the start time of first word and end time of last word
                        return {
                            "start": words_list[i]["start"],
                            "end": words_list[i + phrase_len - 1]["end"],
                            "matched_words": [w["word"] for w in words_list[i:i + phrase_len]]
                        }
                return None

            # Check each phrase in key_vocabulary
            for phrase in key_vocabulary:
                match = find_phrase_matches(words, phrase)
                if match:
                    vocab_map.append({
                        "value": phrase.capitalize(),
                        "translation": vocab_to_translation[phrase].capitalize(),
                        "start": match["start"],
                        "end": match["end"],
                    })
                    
            segments.append({
                "segment_id": int(metadata.get("segment_id", 0)),
                "start": metadata.get("start"),
                "end": metadata.get("end"),
                "text": metadata.get("resolved_text", ""),
                "cefr_level": metadata.get("cefr_level"),
                "key_vocabulary": vocab_map,
                "words": words,
            })
        
        # Sort by segment_id
        segments.sort(key=lambda x: x["segment_id"])
        
        return {
            "video_id": video_id,
            "segments": segments,
            "count": len(segments)
        }
    except Exception as e:
        print(f"Error fetching video segments: {e}")
        return {"error": str(e), "segments": []}

@app.post("/video-based-question")
async def video_based_question(request: VideoBasedQuestionRequest):
    """
    Generate a video-based question with TTS audio.
    Expects segments array to be provided in the request.
    Uses the first segment as the main segment and the second (if provided) as previous context.
    """
    print('here')
    if not openai_client:
        return {"error": "OpenAI API key not configured"}

    if not request.segments or len(request.segments) == 0:
        return {"error": "No segments provided"}

    try:
        # Use the first segment as the main segment for the question
        segments = request.segments
        resolved_text = ""
        for segment in segments:
            resolved_text += segment.resolved_text
        cefr_level = segments[0].cefr_level

        if not resolved_text:
            return {"error": "Segment has no resolved_text"}

        user_prompt = f"""Transcript segment: "{resolved_text}"
{f'CEFR Level: {cefr_level}' if cefr_level else ''}

Generate a comprehension question in Spanish for this video segment transcript.
 Then generate 3 multiple choice answers to the question. Answer choices should be in Spanish. Provide the correct answer in the response."""

        messages = [
            {"role": "system", "content": VIDEO_QUESTION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ]

        response = openai_client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            max_tokens=300,
            temperature=0.7,
            response_format={
                "type": "json_schema", 
                "json_schema": {
                    "name": "question_data",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "required": ["question", "answers", "correct_answer"],
                        "properties": {
                            "question": {"type": "string"},
                            "answers": {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 3},
                            "correct_answer": {"type": "integer", "minimum": 0, "maximum": 2}
                        },
                        "additionalProperties": False
                    }
                }
            }
        )

        question_data = json.loads(response.choices[0].message.content.strip())

        # Track the correct answer before shuffling
        correct_answer_text = question_data["answers"][question_data["correct_answer"]]

        random.shuffle(question_data["answers"])

        # Update the correct_answer index after shuffling
        question_data["correct_answer"] = question_data["answers"].index(correct_answer_text)

        # Generate TTS audio for the question
        audio_base64 = generate_tts_audio(question_data["question"])
        audio_base64_answers = [generate_tts_audio(answer) for answer in question_data["answers"]]

        response_data = {
            "question": question_data["question"],
            "answers": question_data["answers"],
            "correct_answer": question_data["correct_answer"],
            "audio": audio_base64,
            "audio_answers": audio_base64_answers,
            "status": "complete"
        }

        return response_data
    except Exception as e:
        print(f"Error generating video-based question: {e}")
        return {"error": str(e)}

# @app.post("/initial-message")
# async def initial_message():
#     """
#     Generate an initial conversation starter message with TTS audio.
#     """
#     if not openai_client:
#         return {"error": "OpenAI API key not configured"}

#     try:
#         messages = [
#             {"role": "system", "content": INITIAL_PROMPT_SYSTEM_PROMPT},
#             {"role": "user", "content": "Generate an engaging conversation starter in Spanish."}
#         ]

#         response = openai_client.chat.completions.create(
#             model="gpt-4o-mini",
#             messages=messages,
#             max_tokens=100,
#             temperature=0.8,  # Slightly higher temperature for more variety
#         )

#         initial_message = response.choices[0].message.content
        
#         # Generate TTS audio for the initial message
#         audio_base64 = generate_tts_audio(initial_message)

#         return {
#             "response": initial_message,
#             "audio": audio_base64,
#             "status": "complete"
#         }

#     except Exception as e:
#         print(f"Error generating initial message: {e}")
#         return {"error": str(e)}


@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Chat endpoint that returns responses from GPT-4o-mini with TTS audio.
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
        
        # Generate TTS audio for the response
        audio_base64 = generate_tts_audio(assistant_message)
        
        return {
            "response": assistant_message,
            "audio": audio_base64,
            "status": "complete"
        }
        
    except Exception as e:
        print(f"Error in chat: {e}")
        return {"error": str(e)}


# @app.post("/suggestion")
# async def suggestion(request: SuggestionRequest):
#     """
#     Generate a 2-3 word suggestion to continue the user's sentence.
#     """
#     if not openai_client:
#         return {"error": "OpenAI API key not configured"}

#     try:
#         # Build context from conversation history
#         context_messages = []
#         for msg in request.history:
#             context_messages.append(f"{msg.role}: {msg.content}")
        
#         conversation_context = "\n".join(context_messages) if context_messages else "No previous conversation"
        
#         # Build the prompt for the suggestion
#         user_prompt = f"""Conversation context:
# {conversation_context}

# The user is currently saying: "{request.partial_transcript}"

# Suggest 2-3 words to continue their sentence."""

#         messages = [
#             {"role": "system", "content": SUGGESTION_SYSTEM_PROMPT},
#             {"role": "user", "content": user_prompt}
#         ]

#         response = openai_client.chat.completions.create(
#             model="gpt-4o-mini",
#             messages=messages,
#             max_tokens=80,  # Keep it short for quick suggestions
#             temperature=0.7,
#         )

#         suggestion_text = " ".join(response.choices[0].message.content.strip().split()[:5]) + '...'

#         return {
#             "suggestion": suggestion_text,
#             "status": "complete"
#         }

#     except Exception as e:
#         print(f"Error generating suggestion: {e}")
#         return {"error": str(e)}


# @app.post("/autocorrect")
# async def autocorrect(request: AutocorrectRequest):
#     """
#     Autocorrect the user's transcript for spelling, punctuation, and obvious word errors.
#     Simplified endpoint - no conversation history needed for basic corrections.
#     """
#     if not openai_client:
#         return {"error": "OpenAI API key not configured"}

#     # Don't process empty transcripts
#     if not request.transcript.strip():
#         return {"corrected": "", "status": "complete"}

#     try:
#         # Simple prompt - just correct the transcript
#         user_prompt = f'Correct this Spanish transcript: "{request.transcript}"'

#         messages = [
#             {"role": "system", "content": AUTOCORRECT_SYSTEM_PROMPT},
#             {"role": "user", "content": user_prompt}
#         ]

#         response = openai_client.chat.completions.create(
#             model="gpt-4o-mini",
#             messages=messages,
#             max_tokens=200,
#             temperature=0.3,  # Lower temperature for more consistent corrections
#         )

#         corrected_text = response.choices[0].message.content.strip()
        
#         # Remove any surrounding quotes the model might add
#         if corrected_text.startswith('"') and corrected_text.endswith('"'):
#             corrected_text = corrected_text[1:-1]

#         return {
#             "corrected": corrected_text,
#             "status": "complete"
#         }

#     except Exception as e:
#         print(f"Error autocorrecting transcript: {e}")
#         return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
