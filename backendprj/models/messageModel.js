import mongoose from "mongoose";

// Messages are TYPED, which is the whole point of building this instead of
// dropping in a generic chat widget.
//
//   'text'   -> ordinary chat
//   'offer'  -> a price proposal with an accept/decline lifecycle
//   'pickup' -> a proposed time and campus location with a confirm lifecycle
//
// "I'll give you $40" as free text is unqueryable. As an offer document it
// answers real questions later: what share of offers get accepted, how far
// below asking price items actually sell, which categories haggle hardest.
// Free text can never give you that without re-parsing English after the fact.
const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "conversation",
    required: true,
  },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  type: { type: String, enum: ["text", "offer", "pickup"], required: true },

  // Chat text for 'text'; an optional note attached to an offer or pickup.
  body: { type: String, default: "" },

  // Populated only when type === 'offer'.
  offer: {
    amount: { type: Number },
    // pending   -> awaiting a response
    // accepted  -> seller took it; the listing is now sold
    // declined  -> explicitly refused by the other party
    // countered -> answered with a different amount (a new offer message)
    // expired   -> the listing sold to a DIFFERENT buyer while this sat open.
    //              Kept distinct from 'declined' on purpose: nobody judged this
    //              offer, it just lost the race. Folding the two together would
    //              silently deflate the acceptance rate with offers that were
    //              never actually rejected.
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "countered", "expired"],
    },
    respondedAt: { type: Number, default: null },
  },

  // Populated only when type === 'pickup'.
  pickup: {
    location: { type: String },
    // Free text ("Thursday after 3pm") rather than a Date: students negotiate
    // in vague terms first and pin it down verbally. Forcing a timestamp here
    // would make the common case awkward to express.
    time: { type: String },
    status: { type: String, enum: ["proposed", "confirmed", "declined"] },
    respondedAt: { type: Number, default: null },
  },

  createdAt: { type: Number, required: true },
});

// Loading a thread is always "messages for this conversation, oldest first".
messageSchema.index({ conversation: 1, createdAt: 1 });

// Supports the offer analytics below without a collection scan.
messageSchema.index({ type: 1, "offer.status": 1 });

// WHAT THIS BUYS YOU -- the reason offers are documents and not sentences:
//
// Offer acceptance rate (explicit decisions only; 'expired' and 'pending' are
// deliberately excluded because neither is a judgement on the offer):
//
//   db.messages.aggregate([
//     { $match: { type: "offer", "offer.status": { $in: ["accepted", "declined"] } } },
//     { $group: {
//         _id: null,
//         decided:  { $sum: 1 },
//         accepted: { $sum: { $cond: [{ $eq: ["$offer.status", "accepted"] }, 1, 0] } }
//     }},
//     { $project: { _id: 0, decided: 1, accepted: 1,
//         acceptanceRate: { $round: [{ $multiply: [{ $divide: ["$accepted", "$decided"] }, 100] }, 1] } }}
//   ])
//
// Average final price vs asking price lives on the listings, since that is
// where the agreed number is recorded -- see models/productModel.js.

const messageModel =
  mongoose.models.message || mongoose.model("message", messageSchema);

export default messageModel;
