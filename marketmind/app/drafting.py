"""The Gemini vision call that turns photos into a listing draft."""

from __future__ import annotations

import logging

from google import genai
from google.genai import errors, types

from .categories import CAMPUS_CATEGORIES, CONDITIONS
from .config import MODEL
from .pricing import choose_pricer
from .schemas import DraftListingResponse, ListingDraftFromModel

logger = logging.getLogger(__name__)

# Output ceiling. Gemini counts THINKING tokens against this budget, so a tight
# limit can truncate the JSON mid-object -- which surfaces as `parsed is None`
# with finish_reason MAX_TOKENS, not as an exception. Keep it generous; the
# draft itself is only a few hundred tokens.
MAX_OUTPUT_TOKENS = 8192

# Retries are OFF unless retry_options is passed -- the SDK does not retry by
# default. A 503 from Gemini is usually a brief overload, and without this a
# single blip sends the seller off to type the listing by hand.
#
# Tuned deliberately smaller than the SDK's own defaults (5 attempts, up to a
# 60s delay). A seller is watching a spinner, and Node aborts this call at 60s
# (DRAFT_TIMEOUT_MS in aiController.js), so a retry policy that can outlast
# that budget would just turn a fast failure into a slow one. Three attempts
# with 1s then 2s of backoff adds at most ~3s of waiting.
RETRY_OPTIONS = types.HttpRetryOptions(
    attempts=3,
    initial_delay=1.0,
    max_delay=4.0,
    exp_base=2.0,
    http_status_codes=[408, 429, 500, 502, 503, 504],
)

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


_client: genai.Client | None = None


def _get_client() -> genai.Client:
    """Build the client on first use, not at import.

    genai.Client() raises ValueError immediately when no API key is resolvable.
    Constructing it at module scope would make the whole module fail to import,
    taking /health down with it -- so a missing key would look like a crashed
    service instead of a service reporting a missing key.
    """
    global _client
    if _client is None:
        # reads GEMINI_API_KEY / GOOGLE_API_KEY from the environment
        _client = genai.Client(http_options=types.HttpOptions(retry_options=RETRY_OPTIONS))
    return _client


def _describe_block(response: types.GenerateContentResponse) -> str | None:
    """Return a reason string if generation was blocked or cut short.

    Gemini does NOT raise for these -- it returns HTTP 200 with either no
    candidates at all (prompt blocked) or a candidate whose finish_reason is
    something other than STOP. Both leave `.parsed` as None.
    """
    feedback = getattr(response, "prompt_feedback", None)
    if feedback is not None and getattr(feedback, "block_reason", None):
        return f"prompt blocked ({feedback.block_reason})"

    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return "model returned no candidates"

    finish = getattr(candidates[0], "finish_reason", None)
    if finish is not None and finish != types.FinishReason.STOP:
        if finish == types.FinishReason.MAX_TOKENS:
            return "response hit the output token limit and the JSON was truncated"
        return f"generation stopped early ({finish})"

    return None


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

    parts: list[types.Part] = [
        types.Part.from_bytes(data=data, mime_type=media_type) for data, media_type in images
    ]

    if seller_notes and seller_notes.strip():
        notes_text = "Seller's notes about this item:\n" + seller_notes.strip()
        parts.append(types.Part.from_text(text=notes_text))
    else:
        parts.append(
            types.Part.from_text(
                text="The seller did not add any notes. Work from the photos alone."
            )
        )

    try:
        response = _get_client().models.generate_content(
            model=MODEL,
            contents=[types.Content(role="user", parts=parts)],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=ListingDraftFromModel,
                max_output_tokens=MAX_OUTPUT_TOKENS,
                # Automatic Function Calling is on by default and warns loudly
                # about itself on every request. This is a single vision call
                # with a response schema -- there are no tools and nothing to
                # call -- so turn off machinery we never use and silence the
                # noise it logs.
                automatic_function_calling=types.AutomaticFunctionCallingConfig(
                    disable=True
                ),
            ),
        )
    except errors.ClientError as exc:
        # 4xx -- bad key, malformed request, quota exhausted.
        raise DraftingError(f"Gemini rejected the request: {exc}") from exc
    except errors.ServerError as exc:
        # 5xx -- Google-side outage or overload.
        raise DraftingError("Gemini is unavailable right now") from exc
    except errors.APIError as exc:
        raise DraftingError(f"Gemini API error: {exc}") from exc
    except Exception as exc:  # noqa: BLE001
        # Most commonly ValueError from a missing API key, which the SDK raises
        # as a plain builtin. Without this the request 500s with a stack trace
        # instead of degrading to "draft unavailable, type it yourself".
        logger.exception("unexpected error drafting listing")
        raise DraftingError("the drafting service is misconfigured or unavailable") from exc

    blocked = _describe_block(response)
    if blocked:
        raise DraftingError(blocked)

    draft = response.parsed
    if draft is None or not isinstance(draft, ListingDraftFromModel):
        # Schema-constrained decoding makes this rare, but not impossible: a
        # truncated or empty body leaves .parsed unset rather than raising.
        raise DraftingError("Gemini returned no parsable draft")

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

    usage = getattr(response, "usage_metadata", None)
    internals = {
        "itemSummary": draft.item_summary,
        "estimatedRetailPrice": draft.estimated_retail_price,
        "retailBasis": draft.retail_basis,
        "pricingStrategy": suggestion.strategy,
        "model": MODEL,
        "inputTokens": getattr(usage, "prompt_token_count", None),
        "outputTokens": getattr(usage, "candidates_token_count", None),
        "thinkingTokens": getattr(usage, "thoughts_token_count", None),
    }

    return payload, internals
