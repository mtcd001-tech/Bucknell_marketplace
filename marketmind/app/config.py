"""Configuration, read from the environment only.

This service never writes a .env file. `load_dotenv()` reads one if it exists
so local dev works, but every value has to be set by you.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

# The Anthropic SDK reads ANTHROPIC_API_KEY from the environment itself; it is
# not read directly here, and must never be logged or returned in a response.
ANTHROPIC_API_KEY_PRESENT = bool(os.getenv("ANTHROPIC_API_KEY"))

MODEL = os.getenv("MARKETMIND_MODEL", "claude-opus-5")

# Max images accepted per draft request. The Sell form caps uploads at 4.
MAX_IMAGES = 4

# Reject oversized uploads before spending an API call on them.
MAX_IMAGE_BYTES = 5 * 1024 * 1024

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
