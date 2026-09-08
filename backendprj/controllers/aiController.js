// Thin proxy in front of the MarketMind Python service.
//
// The browser never talks to Python directly -- the AI service holds the
// Gemini key and is not exposed publicly. Node authenticates the student,
// forwards the photos, and hands back the draft.
//
// This controller NEVER throws a 500 and never fails the request hard. The
// Sell form must keep working when the AI is down: a failed draft is a toast
// and a manually typed listing, not a blocked seller.
//
// It also owns the price_suggestions write. Node holds the Mongo connection
// and closes the loop on submit, so keeping both writes here means one driver
// and one owner for the whole record lifecycle -- and the Python service needs
// no database credentials.

import priceSuggestionModel from "../models/priceSuggestionModel.js";

const MARKETMIND_URL = (process.env.MARKETMIND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

// Vision calls are slow. Long enough to let a real draft finish, short enough
// that a hung service doesn't hold the seller's browser open indefinitely.
const DRAFT_TIMEOUT_MS = 60000;

const draftListing = async (req, res) => {
  try {
    const files = req.files || [];

    if (files.length === 0) {
      return res.json({ success: false, message: "Add at least one photo before drafting." });
    }

    // Rebuild the multipart body for the Python service. FastAPI expects a
    // repeated `images` field plus an optional `notes` field -- see
    // marketmind/app/main.py:44.
    const form = new FormData();
    for (const file of files) {
      form.append(
        "images",
        new Blob([file.buffer], { type: file.mimetype }),
        file.originalname || "photo",
      );
    }
    if (req.body?.notes) {
      form.append("notes", req.body.notes);
    }

    // fetch has no built-in timeout; without this an unresponsive Python
    // service would hang this request until the browser gives up.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DRAFT_TIMEOUT_MS);

    let upstream;
    try {
      upstream = await fetch(`${MARKETMIND_URL}/draft-listing`, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    // FastAPI returns {"detail": "..."} on error; a crashed process may return
    // no JSON at all, so this must not be allowed to throw.
    const payload = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      console.log("marketmind draft failed:", upstream.status, payload);
      return res.json({
        success: false,
        message:
          typeof payload?.detail === "string"
            ? payload.detail
            : `Drafting service returned ${upstream.status}`,
      });
    }

    if (!payload) {
      return res.json({ success: false, message: "Drafting service returned an unreadable response." });
    }

    // `internals` is operational data (model id, token counts, retail
    // estimate). Log it, then keep it server-side -- the browser gets only
    // the seven draft keys the Sell form uses.
    const { internals, ...draft } = payload;

    let listingDraftId = null;
    try {
      const suggestion = await priceSuggestionModel.create({
        seller: req.body.userId,
        suggestedPrice: draft.suggestedPrice,
        priceReasoning: draft.priceReasoning,
        suggestedCategory: draft.category,
        suggestedCondition: draft.condition,
        internals: internals || {},
        suggestedAt: Date.now(),
      });
      listingDraftId = suggestion._id;
    } catch (logError) {
      // A logging failure must not cost the seller their draft.
      console.log("price suggestion logging failed:", logError.message);
    }

    return res.json({ success: true, draft, listingDraftId });
  } catch (error) {
    // AbortError (timeout) and ECONNREFUSED (service not running) both land
    // here. Neither is the seller's problem, so report and let them type.
    const message =
      error.name === "AbortError"
        ? "Drafting timed out. Fill the listing in manually."
        : "Drafting service is unreachable. Fill the listing in manually.";
    console.log("marketmind draft error:", error.name, error.message);
    return res.json({ success: false, message });
  }
};

export { draftListing };
