// Structured negotiation: offers and pickups.
//
// These live over REST rather than on the socket, unlike plain chat, because
// they are not fire-and-forget messages -- accepting an offer mutates three
// collections at once (the message, the listing, every rival conversation).
// That deserves a real request/response the client can react to, and a place
// where the ordering of those writes is explicit and reviewable.
//
// They still reach the other party live: after the write succeeds, the result
// is broadcast into the same socket room chat uses.

import mongoose from "mongoose";
import conversationModel from "../models/conversationModel.js";
import messageModel from "../models/messageModel.js";
import productModel from "../models/productModel.js";
import { getIO, roomFor } from "../socket.js";

const loadIfParticipant = async (conversationId, userId) => {
  if (!mongoose.isValidObjectId(conversationId)) return null;
  const conversation = await conversationModel.findById(conversationId);
  if (!conversation) return null;
  const isParticipant =
    conversation.buyer.toString() === userId || conversation.seller.toString() === userId;
  return isParticipant ? conversation : null;
};

// Push a saved message into the live room. Broadcasting is best-effort: the
// write already happened, so a socket problem must never surface as a failed
// offer. The other side will see it on their next fetch regardless.
const broadcast = async (conversationId, messageDoc) => {
  try {
    const message = await messageDoc.populate("sender", "name");
    getIO()?.to(roomFor(conversationId)).emit("message:new", { message });
    return message;
  } catch (error) {
    console.log("offer broadcast failed:", error.message);
    return messageDoc;
  }
};

// POST /api/conversations/:id/messages -- send an 'offer' or a 'pickup'.
const sendStructuredMessage = async (req, res) => {
  try {
    const userId = req.body.userId;
    const conversation = await loadIfParticipant(req.params.id, userId);
    if (!conversation) {
      return res.json({ success: false, message: "Conversation not found" });
    }
    if (conversation.status === "closed") {
      return res.json({ success: false, message: "This conversation is closed" });
    }

    const { type, amount, location, time, body } = req.body;
    const now = Date.now();
    const draft = {
      conversation: conversation._id,
      sender: userId,
      type,
      body: (body || "").trim(),
      createdAt: now,
    };

    if (type === "offer") {
      const value = Number(amount);
      if (!Number.isFinite(value) || value < 0) {
        return res.json({ success: false, message: "Enter a valid offer amount" });
      }
      draft.offer = { amount: value, status: "pending", respondedAt: null };
    } else if (type === "pickup") {
      if (!location || !time) {
        return res.json({ success: false, message: "Pickup needs a place and a time" });
      }
      draft.pickup = { location, time, status: "proposed", respondedAt: null };
    } else {
      // Plain text goes over the socket; this endpoint is for the typed kinds.
      return res.json({ success: false, message: "Unsupported message type" });
    }

    const saved = await messageModel.create(draft);
    conversation.lastMessageAt = now;
    await conversation.save();

    const message = await broadcast(conversation._id, saved);
    res.json({ success: true, message });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// POST /api/conversations/:id/messages/:messageId/respond
//
// action: accept | decline | counter   (offers)
//         confirm | decline           (pickups)
const respondToMessage = async (req, res) => {
  try {
    const userId = req.body.userId;
    const conversation = await loadIfParticipant(req.params.id, userId);
    if (!conversation) {
      return res.json({ success: false, message: "Conversation not found" });
    }

    if (!mongoose.isValidObjectId(req.params.messageId)) {
      return res.json({ success: false, message: "Message not found" });
    }
    const target = await messageModel.findById(req.params.messageId);
    if (!target || target.conversation.toString() !== conversation._id.toString()) {
      return res.json({ success: false, message: "Message not found" });
    }

    // You respond to the other party's proposal, never your own. Without this
    // a buyer could "accept" their own lowball and mark the listing sold.
    if (target.sender.toString() === userId) {
      return res.json({ success: false, message: "You can't respond to your own message" });
    }

    const { action } = req.body;
    const now = Date.now();

    // ---------------- PICKUP ----------------
    if (target.type === "pickup") {
      if (target.pickup?.status !== "proposed") {
        return res.json({ success: false, message: "This pickup was already answered" });
      }
      if (!["confirm", "decline"].includes(action)) {
        return res.json({ success: false, message: "Unsupported action" });
      }

      target.pickup.status = action === "confirm" ? "confirmed" : "declined";
      target.pickup.respondedAt = now;
      await target.save();

      const message = await broadcast(conversation._id, target);
      getIO()?.to(roomFor(conversation._id)).emit("message:updated", { message });
      return res.json({ success: true, message });
    }

    // ---------------- OFFER ----------------
    if (target.type !== "offer") {
      return res.json({ success: false, message: "That message can't be answered" });
    }
    if (target.offer?.status !== "pending") {
      return res.json({ success: false, message: "This offer was already answered" });
    }

    if (action === "decline") {
      target.offer.status = "declined";
      target.offer.respondedAt = now;
      await target.save();
      const message = await broadcast(conversation._id, target);
      getIO()?.to(roomFor(conversation._id)).emit("message:updated", { message });
      return res.json({ success: true, message });
    }

    if (action === "counter") {
      const value = Number(req.body.amount);
      if (!Number.isFinite(value) || value < 0) {
        return res.json({ success: false, message: "Enter a valid counter amount" });
      }
      if (conversation.status === "closed") {
        return res.json({ success: false, message: "This conversation is closed" });
      }

      // A counter is a new offer, not an edit of the old one. Keeping both
      // documents preserves the whole negotiation chain as data -- you can see
      // that $60 was countered at $45 and settled at $50.
      target.offer.status = "countered";
      target.offer.respondedAt = now;
      await target.save();

      const counter = await messageModel.create({
        conversation: conversation._id,
        sender: userId,
        type: "offer",
        body: (req.body.body || "").trim(),
        offer: { amount: value, status: "pending", respondedAt: null },
        createdAt: now,
      });
      conversation.lastMessageAt = now;
      await conversation.save();

      getIO()?.to(roomFor(conversation._id)).emit("message:updated", { message: target });
      const message = await broadcast(conversation._id, counter);
      return res.json({ success: true, message });
    }

    if (action !== "accept") {
      return res.json({ success: false, message: "Unsupported action" });
    }

    // ---------------- ACCEPT: the one with real side effects ----------------

    // Only the seller can conclude a sale. A buyer accepting an offer the
    // seller made to them is a plausible future flow, but today offers run
    // buyer -> seller, and letting a buyer mark a listing sold would let them
    // take an item out of circulation unilaterally.
    if (conversation.seller.toString() !== userId) {
      return res.json({ success: false, message: "Only the seller can accept an offer" });
    }

    const listing = await productModel.findById(conversation.listing);
    if (!listing) {
      return res.json({ success: false, message: "Listing not found" });
    }
    // Guards the double-sale race: two sellers' tabs, or a double-click, must
    // not both mark this sold and clobber the first agreed price.
    if (listing.status === "sold") {
      return res.json({ success: false, message: "This listing is already sold" });
    }

    // 1. The offer itself.
    target.offer.status = "accepted";
    target.offer.respondedAt = now;
    await target.save();

    // 2. The listing: sold, at the agreed number, to this buyer. `soldPrice`
    //    next to the original `price` is what makes final-vs-asking a query.
    listing.status = "sold";
    listing.soldPrice = target.offer.amount;
    listing.soldTo = conversation.buyer;
    listing.soldAt = now;
    await listing.save();

    // 3. Every OTHER conversation on this listing. The winning thread stays
    //    open -- that pair still has to arrange the handoff, which is exactly
    //    what the pickup message type is for. The rest go read-only.
    const closedResult = await conversationModel.updateMany(
      { listing: listing._id, _id: { $ne: conversation._id } },
      { $set: { status: "closed" } },
    );

    // 4. Their still-pending offers become 'expired', not 'declined'. Nobody
    //    rejected them; they lost a race. Conflating the two would corrupt the
    //    acceptance rate this whole design exists to measure.
    const rivalConversations = await conversationModel
      .find({ listing: listing._id, _id: { $ne: conversation._id } })
      .select("_id");

    const expiredResult = await messageModel.updateMany(
      {
        conversation: { $in: rivalConversations.map((c) => c._id) },
        type: "offer",
        "offer.status": "pending",
      },
      { $set: { "offer.status": "expired", "offer.respondedAt": now } },
    );

    const message = await broadcast(conversation._id, target);
    getIO()?.to(roomFor(conversation._id)).emit("message:updated", { message });

    // Tell the losing threads to refresh themselves, so a buyer staring at the
    // page sees it go read-only instead of typing into a dead conversation.
    for (const rival of rivalConversations) {
      getIO()?.to(roomFor(rival._id)).emit("conversation:closed", {
        conversationId: rival._id,
        reason: "sold",
      });
    }

    res.json({
      success: true,
      message,
      listing: {
        _id: listing._id,
        status: listing.status,
        soldPrice: listing.soldPrice,
      },
      closedConversations: closedResult.modifiedCount,
      expiredOffers: expiredResult.modifiedCount,
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

export { sendStructuredMessage, respondToMessage };
