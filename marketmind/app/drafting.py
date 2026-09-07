"""The Claude vision call that turns photos into a listing draft."""

from __future__ import annotations

import base64
import logging

import anthropic

from .categories import CAMPUS_CATEGORIES, CONDITIONS
from .config import MODEL
from .pricing import choose_pricer
from .schemas import DraftListingResponse, ListingDraftFromClaude

logger = logging.getLogger(__name__)

_client = anthropic.Anthropic()

SYSTEM_PROMPT = f"""You help students at Bucknell University write listings for a campus \
marketplace where they sell used items to each other.

You are given 1-4 photos of a single item, and sometimes a few notes typed by the seller.
Identify the item and draft the listing.

Rules:
- category MUST be one of: {", ".join(CAMPUS_CATEGORIES)}
- condition MUST be one of: {", ".join(CONDITIONS)}. Judge it from visible wear in the photos,
  not from the seller's optimism. Scuffs, creases, highlighting and scratches matter.
- title: how a student would write it, specific enough to search for. No price in the title.
- description: 2-4 plain sentences. Mention visible flaws honestly -- a buyer who feels
  misled leaves a bad rating, and both sides rate each other here.
- estimated_retail_price: what this item costs NEW today, in USD. This is an input to a
  pricing formula, so estimate the real new price -- do NOT discount it for wear yourself.
  Use 0 only if the item is genuinely valueless or being given away.
- retail_basis: a short phrase naming where that number comes from, e.g. "list price for
  this edition" or "typical price for a comparable mini fridge".
- missing_info: things a BUYER would want to see that these photos don't show. Be concrete
  and short: "no photo of the spine", "screen not shown powered on", "model number not
  visible". Empty list if the photos genuinely cover it.

If the seller's notes conflict with what you can see in the photos, trust the photos for
condition and mention the discrepancy in missing_info."""


class DraftingError(RuntimeError):
    """Raised when a draft could not be produced. The caller turns this into a
    502 so the frontend can fall back to manual entry."""


def _image_block(data: bytes, media_type: str) -> dict:
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": media_type,
            "data": base64.standard_b64encode(data).decode("utf-8"),
        },
    }


def draft_listing(
    *,
    images: list[tuple[bytes, str]],
    seller_notes: str | None = None,
) -> tuple[DraftListingResponse, dict]:
    """Draft a listing from photos.

    Returns the response the frontend consumes, plus a dict of internals
    (retail estimate, pricing strategy, token usage) that Step 3 logs to the
    price_suggestions collection.
    """
    if not images:
        raise DraftingError("at least one image is required")

    content: list[dict] = [_image_block(data, media_type) for data, media_type in images]

    if seller_notes and seller_notes.strip():
        content.append(
            {
                "type": "text",
                "text": f"Seller's notes about this item:\n{seller_notes.strip()}",
            }
        )
    else:
        content.append(
            {"type": "text", "text": "The seller did not add any notes. Work from the photos alone."}
        )

    try:
        response = _client.messages.parse(
            model=MODEL,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": content}],
            output_format=ListingDraftFromClaude,
        )
    except anthropic.RateLimitError as exc:
        raise DraftingError("Claude rate limit hit, try again in a moment") from exc
    except anthropic.AuthenticationError as exc:
        raise DraftingError("Claude rejected the API key") from exc
    except anthropic.APIStatusError as exc:
        raise DraftingError(f"Claude returned {exc.status_code}: {exc.type}") from exc
    except anthropic.APIConnectionError as exc:
        raise DraftingError("could not reach the Claude API") from exc
    except Exception as exc:  # noqa: BLE001
        # Anything else -- most commonly a missing/unresolvable credential,
        # which the SDK raises as a plain TypeError, not an APIStatusError.
        # Without this the request 500s with a stack trace instead of
        # degrading to "draft unavailable, type it yourself".
        logger.exception("unexpected error drafting listing")
        raise DraftingError("the drafting service is misconfigured or unavailable") from exc

    draft = response.parsed_output
    if draft is None:
        raise DraftingError("Claude returned no parsable draft")

    pricer = choose_pricer(category=draft.category, condition=draft.condition)
    suggestion = pricer.suggest(
        category=draft.category,
        condition=draft.condition,
        retail_estimate=draft.estimated_retail_price,
        retail_basis=draft.retail_basis,
        item_summary=draft.item_summary,
    )

    payload = DraftListingResponse(
        title=draft.title,
        category=draft.category,
        condition=draft.condition,
        description=draft.description,
        suggestedPrice=suggestion.price,
        priceReasoning=suggestion.reasoning,
        missingInfo=draft.missing_info,
    )

    internals = {
        "itemSummary": draft.item_summary,
        "estimatedRetailPrice": draft.estimated_retail_price,
        "retailBasis": draft.retail_basis,
        "pricingStrategy": suggestion.strategy,
        "model": MODEL,
        "inputTokens": response.usage.input_tokens,
        "outputTokens": response.usage.output_tokens,
    }

    return payload, internals
