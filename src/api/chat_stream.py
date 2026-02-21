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
import string
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
VOCAB_EVALUATION_SYSTEM_PROMPT = """You are evaluating a Spanish language learner's vocabulary knowledge.

You will be given:
- The question asking about a vocabulary word
- The correct translation of the word
- The user's answer (which may include a definition and/or a sentence using the word)
- Video transcript context showing how the word is used
- The specific vocabulary word being tested

Evaluate the user's understanding of the vocabulary word. Consider:
- Did they correctly understand the meaning of the word?
- If they used it in a sentence, did they use it correctly and naturally?
- Is their understanding consistent with how the word is used in the video context?

Respond in Spanish with only the reasoning for your score, why or why not they got the answer correct. Keep it to 1 sentence.
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


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


class SuggestionRequest(BaseModel):
    partial_transcript: str
    history: List[ChatMessage] = []


class AutocorrectRequest(BaseModel):
    transcript: str


class ReviewContextRequest(BaseModel):
    question: str
    answer: str
    video_id: str  # YouTube video_id for Pinecone metadata filter


class EvaluateReviewAnswerRequest(BaseModel):
    question: str
    ideal_answer: str
    user_answer: str
    context_segments: List[dict] = []
    additional_context: str | None = None  # Extra instructions for vocab quiz types
    vocab_word: str | None = None  # The vocab word being tested (for vocab quizzes)


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
            full_translation = metadata.get("full_translation", "")
            # this is an array of objects [{word, translations}]
            # vocab_map = []
            # # Function to check if consecutive words match a phrase
            # def find_phrase_matches(words_list, phrase):
            #     phrase_words = [w.strip(".,!?") for w in phrase.lower().split()]
            #     phrase_len = len(phrase_words)
            #     # also need to strip punctuation from the words
            #     words_list = [{**word, "word": word["word"].strip(".,!?")} for word in words_list]

            #     for i in range(len(words_list) - phrase_len + 1):
            #         # Check if consecutive words match the phrase
            #         if all(words_list[i + j]["word"].lower() == phrase_words[j]
            #                for j in range(phrase_len)):
            #             # Return the start time of first word and end time of last word
            #             return {
            #                 "start": words_list[i]["start"],
            #                 "end": words_list[i + phrase_len - 1]["end"],
            #                 "matched_words": [w["word"] for w in words_list[i:i + phrase_len]]
            #             }
            #     return None

            # Check each phrase in key_vocabulary
            # for vocab_item in key_vocabulary:
            #     word = vocab_item["word"]
            #     translations = vocab_item["translations"]
            #     # remove repeats from translations
            #     correct_translation_text = translations[-1]
            #     random.shuffle(translations)
            #     correct_translation_index = translations.index(correct_translation_text)
            #     if (len(translations) == 1):
            #         continue
            #     match = find_phrase_matches(words, word)

            #     if match:
            #         vocab_map.append({
            #             "value": word.capitalize(),
            #             "translations": translations,
            #             "correct_translation": correct_translation_index,
            #             "start": match["start"],
            #             "end": match["end"],
            #         })

            # vocab_map = []

            # usable_words = [word.copy() for word in words if not canIgnoreVocab(word["word"].lower()) and not word["word"].lower() == word["translation"].lower() and len(word["word"]) > 3]
            # for word in usable_words:
            #     word["word"] = word["word"].strip().lower().translate(str.maketrans('', '', string.punctuation))
            
            # num_words = min(len(usable_words), random.randint(4, 6))
            # selected_words = random.sample(usable_words, num_words)

            # for word in selected_words:
            #     vocab_map.append({
            #         "value": word["word"].capitalize(),
            #         "translations": [word["translation"].capitalize(), 'fake', 'fake'],
            #         "correct_translation": 0,
            #         "start": word["start"],
            #         "end": word["end"],
            #     })

            segments.append({
                "segment_id": int(metadata.get("segment_id", 0)),
                "start": metadata.get("start"),
                "end": metadata.get("end"),
                "text": metadata.get("raw_text", ""),
                "full_translation": full_translation,
                # "cefr_level": metadata.get("cefr_level"),
                # "key_vocabulary": vocab_map,
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
    if not openai_client:
        return {"error": "OpenAI API key not configured"}

    if not request.segments or len(request.segments) == 0:
        return {"error": "No segments provided"}

    try:
        # Use the first segment as the main segment for the question
        segments = request.segments
        text = ""
        for segment in segments:
            text += segment.text

        if not text:
            return {"error": "Segment has no text"}

        user_prompt = f"""Transcript segment: "{text}"

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

# System prompt for evaluating vocab quiz answers
VOCAB_EVALUATION_SYSTEM_PROMPT = """You are evaluating a Spanish language learner's vocabulary knowledge.

You will be given:
- The question asking about a vocabulary word
- The correct translation of the word
- The user's answer (which may include a definition and/or a sentence using the word)
- Video transcript context showing how the word is used
- The specific vocabulary word being tested

Evaluate the user's understanding of the vocabulary word. Consider:
- Did they correctly understand the meaning of the word?
- If they used it in a sentence, did they use it correctly and naturally?
- Is their understanding consistent with how the word is used in the video context?

Respond in Spanish with only the reasoning for your score, why or why not they got the answer correct. Keep it to 1 sentence.
"""

@app.post("/review-context")
async def review_context(request: ReviewContextRequest):
    """
    Perform semantic search on Pinecone to find transcript segments
    relevant to a question and its answer for a given video.
    """
    if not openai_client:
        return {"error": "OpenAI API key not configured"}
    if not pinecone_client:
        return {"error": "Pinecone API key not configured"}

    try:
        # Combine question + answer into a search query
        search_text = f"{request.search_query}"

        # Generate embedding using OpenAI
        # Using text-embedding-3-small to match the model used during ingestion
        embedding_response = openai_client.embeddings.create(
            model="text-embedding-3-large",
            input=search_text,
            dimensions=1536
        )
        query_vector = embedding_response.data[0].embedding

        # Query Pinecone with the real embedding vector
        index = pinecone_client.Index("spanish-video-transcripts")
        results = index.query(
            vector=query_vector,
            filter={"video_id": {"$eq": request.video_id}},
            top_k=4,
            include_metadata=True
        )

        # Extract matching segments
        segments = []
        for match in results.matches:
            metadata = match.metadata
            print(f"[review-context] Match: segment_id={metadata.get('segment_id')}, "
                  f"start={metadata.get('start')}, score={match.score:.4f}, "
                  f"text={metadata.get('raw_text', '')[:80]}...")
            
            if match.score < 0.55:
                continue
            segments.append({
                "segment_id": int(metadata.get("segment_id", 0)),
                "start": metadata.get("start"),
                "end": metadata.get("end"),
                "text": metadata.get("raw_text", ""),
                "score": match.score,
            })

        if len(segments) == 0:
            max_score = max(match.score for match in results.matches)
            max_score_match = next((match for match in results.matches if match.score == max_score), None)
            segments.append({
                "segment_id": int(max_score_match.metadata.get("segment_id", 0)),
                "start": max_score_match.metadata.get("start"),
                "end": max_score_match.metadata.get("end"),
                "text": max_score_match.metadata.get("raw_text", ""),
                "score": max_score,
            })
        # Sort by score descending (most relevant first)
        segments.sort(key=lambda x: x["score"], reverse=True)

        return {
            "segments": segments,
            "status": "complete"
        }
    except Exception as e:
        print(f"Error in review context search: {e}")
        return {"error": str(e), "segments": []}


@app.post("/evaluate-review-answer")
async def evaluate_review_answer(request: EvaluateReviewAnswerRequest):
    """
    Evaluate a user's answer against the ideal answer using GPT.
    Returns feedback and a score classification.
    Supports both comprehension questions and vocab quiz types.
    """
    if not openai_client:
        return {"error": "OpenAI API key not configured"}

    try:
        # Build context from segments
        context_text = ""
        if request.context_segments:
            context_parts = [seg.get("text", "") for seg in request.context_segments if seg.get("text")]
            context_text = "\n".join(context_parts)

        # Determine if this is a vocab quiz (has vocab_word or additional_context)
        is_vocab_quiz = request.vocab_word is not None or request.additional_context is not None

        if is_vocab_quiz:
            # Vocab quiz evaluation prompt
            user_prompt = f"""Question: {request.question}

Correct translation of the word: {request.ideal_answer}

{"Vocabulary word being tested: " + request.vocab_word if request.vocab_word else ""}

User's answer: {request.user_answer}

{"Video transcript context (showing how the word is used):" + chr(10) + context_text if context_text else ""}

{"Additional evaluation notes: " + request.additional_context if request.additional_context else ""}

Evaluate the user's vocabulary knowledge. Respond with a JSON object containing:
- "feedback": your evaluation in Spanish (1 sentence). Comment on their understanding of the word's meaning and their usage in a sentence if they provided one.
- "score": one of "correct", "partial", or "incorrect"
"""
            system_prompt = VOCAB_EVALUATION_SYSTEM_PROMPT
        else:
            # Comprehension quiz evaluation prompt (original behavior)
            user_prompt = f"""Question: {request.question}

Ideal answer: {request.ideal_answer}

User's answer: {request.user_answer}

{"Video transcript context:" + chr(10) + context_text if context_text else ""}

Evaluate the user's answer. Respond with a JSON object containing:
- "feedback": your evaluation in Spanish (1 sentence)
- "score": one of "correct", "partial", or "incorrect"
"""
            system_prompt = REVIEW_EVALUATION_SYSTEM_PROMPT

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
