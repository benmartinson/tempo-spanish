import os

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import verify_jwt, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY


router = APIRouter()

CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
CLERK_API_URL = os.getenv("CLERK_API_URL", "https://api.clerk.com")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")


class CreatorSignupRequest(BaseModel):
    channel_id: str


async def get_google_oauth_access_token(user_id: str) -> str:
    if not CLERK_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Creator signup is not configured")

    providers = ["oauth_google", "google"]
    async with httpx.AsyncClient(timeout=20) as client:
        for provider in providers:
            response = await client.get(
                f"{CLERK_API_URL}/v1/users/{user_id}/oauth_access_tokens/{provider}",
                headers={
                    "Authorization": f"Bearer {CLERK_SECRET_KEY}",
                    "Accept": "application/json",
                },
            )
            if response.status_code == 404:
                continue
            if response.status_code != 200:
                print(
                    f"Clerk OAuth token fetch failed: {response.status_code} - {response.text}"
                )
                raise HTTPException(
                    status_code=502,
                    detail="Could not verify Google account",
                )

            payload = response.json()
            tokens = payload.get("data") if isinstance(payload, dict) else payload
            if not isinstance(tokens, list) or not tokens:
                continue

            token = tokens[0].get("token") or tokens[0].get("access_token")
            if token:
                return token

    raise HTTPException(
        status_code=403,
        detail="Connect Google with YouTube access before becoming a creator",
    )


async def fetch_owned_youtube_channels(access_token: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            "https://www.googleapis.com/youtube/v3/channels",
            params={"part": "id,snippet", "mine": "true"},
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if response.status_code in (401, 403):
        print(f"YouTube ownership check failed: {response.status_code} - {response.text}")
        raise HTTPException(
            status_code=403,
            detail="Google must grant YouTube readonly access to verify channel ownership",
        )
    if response.status_code != 200:
        print(f"YouTube ownership check failed: {response.status_code} - {response.text}")
        raise HTTPException(status_code=502, detail="Could not verify YouTube channel")

    return response.json().get("items", [])


def serialize_youtube_channel(channel: dict) -> dict:
    snippet = channel.get("snippet") or {}
    thumbnails = snippet.get("thumbnails") or {}
    thumbnail = (
        thumbnails.get("default")
        or thumbnails.get("medium")
        or thumbnails.get("high")
        or {}
    )
    return {
        "id": channel.get("id"),
        "title": snippet.get("title"),
        "thumbnail_url": thumbnail.get("url"),
    }


def serialize_channel_search_result(item: dict) -> dict | None:
    snippet = item.get("snippet") or {}
    channel_id = snippet.get("channelId")
    if not channel_id:
        return None

    thumbnails = snippet.get("thumbnails") or {}
    thumbnail = (
        thumbnails.get("default")
        or thumbnails.get("medium")
        or thumbnails.get("high")
        or {}
    )
    return {
        "id": channel_id,
        "title": snippet.get("channelTitle") or snippet.get("title"),
        "description": snippet.get("description"),
        "thumbnail_url": thumbnail.get("url"),
    }


@router.get("/api/youtube-channel-search")
async def youtube_channel_search(q: str):
    query = q.strip()
    if not query:
        return {"channels": []}
    if not YOUTUBE_API_KEY:
        raise HTTPException(status_code=500, detail="YouTube search is not configured")

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "snippet",
                "type": "channel",
                "q": query,
                "maxResults": 8,
                "key": YOUTUBE_API_KEY,
            },
        )

    if response.status_code != 200:
        print(f"YouTube channel search failed: {response.status_code} - {response.text}")
        raise HTTPException(status_code=502, detail="Could not search YouTube channels")

    channels = [
        channel
        for item in response.json().get("items", [])
        if (channel := serialize_channel_search_result(item))
    ]
    return {"channels": channels}


@router.get("/api/youtube-channels")
async def youtube_channels(user_id: str = Depends(verify_jwt)):
    access_token = await get_google_oauth_access_token(user_id)
    owned_channels = await fetch_owned_youtube_channels(access_token)
    return {
        "channels": [
            serialize_youtube_channel(channel)
            for channel in owned_channels
            if channel.get("id")
        ]
    }


@router.post("/api/creator-signup")
async def creator_signup(
    request: CreatorSignupRequest,
    user_id: str = Depends(verify_jwt),
):
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Creator signup is not configured")

    channel_id = request.channel_id.strip()
    if not channel_id:
        raise HTTPException(status_code=400, detail="YouTube channel id is required")

    access_token = await get_google_oauth_access_token(user_id)
    owned_channels = await fetch_owned_youtube_channels(access_token)
    matching_channel = next(
        (channel for channel in owned_channels if channel.get("id") == channel_id),
        None,
    )

    if not matching_channel:
        raise HTTPException(
            status_code=403,
            detail="The connected Google account does not own this YouTube channel",
        )

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
    }
    payload = {
        "user_id": user_id,
        "role": "creator",
        "channel_id": channel_id,
    }

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            f"{SUPABASE_URL}/rest/v1/user_role",
            params={"on_conflict": "user_id,role"},
            headers=headers,
            json=payload,
        )

    if response.status_code not in (200, 201):
        print(f"Creator role upsert failed: {response.status_code} - {response.text}")
        raise HTTPException(status_code=500, detail="Could not save creator role")

    snippet = matching_channel.get("snippet") or {}
    return {
        "status": "complete",
        "channel_id": channel_id,
        "channel_title": snippet.get("title"),
    }
