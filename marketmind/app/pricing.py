"""Price suggestion.

DESIGN NOTE -- why pricing math lives here and not in the prompt
----------------------------------------------------------------
Claude identifies the item and estimates what it costs NEW. This module turns
that retail estimate into a suggested resale price using a deterministic
depreciation curve. Splitting it this way means:

  * the number is reproducible and unit-testable without spending API calls
  * you can retune the curve (a table edit) without touching prompt text
  * the reasoning sentence always quotes the same number the schema returns
    -- if Claude produced both, they drift ("$45" in prose, 40 in the field)

PHASE 3B -- comparables
-----------------------
`PricingStrategy` is the seam. `DepreciationPricer` is the cold-start path used
today (35 listings, zero sales, so there is nothing to compare against).
`ComparablesPricer` is the stub for the second path: once there are completed
sales, it queries them and returns a price backed by what things actually sold
for. `choose_pricer()` picks between them, so wiring 3b up is a change here and
nowhere else -- drafting.py and main.py never learn which path ran.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .categories import CAMPUS_CATEGORIES, FACE_VALUE_CATEGORY, FREE_CATEGORY

# Fraction of original retail a "Good"-condition item of this category is worth
# on a campus marketplace. Textbooks crater (new editions kill demand);
# electronics and bikes hold value; used clothing resells poorly.
CATEGORY_RETENTION: dict[str, float] = {
    "Textbooks": 0.35,
    "Furniture": 0.30,
    "Electronics": 0.45,
    "Dorm & Kitchen": 0.30,
    "Bikes & Transport": 0.45,
    "Clothing": 0.25,
    "Tickets & Passes": 0.85,  # near face value, mostly time-decay
    "Free Stuff": 0.0,
}

# Multiplier relative to the "Good" baseline above.
CONDITION_MULTIPLIER: dict[str, float] = {
    "New": 1.50,
    "Like New": 1.25,
    "Good": 1.00,
    "Fair": 0.75,
    "Well Loved": 0.50,
}

# Never suggest more than this fraction of retail for a secondhand item -- a
# buyer who can get it new for barely more will just buy it new.
MAX_FRACTION_OF_RETAIL = 0.85
MIN_PAID_PRICE = 1.0


@dataclass
class PriceSuggestion:
    """What a pricing strategy returns."""

    price: int
    reasoning: str
    strategy: str  # "depreciation" | "comparables" -- logged in Step 3


def _round_sensibly(amount: float) -> int:
    """Students price in round numbers. $37.40 reads as a bot; $35 doesn't."""
    if amount <= 0:
        return 0
    if amount < 20:
        return max(1, round(amount))
    return int(round(amount / 5.0) * 5)


class PricingStrategy(Protocol):
    """Seam between the cold-start curve and the future comparables path."""

    name: str

    def suggest(
        self,
        *,
        category: str,
        condition: str,
        retail_estimate: float,
        retail_basis: str,
        item_summary: str,
    ) -> PriceSuggestion: ...


class DepreciationPricer:
    """Cold-start path: retail estimate x category retention x condition."""

    name = "depreciation"

    def suggest(
        self,
        *,
        category: str,
        condition: str,
        retail_estimate: float,
        retail_basis: str,
        item_summary: str,
    ) -> PriceSuggestion:
        if category == FREE_CATEGORY:
            return PriceSuggestion(
                price=0,
                reasoning="Listed free, so there's no price to justify -- whoever wants it just picks it up.",
                strategy=self.name,
            )

        retention = CATEGORY_RETENTION.get(category, 0.35)
        multiplier = CONDITION_MULTIPLIER.get(condition, 1.0)

        raw = max(0.0, retail_estimate) * retention * multiplier
        ceiling = max(0.0, retail_estimate) * MAX_FRACTION_OF_RETAIL
        price = _round_sensibly(min(raw, ceiling))
        price = max(price, int(MIN_PAID_PRICE)) if retail_estimate > 0 else price

        if category == FACE_VALUE_CATEGORY:
            reasoning = (
                f"Priced a little under the ${int(round(retail_estimate))} {retail_basis}, "
                f"since passes lose value as the date gets closer."
            )
        else:
            pct = int(round((price / retail_estimate) * 100)) if retail_estimate > 0 else 0
            reasoning = (
                f"About {pct}% of the roughly ${int(round(retail_estimate))} it costs new "
                f"({retail_basis}), which is what a {condition.lower()} {item_summary} "
                f"tends to be worth secondhand on campus."
            )

        return PriceSuggestion(price=price, reasoning=reasoning, strategy=self.name)


class ComparablesPricer:
    """PHASE 3B -- not built yet.

    Once completed sales exist, this queries them (same category + condition,
    recent window) and prices against what things actually sold for, which is a
    far more convincing sentence than a depreciation curve: "three of these sold
    for $40-50 in the last month."

    Deliberately NOT implemented -- `choose_pricer` never returns it yet.
    """

    name = "comparables"

    def suggest(self, **_kwargs) -> PriceSuggestion:  # pragma: no cover
        raise NotImplementedError("Phase 3b: comparables pricing not built yet")


def choose_pricer(*, category: str, condition: str) -> PricingStrategy:
    """Pick a pricing path.

    Today this always returns the depreciation curve. In Phase 3b this grows a
    branch: if enough recent comparable sales exist for (category, condition),
    return ComparablesPricer(), else fall back to DepreciationPricer().
    """
    return DepreciationPricer()


def valid_category(value: str) -> bool:
    return value in CAMPUS_CATEGORIES
