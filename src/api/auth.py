"""
Authentication and credit-checking dependencies for FastAPI routes.

Uses Clerk-issued JWTs (RS256, "backend" template) verified via JWKS to:
1. Verify the caller's identity
2. Query the user_credits table via Supabase REST API (service role key)
"""

import os

import jwt
import httpx
from jwt import PyJWKClient
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("EXPO_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Clerk JWKS endpoints for verifying JWTs. During the domain migration we accept
# tokens from both the old mobile app Clerk instance and the new web Clerk
# instance.
CLERK_JWKS_URLS = [
    url
    for url in (
        os.getenv("CLERK_JWKS_URL"),
        os.getenv("CLERK_JWKS_URL_NEW"),
    )
    if url
]
if not CLERK_JWKS_URLS:
    raise RuntimeError("CLERK_JWKS_URL is not configured")

_jwks_clients = [
    PyJWKClient(jwks_url, cache_keys=True) for jwks_url in CLERK_JWKS_URLS
]

_bearer_scheme = HTTPBearer(auto_error=False)


async def verify_jwt(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> str:
    """Verify the Clerk JWT via JWKS and return the user_id."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = credentials.credentials
    payload = None
    saw_expired_token = False
    last_invalid_token_error = None
    unverified_issuer = None
    try:
        unverified_issuer = jwt.decode(
            token,
            options={"verify_signature": False, "verify_aud": False},
        ).get("iss")
    except Exception:
        pass

    for jwks_client in _jwks_clients:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                options={"verify_aud": False},
            )
            break
        except jwt.ExpiredSignatureError:
            saw_expired_token = True
        except jwt.InvalidTokenError as err:
            last_invalid_token_error = err
            continue
        except Exception as err:
            last_invalid_token_error = err
            continue

    if payload is None:
        if last_invalid_token_error:
            print(
                "Clerk JWT verification failed",
                {
                    "issuer": unverified_issuer,
                    "error": str(last_invalid_token_error),
                },
            )
        detail = "Token has expired" if saw_expired_token else "Invalid token"
        raise HTTPException(status_code=401, detail=detail)

    user_id = payload.get("user_id") or payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    return user_id


async def ensure_credits(user_id: str = Depends(verify_jwt)) -> str:
    """Verify the user has credits and return user_id."""
    if not SUPABASE_SERVICE_ROLE_KEY:
        print("SUPABASE_SERVICE_ROLE_KEY is not configured")
        raise HTTPException(status_code=500, detail="Credit check is not configured")

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }

    try:
        async with httpx.AsyncClient() as client:
            # Fetch current credits
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/user_credits",
                params={"user_id": f"eq.{user_id}", "select": "credits"},
                headers=headers,
            )

            if response.status_code != 200:
                print(f"Credit check failed: {response.status_code} - {response.text}")
                raise HTTPException(status_code=500, detail="Credit check failed")

            rows = response.json()
            if not rows or rows[0].get("credits", 0) <= 0:
                raise HTTPException(status_code=403, detail="Insufficient credits")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Credit check error: {e}")
        raise HTTPException(status_code=500, detail="Credit check failed")

    return user_id


async def deduct_credit(user_id: str) -> None:
    """Deduct 1 credit from the current user."""
    if not SUPABASE_SERVICE_ROLE_KEY:
        print("SUPABASE_SERVICE_ROLE_KEY is not configured")
        raise HTTPException(status_code=500, detail="Credit check is not configured")

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/user_credits",
                params={"user_id": f"eq.{user_id}", "select": "credits"},
                headers=headers,
            )

            if response.status_code != 200:
                print(f"Credit check failed: {response.status_code} - {response.text}")
                raise HTTPException(status_code=500, detail="Credit check failed")

            rows = response.json()
            if not rows or rows[0].get("credits", 0) <= 0:
                raise HTTPException(status_code=403, detail="Insufficient credits")

            # Deduct 1 credit
            current_credits = rows[0]["credits"]
            deduct_response = await client.patch(
                f"{SUPABASE_URL}/rest/v1/user_credits",
                params={"user_id": f"eq.{user_id}"},
                headers={**headers, "Content-Type": "application/json", "Prefer": "return=minimal"},
                json={"credits": current_credits - 1},
            )

            if deduct_response.status_code not in (200, 204):
                print(f"Credit deduction failed: {deduct_response.status_code} - {deduct_response.text}")
                raise HTTPException(status_code=500, detail="Credit deduction failed")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Credit check error: {e}")
        raise HTTPException(status_code=500, detail="Credit check failed")


async def check_credits(user_id: str = Depends(ensure_credits)) -> str:
    """Verify the user has credits, deduct 1, and return user_id."""
    await deduct_credit(user_id)
    return user_id
