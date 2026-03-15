"""
Backfill script for sentence_insights table.

For every video in the 'video' table:
  1. Fetch its transcript_segment rows
  2. Split segments into sentences (Python port of splitSegmentsIntoSentences)
  3. Run translation-insights logic (proper nouns + words-in-context)
  4. Upsert results into sentence_insights

Usage:
  python backfill_sentence_insights.py [--language en] [--video-id 123]
"""

import argparse
import json
import os
import re
import time

import requests as http_requests

from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client, Client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

SUPABASE_URL = os.environ["EXPO_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["EXPO_PUBLIC_SUPABASE_ANON_KEY"]
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
BABELFY_KEY = os.environ["BABELFY_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
openai_client = OpenAI(api_key=OPENAI_API_KEY)


# ---------------------------------------------------------------------------
# Python port of splitIntoSentences / splitSegmentsIntoSentences
# ---------------------------------------------------------------------------

def split_into_sentences(words: list[dict]) -> list[list[dict]]:
    """Split a list of word dicts into groups by sentence-ending punctuation."""
    sentences: list[list[dict]] = []
    current: list[dict] = []
    for w in words:
        w["word"] = w["word"].strip()
        current.append(w)
        if re.search(r"[.!?]$", w["word"]):
            sentences.append(current)
            current = []
    if current:
        sentences.append(current)
    return sentences


def split_segments_into_sentences(segments: list[dict]) -> list[dict]:
    """Return a flat list of sentence dicts with index, start, end, text, words."""
    all_sentences: list[dict] = []
    sentence_index = 0
    for segment in segments:
        word_groups = split_into_sentences(segment.get("words", []))
        for words in word_groups:
            if not words:
                continue
            text = " ".join(w["word"] for w in words)
            start = words[0]["start"]
            end = words[-1]["end"]
            all_sentences.append({
                "index": sentence_index,
                "start": start,
                "end": end,
                "text": text,
                "words": words,
            })
            sentence_index += 1
    return all_sentences


# ---------------------------------------------------------------------------
# Translation insights (mirrors the FastAPI endpoint logic)
# ---------------------------------------------------------------------------

def extract_proper_nouns(text: str) -> list[str]:
    """Use OpenAI to identify proper nouns in the text."""
    user_prompt = (
        f'Original text: "{text}"\n\n'
        "Identify all proper nouns (character names, place names, or any word "
        "that requires capitalization because it is a proper noun) in the "
        "original text. Return them as a list."
    )
    response = openai_client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a linguistic analysis assistant. Given a sentence, "
                    "identify all proper nouns (names of people, characters, places, etc.) "
                    "in the original text. Only include words that are inherently proper "
                    "nouns — names of specific people, characters, places, organizations, "
                    "etc. Do NOT include common words that merely appear capitalized "
                    "because they start a sentence or follow punctuation."
                ),
            },
            {"role": "user", "content": user_prompt},
        ],
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
                            "items": {"type": "string"},
                        }
                    },
                    "additionalProperties": False,
                },
            },
        },
    )
    result = json.loads(response.choices[0].message.content.strip())
    return result["proper_nouns"]


def translate_words_in_context(text: str, target_language: str = "en") -> list[dict]:
    """
    Use Babelfy to disambiguate words in context, then fetch translations
    from BabelNet for each synset.
    """
    words = text.split()
    if not words:
        return []

    # Step 1: Disambiguate with Babelfy
    babelfy_url = "https://babelfy.io/v1/disambiguate"
    params = {
        "text": text,
        "lang": "ES",
        "key": BABELFY_KEY,
    }
    resp = http_requests.get(babelfy_url, params=params)
    resp.raise_for_status()
    disambiguated = resp.json()

    # Map each word position to its BabelSynset ID
    word_synsets: dict[int, str] = {}
    for entry in disambiguated:
        token_fragment = entry.get("tokenFragment", {})
        start_token = token_fragment.get("start")
        end_token = token_fragment.get("end")
        synset_id = entry.get("babelSynsetID")
        if start_token is not None and synset_id:
            for idx in range(start_token, end_token + 1):
                if idx not in word_synsets:
                    word_synsets[idx] = synset_id

    # Step 2: Fetch translations from BabelNet for each unique synset
    babel_lang = target_language.upper()
    unique_synsets = set(word_synsets.values())
    synset_translations: dict[str, str] = {}

    for synset_id in unique_synsets:
        try:
            bn_url = "https://babelnet.io/v9/getSynset"
            bn_params = {
                "id": synset_id,
                "targetLang": babel_lang,
                "key": BABELFY_KEY,
            }
            bn_resp = http_requests.get(bn_url, params=bn_params)
            bn_resp.raise_for_status()
            synset_data = bn_resp.json()

            # Get the first sense in the target language
            senses = synset_data.get("senses", [])
            for sense in senses:
                props = sense.get("properties", {})
                if props.get("language") == babel_lang:
                    synset_translations[synset_id] = props.get("fullLemma", "")
                    break
        except Exception as e:
            print(f"    BabelNet lookup failed for {synset_id}: {e}")

    # Step 3: Build results list matching original word order
    results = []
    for i, word in enumerate(words):
        translation = ""
        synset_id = word_synsets.get(i)
        if synset_id:
            translation = synset_translations.get(synset_id, "")
        results.append({"word": word, "translation": translation})

    return results


def get_translation_insights(text: str, language: str) -> dict:
    """Combine proper-noun extraction and word-in-context translation."""
    proper_nouns = extract_proper_nouns(text)
    words_in_context = translate_words_in_context(text, language)
    return {"proper_nouns": proper_nouns, "words_in_context": words_in_context}


# ---------------------------------------------------------------------------
# Main backfill
# ---------------------------------------------------------------------------

def fetch_all_videos(single_video_id: int | None = None) -> list[dict]:
    query = supabase.table("video").select("id")
    if single_video_id is not None:
        query = query.eq("id", single_video_id)
    resp = query.execute()
    return resp.data


def fetch_transcript_segments(video_id: int) -> list[dict]:
    resp = (
        supabase.table("transcript_segment")
        .select("*")
        .eq("video_id", video_id)
        .order("segment_id")
        .execute()
    )
    return resp.data


def backfill(language: str = "en", single_video_id: int | None = None, test: bool = False):
    words_in_context_col = f"words_in_context_{language}"
    videos = fetch_all_videos(single_video_id)
    print(f"Processing {len(videos)} video(s) with language={language}")
    if test:
        print("TEST MODE — results will be printed, not saved.\n")

    for vid in videos:
        video_id = vid["id"]
        print(f"\n--- Video {video_id} ---")
        segments = fetch_transcript_segments(video_id)
        if not segments:
            print("  No transcript segments, skipping.")
            continue

        sentences = split_segments_into_sentences(segments)
        print(f"  {len(segments)} segments -> {len(sentences)} sentences")

        for sentence in sentences:
            sentence_index = sentence["index"]
            text = sentence["text"]

            if not test:
                # Check if already cached
                existing = (
                    supabase.table("sentence_insights")
                    .select(f"proper_nouns, {words_in_context_col}")
                    .eq("video_id", video_id)
                    .eq("sentence_index", sentence_index)
                    .maybe_single()
                    .execute()
                )

                if existing.data:
                    has_nouns = existing.data.get("proper_nouns") is not None
                    has_words = existing.data.get(words_in_context_col) is not None
                    if has_nouns and has_words:
                        print(f"  [{sentence_index}] already cached, skipping.")
                        continue

            print(f"  [{sentence_index}] processing: {text[:60]}...")
            try:
                insights = get_translation_insights(text, language)

                if test:
                    print(f"  [{sentence_index}] proper_nouns: {insights['proper_nouns']}")
                    for w in insights["words_in_context"]:
                        print(f"    {w['word']} -> {w['translation']}")
                else:
                    supabase.table("sentence_insights").upsert(
                        {
                            "video_id": video_id,
                            "sentence_index": sentence_index,
                            "proper_nouns": insights["proper_nouns"],
                            words_in_context_col: insights["words_in_context"],
                        },
                        on_conflict="video_id,sentence_index",
                    ).execute()
            except Exception as e:
                print(f"  [{sentence_index}] ERROR: {e}")
                time.sleep(1)
                continue

            # Small delay to be kind to rate limits
            time.sleep(0.2)

    print("\nDone.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill sentence_insights table")
    parser.add_argument(
        "--language",
        default="en",
        help="Target translation language (default: en)",
    )
    parser.add_argument(
        "--video-id",
        type=int,
        default=None,
        help="Process only a single video ID",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Print results to console instead of saving to Supabase",
    )
    args = parser.parse_args()
    backfill(language=args.language, single_video_id=args.video_id, test=args.test)
