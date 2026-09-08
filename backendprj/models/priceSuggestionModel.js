import mongoose from "mongoose";

// One document per AI draft, written when the draft is generated and updated
// when (and if) the seller actually posts a listing from it.
//
// OUTCOME SEMANTICS -- this is the whole point of the collection:
//   'kept'   -> the seller posted at exactly the suggested price
//   'edited' -> the seller posted, but changed the price
//   null     -> no listing was ever posted from this draft (ignored/abandoned)
//
// null is a real, meaningful state, not missing data: a draft that never
// becomes a listing IS the "ignored it entirely" case. Treat it as such in
// the aggregate below rather than filtering it out, or the acceptance rate
// will be flattered by only counting drafts that reached checkout.
//
// ACCEPTANCE RATE -- one query, no joins:
//
//   db.price_suggestions.aggregate([
//     { $group: {
//         _id: null,
//         total:   { $sum: 1 },
//         kept:    { $sum: { $cond: [{ $eq: ["$outcome", "kept"] },   1, 0] } },
//         edited:  { $sum: { $cond: [{ $eq: ["$outcome", "edited"] }, 1, 0] } },
//         ignored: { $sum: { $cond: [{ $eq: ["$outcome", null] },     1, 0] } }
//     }},
//     { $project: {
//         _id: 0, total: 1, kept: 1, edited: 1, ignored: 1,
//         acceptanceRate: {
//           $round: [{ $multiply: [{ $divide: ["$kept", "$total"] }, 100] }, 1]
//         }
//     }}
//   ])
//
// Add `{ $match: { suggestedCategory: "Textbooks" } }` as a first stage to
// break the rate down per category once there is enough volume to bother.

const priceSuggestionSchema = new mongoose.Schema({
  // --- written at draft time ---
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  suggestedPrice: { type: Number, required: true },
  priceReasoning: { type: String },
  suggestedCategory: { type: String },
  suggestedCondition: { type: String },
  // Model id, token counts, retail estimate, pricing strategy -- whatever
  // marketmind's drafting.py returns. Deliberately schemaless so adding a
  // field on the Python side does not require a migration here.
  internals: { type: Object, default: {} },
  suggestedAt: { type: Number, required: true },

  // --- written at submit time, stays null if the draft is never used ---
  finalPrice: { type: Number, default: null },
  outcome: { type: String, enum: ["kept", "edited", null], default: null },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: "product", default: null },
  submittedAt: { type: Number, default: null },
});

// The acceptance-rate aggregate groups on outcome across the whole collection.
priceSuggestionSchema.index({ outcome: 1 });

const priceSuggestionModel =
  mongoose.models.priceSuggestion ||
  // Third arg pins the collection name; without it Mongoose would pluralize
  // to "pricesuggestions" and the aggregate above would target nothing.
  mongoose.model("priceSuggestion", priceSuggestionSchema, "price_suggestions");

/**
 * Close the loop on a draft when a listing is posted.
 *
 * Never throws: logging must not be able to fail a sale. If the draft id is
 * missing, malformed, or already resolved, this quietly does nothing.
 */
const recordSuggestionOutcome = async ({ listingDraftId, finalPrice, listingId }) => {
  try {
    if (!listingDraftId || !mongoose.isValidObjectId(listingDraftId)) return;

    const suggestion = await priceSuggestionModel.findById(listingDraftId);
    if (!suggestion || suggestion.outcome !== null) return;

    const priceUsed = Number(finalPrice);
    suggestion.finalPrice = priceUsed;
    suggestion.outcome = priceUsed === suggestion.suggestedPrice ? "kept" : "edited";
    suggestion.listing = listingId;
    suggestion.submittedAt = Date.now();
    await suggestion.save();
  } catch (error) {
    console.log("price suggestion outcome logging failed:", error.message);
  }
};

export default priceSuggestionModel;
export { recordSuggestionOutcome };
