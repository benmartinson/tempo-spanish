"""
Apple StoreKit 2 JWS receipt verification.

Validates the signed transaction JWS returned by the App Store (production and
sandbox). Sandbox covers TestFlight; the same verifier accepts both because we
pick the matching one based on the payload's `environment` field.
"""

import os
from pathlib import Path
from typing import List

from appstoreserverlibrary.signed_data_verifier import (
    SignedDataVerifier,
    VerificationException,
)
from appstoreserverlibrary.models.Environment import Environment


BUNDLE_ID = "com.benmartinson92.tempo"

_CERT_DIR = Path(__file__).parent / "apple_certs"


def _load_root_certs() -> List[bytes]:
    certs: List[bytes] = []
    for name in (
        "AppleRootCA-G3.cer",
        "AppleRootCA-G2.cer",
        "AppleIncRootCertificate.cer",
    ):
        path = _CERT_DIR / name
        certs.append(path.read_bytes())
    return certs


_ROOT_CERTS = _load_root_certs()

# App Apple ID is only required for certain App Store Server Notifications flows;
# not needed for verifying JWS transactions from client purchases.
_APP_APPLE_ID = None

_sandbox_verifier = SignedDataVerifier(
    root_certificates=_ROOT_CERTS,
    enable_online_checks=False,
    environment=Environment.SANDBOX,
    bundle_id=BUNDLE_ID,
    app_apple_id=_APP_APPLE_ID,
)

_production_verifier = SignedDataVerifier(
    root_certificates=_ROOT_CERTS,
    enable_online_checks=False,
    environment=Environment.PRODUCTION,
    bundle_id=BUNDLE_ID,
    app_apple_id=_APP_APPLE_ID,
)


class ReceiptVerificationError(Exception):
    """Raised when a JWS cannot be verified against Apple's signing chain."""


def verify_transaction_jws(signed_jws: str):
    """
    Verify a signed transaction JWS and return the decoded payload.

    Tries sandbox first, then production. Each verifier enforces that the JWS
    signature chains to Apple's roots AND that the payload's environment/bundleId
    match what the verifier was configured for — so if both fail, the JWS is
    either forged, tampered with, or for the wrong app.
    """
    errors = []
    for verifier in (_sandbox_verifier, _production_verifier):
        try:
            return verifier.verify_and_decode_signed_transaction(signed_jws)
        except VerificationException as e:
            errors.append(str(e))
    raise ReceiptVerificationError(
        f"JWS verification failed for both environments: {errors}"
    )
