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
import httpx
import stripe
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from elevenlabs.client import ElevenLabs

# Import the transcription router
from soniox_transcription import router as transcription_router
# Creator routes are intentionally hidden for this deploy. Keep the API module
# in the repo so the feature can be re-enabled without rebuilding it.
# from creator import router as creator_router
from openai_realtime import router as openai_realtime_router
from auth import verify_jwt, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
from iap_verification import verify_transaction_jws, ReceiptVerificationError

# Load environment variables
load_dotenv()

# OpenAI configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# ElevenLabs configuration
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
elevenlabs_client = ElevenLabs(api_key=ELEVENLABS_API_KEY) if ELEVENLABS_API_KEY else None

APP_ENV = os.getenv("APP_ENV", "prod").lower()
IS_DEV_ENV = APP_ENV == "dev"

STRIPE_SECRET_KEY = (
    os.getenv("DEV_STRIPE_SECRET_KEY") if IS_DEV_ENV else None
) or os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = (
    os.getenv("DEV_STRIPE_WEBHOOK_SECRET") if IS_DEV_ENV else None
) or os.getenv("STRIPE_WEBHOOK_SECRET")
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY



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
            voice_settings={"stability": 0.5, "similarity_boost": 0.75, "speed": 0.85},
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
SUGGESTION_SYSTEM_PROMPT = """You are helping a language learner write a short script or essay in their target language.
Given their full draft and the sentence they are actively writing, suggest natural continuations.

Rules:
- Suggestions should complete or meaningfully advance the active sentence.
- Keep each suggestion concise, usually 3-10 words.
- Match the target language, tone, and topic of the draft.
- Do not explain the suggestions."""

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


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


class SuggestionRequest(BaseModel):
    partial_transcript: str
    history: List[ChatMessage] = []


class WritingSuggestionsRequest(BaseModel):
    draft_text: str = ""
    active_sentence: str = ""
    target_language: str = "es"


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

DEFAULT_CORS_ALLOWED_ORIGINS = [
    "https://tempospanish.app",
    "https://www.tempospanish.app",
    "https://tempolanguage.com",
    "https://www.tempolanguage.com",
    "http://localhost:8081",
    "http://localhost:19006",
    "http://localhost:3000",
]
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        ",".join(DEFAULT_CORS_ALLOWED_ORIGINS),
    ).split(",")
    if origin.strip()
]

# Enable CORS for the web app origins. Keep this explicit because browser
# requests include auth headers and wildcard origins do not pair well with
# credentialed requests.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*", "OPTIONS"],  # Explicitly include OPTIONS for preflight
    allow_headers=[
        "*",
        "Upgrade",
        "Connection",
        "Sec-WebSocket-Key",
        "Sec-WebSocket-Version",
    ],
)

# Include the transcription router (provides /ws/transcribe endpoint)
app.include_router(transcription_router)
# Creator routes are hidden for this deploy.
# app.include_router(creator_router)
app.include_router(openai_realtime_router)


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
async def tts(request: TTSRequest, user_id: str = Depends(verify_jwt)):
    """Generate TTS audio for arbitrary text."""
    audio_base64 = generate_tts_audio(request.text)
    if audio_base64 is None:
        return {"error": "TTS generation failed or ElevenLabs not configured"}
    return {"audio": audio_base64, "status": "complete"}


@app.post("/writing-suggestions")
async def writing_suggestions(
    request: WritingSuggestionsRequest, user_id: str = Depends(verify_jwt)
):
    """Generate short continuation suggestions for the compose page."""
    if not openai_client:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    language_names = {
        "es": "Spanish",
        "en": "English",
        "pt": "Portuguese",
        "de": "German",
        "fr": "French",
    }
    target_language = language_names.get(
        request.target_language.lower(), request.target_language
    )

    user_prompt = f"""Target language: {target_language}

Full draft:
{request.draft_text.strip() or "(empty)"}

Active sentence:
{request.active_sentence.strip() or "(empty)"}

Return three distinct continuations the user could insert next."""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": SUGGESTION_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=240,
            temperature=0.7,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "writing_suggestions_data",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "required": ["suggestions"],
                        "properties": {
                            "suggestions": {
                                "type": "array",
                                "minItems": 3,
                                "maxItems": 3,
                                "items": {
                                    "type": "object",
                                    "required": ["label", "insertText"],
                                    "properties": {
                                        "label": {"type": "string"},
                                        "insertText": {"type": "string"},
                                    },
                                    "additionalProperties": False,
                                },
                            }
                        },
                        "additionalProperties": False,
                    },
                }
            },
        )

        result = json.loads(response.choices[0].message.content.strip())
        return {
            "suggestions": result.get("suggestions", [])[:3],
            "status": "complete",
        }
    except Exception as e:
        print(f"Error generating writing suggestions: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate suggestions")


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

class FetchVocabTranslationRequest(BaseModel):
    vocab_word: str
    sentence_text: str
    sentence_translation: str | None = None


VOCAB_TRANSLATION_SYSTEM_PROMPT = """You are a Spanish-to-English translation assistant.

Given a Spanish vocabulary word, the sentence it appears in, and the full English translation of that sentence, provide the single English translation of the word AS IT IS USED in that specific sentence.

Important:
- Many Spanish words have multiple meanings depending on context. You MUST choose the meaning that fits THIS sentence.
- Use the provided sentence translation to determine the correct meaning — find which English word(s) correspond to the Spanish word in question.
- Provide exactly ONE concise translation (1-3 words max).
- Do NOT provide definitions, explanations, or full sentence translations.

Output ONLY valid JSON in this format:
{
  "translation": "the single best English translation for this context"
}
"""


@app.post("/fetch-vocab-translation")
async def fetch_vocab_translation(request: FetchVocabTranslationRequest, user_id: str = Depends(verify_jwt)):
    """
    Fetch the in-context English translation of a Spanish vocabulary word.
    """
    if not openai_client:
        return {"error": "OpenAI API key not configured"}

    try:
        translation_line = ""
        if request.sentence_translation:
            translation_line = f'\nEnglish translation of the sentence: "{request.sentence_translation}"'

        user_prompt = f"""Spanish word: "{request.vocab_word}"
Sentence it appears in: "{request.sentence_text}"{translation_line}

What does "{request.vocab_word}" mean in this sentence?"""

        messages = [
            {"role": "system", "content": VOCAB_TRANSLATION_SYSTEM_PROMPT},
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
                    "name": "vocab_translation_data",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "required": ["translation"],
                        "properties": {
                            "translation": {"type": "string"}
                        },
                        "additionalProperties": False
                    }
                }
            }
        )

        result = json.loads(response.choices[0].message.content.strip())

        # Parallel call for alternate meanings
        alt_messages = [
            {"role": "system", "content": "Given a Spanish word, list up to 3 other common English meanings of this word that are NOT the meaning used in the given sentence. Only include meanings that are genuinely different from the in-context meaning. If the word has fewer than 2 other common meanings, return fewer. Each meaning should be 1-3 words. Output valid JSON."},
            {"role": "user", "content": f'Spanish word: "{request.vocab_word}"\nIn-context meaning: "{result["translation"]}"\nSentence: "{request.sentence_text}"'}
        ]

        alt_response = openai_client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=alt_messages,
            max_tokens=100,
            temperature=0.3,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "alternate_meanings_data",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "required": ["meanings"],
                        "properties": {
                            "meanings": {
                                "type": "array",
                                "items": {"type": "string"}
                            }
                        },
                        "additionalProperties": False
                    }
                }
            }
        )

        alt_result = json.loads(alt_response.choices[0].message.content.strip())

        return {
            "translation": result["translation"],
            "alternate_meanings": alt_result.get("meanings", [])[:3],
            "status": "complete"
        }
    except Exception as e:
        print(f"Error fetching vocab translation: {e}")
        return {"error": str(e)}


@app.post("/translation-insights")
async def translation_insights(request: TranslationInsightsRequest, user_id: str = Depends(verify_jwt)):
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


CREDIT_AMOUNTS = {
    "tempo_credits_1000": 1000,
    "tempo_credits_5000": 5000,
    "tempo_credits_10000": 10000,
}

STRIPE_PRODUCTS = {
    "tempo_credits_1000": {
        "product_id": (
            os.getenv("DEV_STRIPE_PRODUCT_TEMPO_CREDITS_1000")
            if IS_DEV_ENV
            else None
        )
        or ("prod_UT6y66FOIchjjh" if IS_DEV_ENV else "prod_UT5jIC5ggJsCcT"),
        "unit_amount": 299,
    },
    "tempo_credits_5000": {
        "product_id": (
            os.getenv("DEV_STRIPE_PRODUCT_TEMPO_CREDITS_5000")
            if IS_DEV_ENV
            else None
        )
        or ("prod_UT6zGflC3ieXfb" if IS_DEV_ENV else "prod_UT5nHiAxqcDWhW"),
        "unit_amount": 699,
    },
    "tempo_credits_10000": {
        "product_id": (
            os.getenv("DEV_STRIPE_PRODUCT_TEMPO_CREDITS_10000")
            if IS_DEV_ENV
            else None
        )
        or ("prod_UT6zcoeblaerlX" if IS_DEV_ENV else "prod_UT5plFmDQMXUsx"),
        "unit_amount": 999,
    },
}


class VerifyPurchaseRequest(BaseModel):
    purchase_token: str
    product_id: str


class CreateCheckoutSessionRequest(BaseModel):
    product_id: str
    success_url: str
    cancel_url: str


def stripe_object_value(obj, key: str, default=None):
    if isinstance(obj, dict):
        return obj.get(key, default)

    try:
        return obj[key]
    except (KeyError, TypeError):
        return default


async def fetch_user_credits(user_id: str) -> int | None:
    if not SUPABASE_SERVICE_ROLE_KEY:
        print("SUPABASE_SERVICE_ROLE_KEY is not configured")
        raise HTTPException(status_code=500, detail="Credit service is not configured")

    service_headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/user_credits",
            params={"user_id": f"eq.{user_id}", "select": "credits"},
            headers=service_headers,
        )

    if response.status_code != 200:
        print(f"Credit fetch failed: {response.status_code} - {response.text}")
        raise HTTPException(status_code=500, detail="Failed to fetch credits")

    rows = response.json()
    if not rows:
        return None

    return rows[0]["credits"]


@app.get("/api/user-credits")
async def get_user_credits(user_id: str = Depends(verify_jwt)):
    credits = await fetch_user_credits(user_id)
    return {"credits": credits}


async def grant_credits_for_transaction(
    *,
    transaction_id: str,
    user_id: str,
    product_id: str,
    credits_to_add: int,
    environment: str,
) -> int | None:
    """Record a purchase transaction and add credits once.

    Returns the new balance, or None if the transaction was already processed.
    """
    if not SUPABASE_SERVICE_ROLE_KEY:
        print("SUPABASE_SERVICE_ROLE_KEY is not configured")
        raise HTTPException(status_code=500, detail="Purchase service is not configured")

    service_headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        insert_response = await client.post(
            f"{SUPABASE_URL}/rest/v1/iap_transactions",
            headers={**service_headers, "Prefer": "return=minimal"},
            json={
                "transaction_id": transaction_id,
                "user_id": user_id,
                "product_id": product_id,
                "environment": environment,
                "credits_granted": credits_to_add,
            },
        )

        if insert_response.status_code == 409:
            return None
        if insert_response.status_code not in (200, 201, 204):
            print(
                f"iap_transactions insert failed: "
                f"{insert_response.status_code} - {insert_response.text}"
            )
            raise HTTPException(status_code=500, detail="Failed to record transaction")

        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/user_credits",
            params={"user_id": f"eq.{user_id}", "select": "credits"},
            headers=service_headers,
        )

        if response.status_code != 200:
            print(f"Credit fetch failed: {response.status_code} - {response.text}")
            raise HTTPException(status_code=500, detail="Failed to verify credits")

        rows = response.json()
        if not rows:
            raise HTTPException(status_code=404, detail="User credits not found")

        current_credits = rows[0]["credits"]
        new_credits = current_credits + credits_to_add

        update_response = await client.patch(
            f"{SUPABASE_URL}/rest/v1/user_credits",
            params={"user_id": f"eq.{user_id}"},
            headers={**service_headers, "Prefer": "return=minimal"},
            json={"credits": new_credits},
        )

        if update_response.status_code not in (200, 204):
            print(f"Credit update failed: {update_response.status_code} - {update_response.text}")
            raise HTTPException(status_code=500, detail="Failed to add credits")

    return new_credits


@app.post("/api/create-checkout-session")
async def create_checkout_session(
    request: CreateCheckoutSessionRequest,
    user_id: str = Depends(verify_jwt),
):
    credits_to_add = CREDIT_AMOUNTS.get(request.product_id)
    stripe_product = STRIPE_PRODUCTS.get(request.product_id)

    if not credits_to_add or not stripe_product:
        raise HTTPException(status_code=400, detail="Invalid product")
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured")

    metadata = {
        "user_id": user_id,
        "product_id": request.product_id,
        "credits": str(credits_to_add),
    }

    try:
        session = await asyncio.to_thread(
            stripe.checkout.Session.create,
            mode="payment",
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product": stripe_product["product_id"],
                        "unit_amount": stripe_product["unit_amount"],
                    },
                    "quantity": 1,
                }
            ],
            success_url=request.success_url,
            cancel_url=request.cancel_url,
            client_reference_id=user_id,
            metadata=metadata,
            payment_intent_data={"metadata": metadata},
        )
        return {"url": session.url}
    except Exception as e:
        print(f"Stripe checkout session creation failed: {e}")
        raise HTTPException(status_code=500, detail="Could not start checkout")


@app.post("/api/stripe-webhook")
async def stripe_webhook(request: Request):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Stripe webhook is not configured")

    payload = await request.body()
    signature = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload,
            signature,
            STRIPE_WEBHOOK_SECRET,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if stripe_object_value(event, "type") == "checkout.session.completed":
        event_data = stripe_object_value(event, "data", {})
        session = stripe_object_value(event_data, "object", {})
        payment_status = stripe_object_value(session, "payment_status")
        session_id = stripe_object_value(session, "id")

        if payment_status != "paid":
            return {"received": True}

        metadata = stripe_object_value(session, "metadata", {}) or {}
        user_id = stripe_object_value(metadata, "user_id") or stripe_object_value(
            session,
            "client_reference_id",
        )
        product_id = stripe_object_value(metadata, "product_id")
        credits_to_add = CREDIT_AMOUNTS.get(product_id)

        if not session_id or not user_id or not product_id or not credits_to_add:
            print(f"Stripe checkout session missing metadata: {session_id}")
            raise HTTPException(status_code=400, detail="Missing checkout metadata")

        await grant_credits_for_transaction(
            transaction_id=f"stripe:{session_id}",
            user_id=user_id,
            product_id=product_id,
            credits_to_add=credits_to_add,
            environment="Stripe",
        )

    return {"received": True}


@app.post("/api/verify-purchase")
async def verify_purchase(request: VerifyPurchaseRequest, user_id: str = Depends(verify_jwt)):
    """
    Verify an Apple IAP signed transaction (JWS) and add credits to the user's
    account. Uses the service role key to bypass RLS for credit additions.

    Security:
      - Validates the JWS signature chain against Apple's root CAs.
      - Confirms bundleId and productId in the payload match expectations.
      - Inserts the Apple transactionId into iap_transactions with a unique
        constraint; a replay of the same JWS returns 409 without granting more
        credits.
    """
    credits_to_add = CREDIT_AMOUNTS.get(request.product_id)
    if not credits_to_add:
        raise HTTPException(status_code=400, detail="Invalid product")

    if not SUPABASE_SERVICE_ROLE_KEY:
        print("SUPABASE_SERVICE_ROLE_KEY is not configured")
        raise HTTPException(status_code=500, detail="Purchase service is not configured")

    try:
        payload = verify_transaction_jws(request.purchase_token)
    except ReceiptVerificationError as e:
        print(f"Receipt verification failed for user {user_id}: {e}")
        raise HTTPException(status_code=403, detail="Invalid receipt")

    if payload.productId != request.product_id:
        print(
            f"Product ID mismatch: receipt has {payload.productId}, "
            f"request claims {request.product_id}"
        )
        raise HTTPException(status_code=400, detail="Product mismatch")

    transaction_id = payload.transactionId
    environment = payload.environment.value if payload.environment else "Unknown"

    try:
        new_credits = await grant_credits_for_transaction(
            transaction_id=transaction_id,
            user_id=user_id,
            product_id=request.product_id,
            credits_to_add=credits_to_add,
            environment=environment,
        )
        if new_credits is None:
            raise HTTPException(
                status_code=409, detail="Transaction already processed"
            )
        return {"credits": new_credits, "status": "complete"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Purchase verification error: {e}")
        raise HTTPException(status_code=500, detail="Purchase verification failed")


CLERK_SECRET_KEYS = [
    key
    for key in (
        os.getenv("CLERK_SECRET_KEY"),
        os.getenv("CLERK_SECRET_KEY_NEW"),
    )
    if key
]
CLERK_API_URL = os.getenv("CLERK_API_URL", "https://api.clerk.com")

# Tables keyed directly by user_id. Order is not significant — none have FKs
# pointing at each other.
USER_OWNED_TABLES = [
    "iap_transactions",
    "user_known_vocab",
    "user_ui_state",
    "user_credits",
]

# Tables whose rows are owned via a video_views FK. PostgREST can't do
# subqueries in DELETE, so we first collect video_view ids and then pass
# them as an `in.(...)` filter.
VIDEO_VIEW_CHILD_TABLES = [
    "video_view_focus_vocab",
    "video_view_focus_sentence",
]


@app.post("/api/delete-account")
async def delete_account(user_id: str = Depends(verify_jwt)):
    """
    Delete all app data for the caller, then delete the Clerk user.

    Order matters: app data first (while the Clerk JWT is still valid isn't
    relevant here since we use the service role key, but deleting the Clerk
    user first would leave a small window where the user could still fire
    requests with a cached token. Cleaning app rows first keeps things tidy.)
    """
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Delete is not configured")
    if not CLERK_SECRET_KEYS:
        raise HTTPException(status_code=500, detail="Delete is not configured")

    service_headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient() as client:
            # 1. Fetch video_view ids owned by this user (for cascaded deletion).
            vv_resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/video_views",
                params={"user_id": f"eq.{user_id}", "select": "id"},
                headers=service_headers,
            )
            if vv_resp.status_code != 200:
                print(f"video_views fetch failed: {vv_resp.status_code} - {vv_resp.text}")
                raise HTTPException(status_code=500, detail="Failed to delete account")
            video_view_ids = [row["id"] for row in vv_resp.json()]

            # 2. Delete child rows referencing those video_views.
            if video_view_ids:
                in_list = ",".join(str(i) for i in video_view_ids)
                for table in VIDEO_VIEW_CHILD_TABLES:
                    resp = await client.delete(
                        f"{SUPABASE_URL}/rest/v1/{table}",
                        params={"video_view_id": f"in.({in_list})"},
                        headers=service_headers,
                    )
                    if resp.status_code not in (200, 204):
                        print(f"{table} delete failed: {resp.status_code} - {resp.text}")
                        raise HTTPException(status_code=500, detail="Failed to delete account")

            # 3. Delete video_views.
            vv_del = await client.delete(
                f"{SUPABASE_URL}/rest/v1/video_views",
                params={"user_id": f"eq.{user_id}"},
                headers=service_headers,
            )
            if vv_del.status_code not in (200, 204):
                print(f"video_views delete failed: {vv_del.status_code} - {vv_del.text}")
                raise HTTPException(status_code=500, detail="Failed to delete account")

            # 4. Delete remaining user-owned tables.
            for table in USER_OWNED_TABLES:
                resp = await client.delete(
                    f"{SUPABASE_URL}/rest/v1/{table}",
                    params={"user_id": f"eq.{user_id}"},
                    headers=service_headers,
                )
                if resp.status_code not in (200, 204):
                    print(f"{table} delete failed: {resp.status_code} - {resp.text}")
                    raise HTTPException(status_code=500, detail="Failed to delete account")

            # 5. Delete the Clerk user from whichever Clerk instance owns it.
            # 404 means "not in this instance", so try the next configured key.
            clerk_deleted = False
            clerk_not_found = False
            clerk_errors = []
            for clerk_secret_key in CLERK_SECRET_KEYS:
                clerk_resp = await client.delete(
                    f"{CLERK_API_URL}/v1/users/{user_id}",
                    headers={"Authorization": f"Bearer {clerk_secret_key}"},
                )
                if clerk_resp.status_code in (200, 204):
                    clerk_deleted = True
                    break
                if clerk_resp.status_code == 404:
                    clerk_not_found = True
                    continue
                clerk_errors.append(
                    f"{clerk_resp.status_code} - {clerk_resp.text}"
                )

            if not clerk_deleted and clerk_errors:
                print(f"Clerk delete failed: {'; '.join(clerk_errors)}")
                raise HTTPException(status_code=500, detail="Failed to delete account")
            if not clerk_deleted and not clerk_not_found:
                raise HTTPException(status_code=500, detail="Failed to delete account")

        return {"status": "ok"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete account error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete account")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
