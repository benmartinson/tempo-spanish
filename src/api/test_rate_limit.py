"""
Fire 25 rapid transcription requests to trigger Groq's 429 rate limit.
Usage: python test_rate_limit.py [audio_file]

If no audio file is provided, generates a short silent WAV.
"""

import asyncio
import sys
import struct
import httpx

BASE_URL = "http://localhost:8000"


def make_silent_wav(duration_s=1, sample_rate=16000):
    """Generate a minimal silent WAV file in memory."""
    num_samples = sample_rate * duration_s
    data_size = num_samples * 2  # 16-bit = 2 bytes per sample
    # WAV header
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, 1, sample_rate, sample_rate * 2, 2, 16,
        b"data", data_size,
    )
    return header + b"\x00" * data_size


async def main():
    if len(sys.argv) > 1:
        with open(sys.argv[1], "rb") as f:
            audio_data = f.read()
        filename = sys.argv[1]
    else:
        audio_data = make_silent_wav()
        filename = "test.wav"

    num_requests = 25
    print(f"Sending {num_requests} requests to {BASE_URL}/api/transcribe...")

    async with httpx.AsyncClient(timeout=120.0) as client:
        for i in range(num_requests):
            try:
                resp = await client.post(
                    f"{BASE_URL}/api/test_transcribe",
                    files={"file": (filename, audio_data, "audio/wav")},
                )
                status = resp.status_code
                text = resp.text[:100]
                print(f"[{i+1}/{num_requests}] {status} — {text}")
            except Exception as e:
                print(f"[{i+1}/{num_requests}] ERROR — {e}")

    print("\nDone. Check server logs for fallback behavior.")


if __name__ == "__main__":
    asyncio.run(main())
