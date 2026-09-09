import mongoose from "mongoose";

// A conversation is anchored to a LISTING, not to a pair of users.
//
// Two students discussing a bike and a desk get two separate threads. That
// matters because every message here is about a specific item: an offer of $40
// is meaningless without knowing what it is $40 for, and a pickup time belongs
// to one handoff, not to a friendship.
//
// STATUS:
//   'open'   -> normal, both parties can send
//   'closed' -> read-only. Set when the listing sells to SOMEONE ELSE; the
//               winning buyer's thread deliberately stays open, because that
//               is exactly when the two of them need to arrange pickup.
const conversationSchema = new mongoose.Schema({
  listing: { type: mongoose.Schema.Types.ObjectId, ref: "product", required: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  status: { type: String, enum: ["open", "closed"], default: "open" },
  lastMessageAt: { type: Number, required: true },
  createdAt: { type: Number, required: true },
});

// Idempotency enforced by the DATABASE, not just by an app-level findOne.
// Two rapid "Message Seller" clicks race: both can pass a findOne check before
// either inserts. A unique index makes the loser fail with code 11000, which
// the controller catches and turns into "return the existing thread".
conversationSchema.index({ listing: 1, buyer: 1 }, { unique: true });

// Inbox query: every thread I am part of, newest activity first.
conversationSchema.index({ buyer: 1, lastMessageAt: -1 });
conversationSchema.index({ seller: 1, lastMessageAt: -1 });

const conversationModel =
  mongoose.models.conversation || mongoose.model("conversation", conversationSchema);

export default conversationModel;
