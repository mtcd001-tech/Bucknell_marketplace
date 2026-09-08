# Bucknell Campus Marketplace

A peer-to-peer marketplace where Bucknell students buy and sell to each other — textbooks, dorm furniture, bikes, electronics — with campus pickup instead of shipping.

Campus resale today happens in Facebook groups. That means no structure and no search: listings are freeform posts that scroll away, there's no way to filter by category or condition, and there is no way to answer the one question that actually matters at the start of a semester — *who is selling the textbook for the class I just registered for?* A post from three weeks ago is effectively gone. This project gives that activity a real data model: typed listings owned by verified students, filterable by campus category and condition, with an optional course code so a textbook can be tied to the class that requires it.

Registration is restricted to `bucknell.edu` addresses, so every account belongs to a student.

---

## Architecture

Three services, plus a small internal admin panel.

```
                    ┌──────────────────────────────┐
  browser ────────► │  React / Vite   (port 5173)  │
                    │  frontendprj                 │
                    └──────────────┬───────────────┘
                                   │  axios, JWT in `token` header
                                   ▼
                    ┌──────────────────────────────┐        ┌───────────────┐
                    │  Node / Express (port 4000)  │ ─────► │ MongoDB Atlas │
                    │  backendprj                  │        └───────────────┘
                    │  auth · listings · ownership │
                    └──────────────┬───────────────┘        ┌───────────────┐
                                   │                  ────► │  Cloudinary   │
                                   │  multipart, server-to-server           │
                                   ▼                        └───────────────┘
                    ┌──────────────────────────────┐
                    │  Python / FastAPI (port 8000)│ ─────► Gemini API
                    │  marketmind                  │
                    │  vision → listing draft      │
                    └──────────────────────────────┘
```

**The frontend never calls the Python service directly.** Node proxies every AI request, for four reasons:

1. **The Gemini API key lives in exactly one place.** MarketMind is not publicly exposed; only Node reaches it. A browser-callable AI endpoint is a browser-callable way to spend someone else's inference budget.
2. **One authentication boundary.** `authUser` already verifies the JWT for every other write. Routing AI through Node means MarketMind doesn't need its own auth, and no request reaches Gemini without a valid student token.
3. **MarketMind stays stateless.** It holds no database credentials and no session state. It takes images in and returns JSON out, which makes it trivially restartable and independently deployable.
4. **One origin for the browser.** No second CORS surface to configure or get wrong.

MarketMind returns an extra `internals` object (model id, token counts, retail estimate, pricing strategy). Node logs it and strips it before answering the browser — that's operational data, not something a client needs.

---

## What works today

**Accounts and authorization**
- Registration restricted to `bucknell.edu`, passwords hashed with bcrypt, JWT issued on login
- Protected routes on the client (`/sell`, `/account`) and `authUser` middleware on the server
- **Ownership enforcement on delete**: a listing can only be removed by the user who created it

**Listings**
- Create a listing with up to 4 photos (uploaded to Cloudinary), title, description, price, condition, pickup location, and an optional course code
- The seller is taken from the JWT and stored as a real `ObjectId` reference to the user
- Browse with filtering by campus category and condition, plus text search
- Listing detail page with seller card, condition and course-code badges, and related listings
- Account page listing only your own listings, via `GET /api/account/listings`

**AI-drafted listings (MarketMind)**
- Upload photos, click "Draft with AI": Gemini vision identifies the item and returns a title, category, condition, description, and the things a buyer would want to see that the photos don't show
- Output is schema-constrained, so `category` and `condition` are always one of the exact enum strings the form's dropdowns accept — the model cannot return a value that fails to select
- The draft **prefills** the form. Every field stays editable; the seller confirms before posting
- Suggested price comes with a one-sentence justification quoting the number

**Suggestion-acceptance logging**
- Every draft writes a `price_suggestions` document; posting a listing closes the loop with the final price and an outcome of `kept`, `edited`, or `null` (drafted but never posted)
- Acceptance rate is one aggregate query, documented at the top of `backendprj/models/priceSuggestionModel.js`

**Admin panel** (`admin/`, port 5174) — a small moderation view: all listings with a remove action, and read-only orders.

### Not built yet

Listed as roadmap, not as features:

- **Messaging.** "Message Seller" and "Request to Buy" currently surface the seller's email and set local state. There is no chat, no persisted conversation, no offer negotiation.
- **Course matching.** `courseCode` is captured and displayed as a badge, but nothing matches listings to a student's enrolled classes yet.
- **Ratings and reviews.** The trust model on the homepage describes two-way ratings; the data model has no reviews.
- **Comparables-based pricing.** See below — the seam exists, the data doesn't.
- **Payments.** Transactions are arranged in person. Stripe and cart/order routes survive in `backendprj` from the project's origins but are not reachable from the current frontend.

### Known gaps

- Admin removal is blocked by the ownership check. Admin tokens are signed with a different payload shape than user tokens, so `req.body.userId` is undefined for them and every delete is rejected. Fixing it properly means giving admins real user records with an `isAdmin` flag rather than special-casing the check.
- `marketmind/app/config.py` defaults `MARKETMIND_MODEL` to a Gemini model that has since been retired. Set the variable explicitly.
- No automated tests.

---

## Setup

Requires Node 18+ (developed on 22), Python 3.11+, a MongoDB connection string, a Cloudinary account, and a Gemini API key.

```bash
git clone https://github.com/mtcd001-tech/ecommerce.git
cd ecommerce
```

### 1. Backend — `backendprj` (port 4000)

```bash
cd backendprj
npm install
npm run server        # nodemon; `npm start` for plain node
```

### 2. Frontend — `frontendprj` (port 5173)

```bash
cd frontendprj
npm install
npm run dev
```

### 3. MarketMind — `marketmind` (port 8000)

```bash
cd marketmind
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

FastAPI serves interactive docs at `http://127.0.0.1:8000/docs`, which is the fastest way to test drafting without going through the UI. `GET /health` reports whether a Gemini key was found, without revealing it.

### 4. Admin panel — `admin` (port 5174), optional

```bash
cd admin
npm install
npm run dev
```

### Environment variables

Each service reads its own `.env`. Variable **names** only — create these yourself.

| Service | Variable | Required | Purpose |
|---|---|---|---|
| `backendprj` | `MONGODB_URI` | yes | MongoDB connection string (the app appends the database name) |
| | `JWT_SECRET` | yes | Signing secret for auth tokens |
| | `CLOUDINARY_NAME` | yes | Cloudinary cloud name |
| | `CLOUDINARY_API_KEY` | yes | Cloudinary API key |
| | `CLOUDINARY_SECRET_KEY` | yes | Cloudinary API secret |
| | `ADMIN_EMAIL` | yes | Admin panel login |
| | `ADMIN_PASSWORD` | yes | Admin panel login |
| | `MARKETMIND_URL` | no | Defaults to `http://127.0.0.1:8000`. Set explicitly for deployment |
| | `PORT` | no | Defaults to `4000` |
| | `STRIPE_SECRET_KEY` | no | Vestigial; unreachable from the current frontend |
| `frontendprj` | `VITE_BACKEND_URL` | yes | Backend base URL, e.g. `http://localhost:4000` |
| `admin` | `VITE_BACKEND_URL` | yes | Same |
| `marketmind` | `GEMINI_API_KEY` | yes | Gemini API key (`GOOGLE_API_KEY` also accepted) |
| | `MARKETMIND_MODEL` | recommended | Gemini model id; the in-code default is stale |

Vite inlines `VITE_*` variables at build time, so changing one requires a rebuild, not just a restart.

### API surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/user/register` | — | Register (`bucknell.edu` only) |
| POST | `/api/user/login` | — | Log in |
| POST | `/api/user/admin` | — | Admin panel login |
| GET | `/api/product/list` | — | All listings, seller populated |
| POST | `/api/product/single` | — | One listing |
| POST | `/api/product/add` | user | Create a listing (multipart, up to 4 images) |
| POST | `/api/product/remove` | user + owner | Delete your own listing |
| GET | `/api/account/listings` | user | Your listings, newest first |
| POST | `/api/ai/draft-listing` | user | Draft a listing from photos |

`/api/cart/*` and `/api/order/*` also exist but are unreachable from the current frontend.

---

## Technical notes

### The e-commerce → marketplace refactor

This started as a single-store e-commerce app and was restructured into a marketplace. The interesting part isn't the renaming — it's what structurally changes when a product stops belonging to the store and starts belonging to a user:

- **Ownership becomes a field, and therefore a permission.** A store's catalog has one owner, so "who can delete this?" is answered by a global admin check. Once every listing has a `seller`, deletion becomes a per-row authorization decision, and the check has to compare the requester against the row.
- **The cart stops making sense.** A cart assumes fungible inventory and a single counterparty. Here, every item is one-of-a-kind and every transaction is with a different student, so a multi-item cart with quantities models something that can't happen. Cart, checkout, and the size concept (`cartItems` was keyed by size) were removed rather than adapted — sizes don't exist on a used mini-fridge.
- **Categories stop being merchandising and become search.** Men/Women/Kids and Topwear/Bottomwear were apparel taxonomy. Campus categories plus a condition filter answer the questions a buyer actually has.
- **Creation moves from the back office to the product.** Listing creation left the admin panel and became a user-facing flow, which is what reduced the admin app to moderation.

### Ownership enforcement, and an `ObjectId` gotcha

The seller is always taken from the verified JWT (`req.body.userId`, set by `authUser`), never from the request body — otherwise any client could claim to be any seller.

The delete check in `backendprj/controllers/productController.js` contains a bug that's easy to write and hard to spot:

```js
if (listing.seller?.toString() !== req.body.userId) {
  return res.json({ success: false, message: "Not authorized to remove this listing" })
}
```

`listing.seller` is a Mongoose `ObjectId` **object**; `req.body.userId` is a **string** from the JWT payload. Without `.toString()`, the comparison is object-vs-string and is always unequal — so the check rejects everyone, including the legitimate owner, and does it silently. Strict equality between a wrapper type and a primitive is a failure mode worth internalizing.

### Cold-start pricing

There are no completed sales, so comparables genuinely do not exist. Pricing therefore splits the work:

- **The model** identifies the item and estimates what it costs **new**.
- **Python** turns that into a suggestion: `retail × category_retention × condition_multiplier`, capped at 85% of retail and rounded to a number a student would actually type. Textbooks retain 0.35 (new editions destroy resale value), electronics and bikes 0.45, used clothing 0.25; condition scales that from 1.5× (New) down to 0.5× (Well Loved).

Keeping the arithmetic in code rather than the prompt is deliberate: it's reproducible, unit-testable without spending API calls, retunable by editing a table, and it guarantees the reasoning sentence quotes the same number the API returns. When a model produces both the number and the prose, they drift.

`PricingStrategy` in `marketmind/app/pricing.py` is the seam for the second path. `ComparablesPricer` is a deliberate stub, and `choose_pricer()` is the only place that decides which strategy runs — so switching to comparables once there's sales data is a change in one function.

The `price_suggestions` collection exists to answer whether any of this is working: if sellers overwhelmingly edit the suggested price, the curve is wrong, and the acceptance rate is the number that says so.

### Graceful degradation

The AI is never load-bearing. If MarketMind is unreachable, times out (60s cap via `AbortController`), returns a 502, or sends an unparseable body, `backendprj/controllers/aiController.js` returns `{ success: false, message }` — never a 500 — and the Sell form shows a toast and lets the seller type the listing by hand. Posting a listing never depends on the AI being up.

The same principle applies inside the logging path: `recordSuggestionOutcome` swallows its own errors, because a failure to record analytics must never turn a successful post into a failed one.

MarketMind applies it too — Gemini can return HTTP 200 with no usable output (safety block, or truncation when thinking tokens consume the output budget), which raises no exception. `drafting.py` inspects `finish_reason` and `prompt_feedback` explicitly instead of assuming success means content.

---

## Repository layout

```
frontendprj/   React + Vite + Tailwind — the student-facing app
backendprj/    Node + Express + Mongoose — auth, listings, ownership, AI proxy
marketmind/    Python + FastAPI — Gemini vision drafting and price suggestion
admin/         React + Vite — moderation panel
BASELINE.md    Performance measurements taken before optimization work
```

`marketmind/README.md` has more detail on the AI service, including the pricing model and deployment notes.
