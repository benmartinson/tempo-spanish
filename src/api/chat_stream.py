"""
FastAPI server for Spanish language learning with chat functionality and real-time transcription.

This server provides:
- Chat endpoints using OpenAI for conversation practice
- Real-time transcription via Soniox (in soniox_transcription.py)

Run with: uvicorn src.api.chat_stream:app --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import os
import re
import base64
import random
import json
import string
from typing import List

from deep_translator import GoogleTranslator
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from elevenlabs.client import ElevenLabs

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



def generate_tts_audio(text: str) -> str | None:
    """Generate TTS audio and return as base64-encoded MP3."""
    if not elevenlabs_client:
        return None
    try:
        audio_generator = elevenlabs_client.text_to_speech.convert(
            text=text,
            voice_id="jBlmi27XRORxjPquUeCh",
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_192",
            voice_settings={"stability": 0.5, "similarity_boost": 0.75},
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

# System prompt for generating vocab-based questions
VOCAB_QUESTION_SYSTEM_PROMPT = f"""Generate 1 vocabulary practice questions in English that incorporate the provided 
spanish vocabulary words, and point to the context of the video segment where the vocabulary words are used.

Guidelines:
- Based on the provided vocabulary words, pick 1 of them and generate a multiple choice question for each of them.
- The question should be in English. It should be like this:
"What is the translation of the word 'word_from_vocabulary' in the context of this sentence "actual_sentence_from_context_with_the_vocabulary_word_in_it"?
- The answers are possible translations of the vocabulary word.
- Make it tricky by including some fake translations that may seem correct but are not.
- One of the answers NEEDS to be the correct translation of the vocabulary word."""

# System prompt for evaluating vocab quiz answers
VOCAB_EVALUATION_SYSTEM_PROMPT = """You are a vocabulary grading engine.

Your job is to determine whether the user's English answer is a valid meaning of the given Spanish vocabulary word.

Rules:

1. The vocabulary word may have multiple valid meanings.
2. The word may function as different parts of speech (noun, verb, etc.).
3. The user's answer may be a word, phrase, or full sentence.
4. The answer does NOT need to match the provided context meaning.
5. If the user's answer is correct in ANY reasonable context, mark it as "correct".
6. Only mark "incorrect" if the answer is clearly unrelated to any real meaning of the word.
7. Be generous in accepting valid meanings.
8. Accept semantic equivalents, not just exact dictionary wording.
9. If uncertain, prefer marking as "correct" rather than "incorrect".

Output ONLY valid JSON in this format:

{
  "score": "correct" or "incorrect",
  "accepted_answers": array of all translations that would have been accepted as correct
}
"""

# System prompt for evaluating phrase quiz answers
PHRASE_EVALUATION_SYSTEM_PROMPT = """You are a phrase translation grading engine.

Your job is to determine whether the user's English answer captures the meaning of the given Spanish phrase.

Rules:

1. The phrase should be evaluated as a complete unit of meaning.
2. The user's answer may be a literal translation, paraphrase, or interpretation.
3. Consider the context provided to understand the intended meaning.
4. If the user's answer captures the essential meaning of the phrase, mark it as "correct".
5. Only mark "incorrect" if the answer misses the core meaning or is clearly wrong.
6. Be generous - accept paraphrases and interpretations that convey the same idea.
7. Accept semantic equivalents, not just word-for-word translations.
8. If uncertain, prefer marking as "correct" rather than "incorrect".

Output ONLY valid JSON in this format:

{
  "score": "correct" or "incorrect",
  "accepted_answers": array of all translations/interpretations that would have been accepted as correct
}
"""

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class VideoSegment(BaseModel):
    segment_id: int
    start: float
    end: float
    # resolved_text: str
    # cefr_level: str | None = None


class VideoBasedQuestionRequest(BaseModel):
    segments: List[VideoSegment]


class VocabItem(BaseModel):
    value: str
    translations: List[str]
    correct_translation: int
    start: float
    end: float


class VocabBasedQuestionRequest(BaseModel):
    # key_vocabulary: List[VocabItem]
    context: str | None = None  # The segment text for context


class TranslationInsightsRequest(BaseModel):
    text: str
    language: str = "en"


class EvaluateTranslationRequest(BaseModel):
    sentence_text: str
    translation: str
    translation_language: str
    user_translation: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


class SuggestionRequest(BaseModel):
    partial_transcript: str
    history: List[ChatMessage] = []


class AutocorrectRequest(BaseModel):
    transcript: str




class EvaluateReviewAnswerRequest(BaseModel):
    question: str
    ideal_answer: str | None = None
    user_answer: str
    context_segments: List[dict] = []
    vocab_word: str | None = None  # The vocab word or phrase being tested
    quiz_type: str | None = "vocab"  # "vocab" or "phrase"


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
    }


class TTSRequest(BaseModel):
    text: str


@app.post("/tts")
async def tts(request: TTSRequest):
    """Generate TTS audio for arbitrary text."""
    audio_base64 = generate_tts_audio(request.text)
    if audio_base64 is None:
        return {"error": "TTS generation failed or ElevenLabs not configured"}
    return {"audio": audio_base64, "status": "complete"}


@app.post("/vocab-based-question")
async def vocab_based_question(request: VocabBasedQuestionRequest):
    """
    Generate vocab-based questions with TTS audio.
    Takes key_vocabulary array and generates 3 questions incorporating the vocab words.
    """
    if not openai_client:
        return {"error": "OpenAI API key not configured"}

    # if not request.key_vocabulary or len(request.key_vocabulary) == 0:
        # return {"error": "No vocabulary provided"}

    try:
        # Format vocabulary for the prompt
        vocab_list = []
        for vocab in request.key_vocabulary:
            correct_translation = vocab.translations[vocab.correct_translation]
            vocab_list.append(f"- {vocab.value} (meaning: you decide based on the context)")
        
        vocab_text = "\n".join(vocab_list)
        
        # Build context section if provided
        context_section = ""
        if request.context:
            context_section = f"""
Video transcript context (use this to make translations more relevant):
"{request.context}"

"""
        user_prompt = f"""Vocabulary words to incorporate:
{vocab_text}
Context of the video segment where the vocabulary words are used:
{context_section}"""

        messages = [
            {"role": "system", "content": VOCAB_QUESTION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ]

        response = openai_client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            max_tokens=800,
            temperature=0.7,
            response_format={
                "type": "json_schema", 
                "json_schema": {
                    "name": "vocab_questions_data",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "required": ["questions"],
                        "properties": {
                            "questions": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "required": ["question", "answers", "correct_answer"],
                                    "properties": {
                                        "question": {"type": "string"},
                                        "answers": {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 3},
                                        "correct_answer": {"type": "integer", "minimum": 0, "maximum": 2}
                                    },
                                    "additionalProperties": False
                                },
                                "minItems": 1,
                                "maxItems": 1
                            }
                        },
                        "additionalProperties": False
                    }
                }
            }
        )

        questions_data = json.loads(response.choices[0].message.content.strip())

        # Process each question - shuffle answers and track correct answer
        processed_questions = []
        for q in questions_data["questions"]:
            correct_answer_text = q["answers"][q["correct_answer"]]
            random.shuffle(q["answers"])
            q["correct_answer"] = q["answers"].index(correct_answer_text)
            
            # Generate TTS audio for question and answers
            audio_base64 = generate_tts_audio(q["question"])
            audio_base64_answers = [generate_tts_audio(answer) for answer in q["answers"]]
            
            processed_questions.append({
                "question": q["question"],
                "answers": q["answers"],
                "correct_answer": q["correct_answer"],
                "audio": audio_base64,
                "audio_answers": audio_base64_answers
            })

        return {
            "questions": processed_questions,
            "status": "complete"
        }
    except Exception as e:
        print(f"Error generating vocab-based questions: {e}")
        return {"error": str(e)}


@app.post("/initial-message")
async def initial_message():
    """
    Generate an initial conversation starter message with TTS audio.
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
        
        # Generate TTS audio for the initial message
        audio_base64 = generate_tts_audio(initial_message)

        return {
            "response": initial_message,
            "audio": audio_base64,
            "status": "complete"
        }

    except Exception as e:
        print(f"Error generating initial message: {e}")
        return {"error": str(e)}


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


# System prompt for evaluating review answers (comprehension questions)
REVIEW_EVALUATION_SYSTEM_PROMPT = """You are evaluating a Spanish language learner's answer to a comprehension question about a video.

You will be given:
- The question (in Spanish)
- The ideal/expected answer
- The user's answer
- Relevant transcript context from the video

Evaluate how close the user's answer is to the ideal answer. Consider:
- Semantic similarity (do they convey the same meaning?)
- Key concepts covered
- Language accuracy

Respond with only the reasoning for your score, why or why not they got the answer correct. Keep it to 1 sentence.
"""



# @app.post("/review-context")
# async def review_context(request: ReviewContextRequest):
#     """
#     Perform semantic search on Pinecone to find transcript segments
#     relevant to a question and its answer for a given video.
#     """
#     if not openai_client:
#         return {"error": "OpenAI API key not configured"}
#     if not pinecone_client:
#         return {"error": "Pinecone API key not configured"}

#     try:
#         # Combine question + answer into a search query
#         search_text = f"{request.search_query}"

#         # Generate embedding using OpenAI
#         # Using text-embedding-3-small to match the model used during ingestion
#         embedding_response = openai_client.embeddings.create(
#             model="text-embedding-3-large",
#             input=search_text,
#             dimensions=1536
#         )
#         query_vector = embedding_response.data[0].embedding

#         # Query Pinecone with the real embedding vector
#         index = pinecone_client.Index("spanish-video-transcripts")
#         results = index.query(
#             vector=query_vector,
#             filter={"video_id": {"$eq": request.video_id}},
#             top_k=4,
#             include_metadata=True
#         )

#         # Extract matching segments
#         segments = []
#         for match in results.matches:
#             metadata = match.metadata
#             print(f"[review-context] Match: segment_id={metadata.get('segment_id')}, "
#                   f"start={metadata.get('start')}, score={match.score:.4f}, "
#                   f"text={metadata.get('raw_text', '')[:80]}...")
            
#             if match.score < request.min_score:
#                 continue
#             segments.append({
#                 "segment_id": int(metadata.get("segment_id", 0)),
#                 "start": metadata.get("start"),
#                 "end": metadata.get("end"),
#                 "text": metadata.get("raw_text", ""),
#                 "score": match.score,
#             })

#         if len(segments) == 0:
#             max_score = max(match.score for match in results.matches)
#             max_score_match = next((match for match in results.matches if match.score == max_score), None)
#             segments.append({
#                 "segment_id": int(max_score_match.metadata.get("segment_id", 0)),
#                 "start": max_score_match.metadata.get("start"),
#                 "end": max_score_match.metadata.get("end"),
#                 "text": max_score_match.metadata.get("raw_text", ""),
#                 "score": max_score,
#             })
#         # Sort by score descending (most relevant first)
#         segments.sort(key=lambda x: x["score"], reverse=True)

#         return {
#             "segments": segments,
#             "status": "complete"
#         }
#     except Exception as e:
#         print(f"Error in review context search: {e}")
#         return {"error": str(e), "segments": []}


@app.post("/evaluate-review-answer")
async def evaluate_review_answer(request: EvaluateReviewAnswerRequest):
    """
    Evaluate a user's answer against the ideal answer using GPT.
    Returns feedback and a score classification for comprehension questions.
    """
    if not openai_client:
        return {"error": "OpenAI API key not configured"}

    try:
        # Build context from segments
        context_text = ""
        if request.context_segments:
            context_parts = [seg.get("text", "") for seg in request.context_segments if seg.get("text")]
            context_text = "\n".join(context_parts)

        user_prompt = f"""Question: {request.question}

Ideal answer: {request.ideal_answer}

User's answer: {request.user_answer}

{"Video transcript context:" + chr(10) + context_text if context_text else ""}

Evaluate the user's answer. Respond with a JSON object containing:
- "feedback": your evaluation in Spanish (1 sentence)
- "score": one of "correct", "partial", or "incorrect"
"""

        messages = [
            {"role": "system", "content": REVIEW_EVALUATION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ]

        response = openai_client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            max_tokens=300,
            temperature=0.5,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "evaluation_data",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "required": ["feedback", "score"],
                        "properties": {
                            "feedback": {"type": "string"},
                            "score": {"type": "string", "enum": ["correct", "partial", "incorrect"]}
                        },
                        "additionalProperties": False
                    }
                }
            }
        )

        evaluation = json.loads(response.choices[0].message.content.strip())

        return {
            "feedback": evaluation["feedback"],
            "score": evaluation["score"],
            "status": "complete"
        }
    except Exception as e:
        print(f"Error evaluating review answer: {e}")
        return {"error": str(e)}


@app.post("/evaluate-vocab-answer")
async def evaluate_vocab_answer(request: EvaluateReviewAnswerRequest):
    """
    Evaluate a user's vocabulary answer using GPT.
    Returns score and list of accepted translations.
    """
    if not openai_client:
        return {"error": "OpenAI API key not configured"}

    try:
        # Build context from segments
        context_text = ""
        if request.context_segments:
            context_parts = [seg.get("text", "") for seg in request.context_segments if seg.get("text")]
            context_text = "\n".join(context_parts)

        # Select prompt based on quiz type
        is_phrase = request.quiz_type == "phrase"
        system_prompt = PHRASE_EVALUATION_SYSTEM_PROMPT if is_phrase else VOCAB_EVALUATION_SYSTEM_PROMPT

        if is_phrase:
            user_prompt = f"""
Spanish phrase: "{request.vocab_word}"

User's English answer: {request.user_answer}

{"Video transcript context:" + chr(10) + context_text if context_text else ""}
"""
        else:
            user_prompt = f"""
{"Vocabulary word: " + request.vocab_word if request.vocab_word else ""}

User's answer: {request.user_answer}

{"Video transcript context (optional):" + chr(10) + context_text if context_text else ""}
"""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        response = openai_client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            max_tokens=300,
            temperature=0.5,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "vocab_evaluation_data",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "required": ["score", "accepted_answers"],
                        "properties": {
                            "score": {"type": "string", "enum": ["correct", "incorrect"]},
                            "accepted_answers": {
                                "type": "array",
                                "items": {"type": "string"}
                            }
                        },
                        "additionalProperties": False
                    }
                }
            }
        )

        evaluation = json.loads(response.choices[0].message.content.strip())

        return {
            "score": evaluation["score"],
            "accepted_answers": evaluation["accepted_answers"],
            "status": "complete"
        }
    except Exception as e:
        print(f"Error evaluating vocab answer: {e}")
        return {"error": str(e)}


@app.post("/translation-insights")
async def translation_insights(request: TranslationInsightsRequest):
    """
    Extract proper nouns (characters, places) from a sentence and
    translate each word in the context of the sentence.
    """
    if not openai_client:
        return {"error": "OpenAI API key not configured"}

    try:
        user_prompt = f"""Original text: "{request.text}"

Identify all proper nouns (character names, place names, or any word that requires capitalization because it is a proper noun) in the original text. Return them as a list."""

        messages = [
            {"role": "system", "content": "You are a linguistic analysis assistant. Given a sentence, identify all proper nouns (names of people, characters, places, etc.) in the original text. Only include words that are inherently proper nouns — names of specific people, characters, places, organizations, etc. Do NOT include common words that merely appear capitalized because they start a sentence or follow punctuation."},
            {"role": "user", "content": user_prompt}
        ]

        response = openai_client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            max_tokens=200,
            temperature=0.3,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "proper_nouns_data",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "required": ["proper_nouns"],
                        "properties": {
                            "proper_nouns": {
                                "type": "array",
                                "items": {"type": "string"}
                            }
                        },
                        "additionalProperties": False
                    }
                }
            }
        )

        result = json.loads(response.choices[0].message.content.strip())

        # Translate the full sentence using Google Translate
        translation = None
        try:
            translator = GoogleTranslator(source='auto', target=request.language)
            translation = translator.translate(request.text)
        except Exception as translate_err:
            print(f"Error translating sentence: {translate_err}")

        return {
            "proper_nouns": result["proper_nouns"],
            "translation": translation,
            "status": "complete"
        }
    except Exception as e:
        print(f"Error extracting translation insights: {e}")
        return {"error": str(e)}


@app.post("/evaluate-translation")
async def evaluate_translation(request: EvaluateTranslationRequest):
    """
    Evaluate a user's translation attempt against the correct translation.
    Returns an accuracy score from 0-100.
    """
    if not openai_client:
        return {"error": "OpenAI API key not configured"}

    try:
        user_prompt = f"""Original sentence: "{request.sentence_text}"
Correct translation ({request.translation_language}): "{request.translation}"
User's translation attempt: "{request.user_translation}"

Score the user's translation from 0 to 100 based on how accurately it captures the meaning of the original sentence. Consider semantic accuracy, not exact wording."""

        messages = [
            {"role": "system", "content": "You are a translation grading assistant. Score the user's translation attempt from 0 to 100 based on semantic accuracy. Be fair but not overly strict — accept paraphrases that capture the same meaning. Output ONLY valid JSON."},
            {"role": "user", "content": user_prompt}
        ]

        response = openai_client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            max_tokens=100,
            temperature=0.3,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "translation_score_data",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "required": ["score"],
                        "properties": {
                            "score": {"type": "integer"}
                        },
                        "additionalProperties": False
                    }
                }
            }
        )

        result = json.loads(response.choices[0].message.content.strip())

        return {
            "score": result["score"],
            "status": "complete"
        }
    except Exception as e:
        print(f"Error evaluating translation: {e}")
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
