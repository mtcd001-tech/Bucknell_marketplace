# MarketMind

The AI service behind the Sell form's **Draft with AI** button.

```
browser  ->  Node/Express (backendprj)  ->  MarketMind (this service)  ->  Claude API
```

The browser never calls this service directly, and the Anthropic API key lives
only here. Node forwards requests; this service is the only thing holding a key.

## What it does today (Step 1)

`POST /draft-listing` takes 1-4 photos of an item plus optional seller notes,
sends them to Claude with vision, and returns a listing draft the seller can
edit before posting:

```json
{
  "title": "Organic Chemistry, 9th Ed -- Carey",
  "category": "Textbooks",
  "condition": "Good",
  "description": "Used for one semester...",
  "suggestedPrice": 45,
  "priceReasoning": "About 35% of the roughly $130 it costs new (list price for this edition), which is what a good chemistry textbook tends to be worth secondhand on campus.",
  "missingInfo": ["no photo of the spine", "edition year not visible"]
}
```

`category` is always one of the 8 campus categories and `condition` one of the
5 conditions, enforced by a JSON schema on the model call -- the Sell form's
dropdowns only accept those exact strings.

## Setup

Requires Python 3.11+.

```bash
cd marketmind
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

### Environment variables

Create `marketmind/.env` yourself (it is gitignored; this service never writes it):

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | **yes** | Your Anthropic API key. Read by the SDK. Set it *only* here -- not in `backendprj/.env`, not in the frontend. |
| `MARKETMIND_MODEL` | no | Model override. Defaults to `claude-opus-5`. |

You will also add one variable to **`backendprj/.env`** in Step 2:

| Variable | Purpose |
|---|---|
| `MARKETMIND_URL` | Where Node reaches this service. Locally: `http://127.0.0.1:8000` |

### Run it

```bash
uvicorn app.main:app --reload --port 8000
```

Interactive docs at http://127.0.0.1:8000/docs -- you can upload a photo and
hit the endpoint from the browser without touching the frontend.

## Smoke test

```bash
curl http://127.0.0.1:8000/health

curl -X POST http://127.0.0.1:8000/draft-listing \
  -F "images=@/path/to/photo.jpg" \
  -F "notes=Used it for one semester"
```

`/health` reports `anthropicKeyConfigured` so you can tell a missing key apart
from a broken call without printing the key itself.

## How pricing works (cold start)

There are ~35 listings and zero completed sales, so there is nothing to compare
against yet. The current path:

1. Claude identifies the item and estimates what it costs **new**.
2. `pricing.py` applies a depreciation curve: `retail x category_retention x condition_multiplier`,
   capped at 85% of retail, rounded to a number a student would actually type.
3. The reasoning sentence quotes that computed number.

The arithmetic lives in Python rather than the prompt on purpose -- it is
reproducible, testable without spending API calls, retunable by editing a
table, and it guarantees the sentence and the number agree. (When a model
produces both, they drift: "$45" in the prose, `40` in the field.)

**Phase 3b (comparables)** slots in at `pricing.py`'s `PricingStrategy` seam.
`ComparablesPricer` is a stub today; `choose_pricer()` is the only place that
decides which path runs, so nothing else in the service changes when it lands.

Tuning knobs, both in `pricing.py`: `CATEGORY_RETENTION` (how fast a category
loses value) and `CONDITION_MULTIPLIER` (relative to a "Good" baseline).

## Keeping the enums in sync

`app/categories.py` mirrors `CAMPUS_CATEGORIES` and `CONDITIONS` from
`frontendprj/src/mocks/marketplace.js`. There is no shared source of truth
across the JS/Python boundary yet, so **if you edit one, edit the other**.
`app/schemas.py` asserts the two Python copies agree at import time, so a
mismatch fails loudly at startup instead of producing drafts the Sell form's
dropdown silently rejects.

## Deployment notes (not needed for local dev)

- **Host binding** -- `uvicorn --reload --port 8000` binds `127.0.0.1`, which is
  right locally. Deployed, you need `--host 0.0.0.0` to accept traffic from
  outside the container, and the platform usually supplies the port
  (`--port $PORT`). Drop `--reload` in production.
- **The Node->Python URL** -- `MARKETMIND_URL` becomes the deployed service URL
  instead of `127.0.0.1:8000`. Vercel's Node functions cannot reach your laptop,
  so this service has to be deployed somewhere reachable (Railway, Render, Fly)
  before the deployed Sell form's AI button works.
- **CORS** -- deliberately not configured. CORS governs *browsers*, and only
  Node calls this service. If you ever add permissive CORS here, any webpage
  could hit the endpoint and spend your Claude credits.
- **Authentication** -- there is none between Node and Python yet. Locally the
  service is bound to loopback so only your machine reaches it. Once deployed
  it is publicly reachable, so add a shared secret header that Node sends and
  this service checks, before or at the same time as deploying.
