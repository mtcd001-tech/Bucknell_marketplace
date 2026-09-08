"""MarketMind -- the AI service behind the Sell form's "Draft with AI" button.

Call path:  browser -> Node/Express -> THIS SERVICE -> Gemini API.
The browser never calls this service directly, and the Gemini API key exists
only here.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from .config import (
    ALLOWED_IMAGE_TYPES,
    GEMINI_API_KEY_PRESENT,
    MAX_IMAGE_BYTES,
    MAX_IMAGES,
    MODEL,
)
from .drafting import DraftingError, draft_listing
from .schemas import DraftListingServiceResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("marketmind")

app = FastAPI(title="MarketMind", version="0.1.0")

# NOTE: no CORS middleware on purpose. Only the Node backend calls this service,
# server-to-server, and CORS governs browsers. Adding permissive CORS here would
# let any webpage hit the endpoint directly and spend your Gemini quota.


@app.get("/health")
def health() -> dict:
    """Liveness probe. Reports whether a key is configured -- never its value."""
    return {
        "status": "ok",
        "model": MODEL,
        "geminiKeyConfigured": GEMINI_API_KEY_PRESENT,
    }


@app.post("/draft-listing", response_model=DraftListingServiceResponse)
async def draft_listing_endpoint(
    images: list[UploadFile] = File(..., description="1-4 photos of the item"),
    notes: str | None = Form(None, description="Optional seller-typed notes"),
) -> DraftListingServiceResponse:
    if not images:
        raise HTTPException(status_code=400, detail="at least one image is required")
    if len(images) > MAX_IMAGES:
        raise HTTPException(
            status_code=400, detail=f"at most {MAX_IMAGES} images are accepted"
        )

    payloads: list[tuple[bytes, str]] = []
    for upload in images:
        media_type = (upload.content_type or "").lower()
        if media_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"unsupported image type {media_type or 'unknown'}",
            )
        data = await upload.read()
        if not data:
            raise HTTPException(status_code=400, detail=f"{upload.filename} is empty")
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"{upload.filename} is larger than {MAX_IMAGE_BYTES // (1024 * 1024)}MB",
            )
        payloads.append((data, media_type))

    try:
        response, internals = draft_listing(images=payloads, seller_notes=notes)
    except DraftingError as exc:
        # 502: this service is fine, the thing it depends on isn't. The Node
        # layer turns this into "draft unavailable" and the seller types the
        # listing manually -- posting must never depend on the AI.
        logger.warning("draft failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    logger.info(
        "drafted %r as %s/%s at $%s via %s (in=%s out=%s tokens)",
        response.title,
        response.category,
        response.condition,
        response.suggestedPrice,
        internals["pricingStrategy"],
        internals["inputTokens"],
        internals["outputTokens"],
    )

    # This service stays stateless: it returns `internals` and Node owns the
    # price_suggestions collection, so the AI service needs no DB credentials.
    return DraftListingServiceResponse(**response.model_dump(), internals=internals)
