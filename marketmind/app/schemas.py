"""Request/response shapes.

Two distinct shapes live here, and the distinction matters:

  * `ListingDraftFromModel` -- what the MODEL returns. It includes the raw
    ingredients for pricing (retail estimate + basis) but NOT the final price;
    pricing.py computes that.
  * `DraftListingResponse` -- what this SERVICE returns to Node, and what the
    Sell form consumes. Exactly the seven keys the frontend expects, in
    camelCase, because JS reads them directly.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from .categories import CAMPUS_CATEGORIES, CONDITIONS

# Literal types become an `enum` in the schema sent to Gemini, so
# the model is constrained to valid values rather than asked nicely to comply.
CategoryLiteral = Literal[
    "Textbooks",
    "Furniture",
    "Electronics",
    "Dorm & Kitchen",
    "Bikes & Transport",
    "Clothing",
    "Tickets & Passes",
    "Free Stuff",
]

ConditionLiteral = Literal[
    "New",
    "Like New",
    "Good",
    "Fair",
    "Well Loved",
]

# Drift guard: if someone edits categories.py without editing the Literals
# above (or vice versa), fail at import time rather than shipping drafts the
# Sell form's dropdown silently rejects.
assert set(CategoryLiteral.__args__) == set(CAMPUS_CATEGORIES), (
    "CategoryLiteral is out of sync with categories.CAMPUS_CATEGORIES"
)
assert set(ConditionLiteral.__args__) == set(CONDITIONS), (
    "ConditionLiteral is out of sync with categories.CONDITIONS"
)


class ListingDraftFromModel(BaseModel):
    """Structured output schema for the vision call.

    Field order matters: Gemini emits `property_ordering` from this class and
    generates fields in that order, so identification comes before the retail
    estimate that depends on it."""

    title: str = Field(
        description="Short listing title a student would write, max ~60 chars. No price in the title."
    )
    category: CategoryLiteral
    condition: ConditionLiteral
    description: str = Field(
        description="2-4 sentences describing the item and its visible wear, written as the seller."
    )
    item_summary: str = Field(
        description="Very short noun phrase for the item itself, e.g. 'chemistry textbook' or 'desk lamp'."
    )
    estimated_retail_price: float = Field(
        description="Best estimate of what this item costs NEW in USD. 0 if genuinely free or worthless."
    )
    retail_basis: str = Field(
        description="Short phrase explaining where the retail estimate comes from, e.g. 'list price for this edition'."
    )
    missing_info: list[str] = Field(
        description=(
            "Short prompts for photos or facts a buyer would want but the photos don't show, "
            "e.g. 'no photo of the spine' or 'model number not visible'. Empty list if nothing is missing."
        )
    )


class DraftListingResponse(BaseModel):
    """Exactly the shape the Sell form expects. Do not add or rename keys
    without changing frontendprj/src/pages/Sell.jsx at the same time."""

    title: str
    category: str
    condition: str
    description: str
    suggestedPrice: int
    priceReasoning: str
    missingInfo: list[str]


class DraftListingServiceResponse(DraftListingResponse):
    """What the SERVICE returns to Node: the seven frontend keys plus the
    internals Node needs for price_suggestions logging.

    Node strips `internals` before answering the browser -- token counts and
    model names are operational data, not something the client needs or should
    see. The seven-key contract the Sell form depends on is unchanged.
    """

    internals: dict
