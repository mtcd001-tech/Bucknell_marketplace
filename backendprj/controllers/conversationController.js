import mongoose from "mongoose";
import conversationModel from "../models/conversationModel.js";
import messageModel from "../models/messageModel.js";
import productModel from "../models/productModel.js";

// Shared participant guard.
//
// Every read and write in this file goes through it. A conversation is private
// to exactly two people, and the id is a guessable ObjectId in the URL, so
// "logged in" is not sufficient authorization -- being one of the two parties
// is. Returns the conversation, or null when the caller has no business here.
const loadIfParticipant = async (conversationId, userId) => {
  if (!mongoose.isValidObjectId(conversationId)) return null;

  const conversation = await conversationModel.findById(conversationId);
  if (!conversation) return null;

  const isParticipant =
    conversation.buyer.toString() === userId || conversation.seller.toString() === userId;

  return isParticipant ? conversation : null;
};

// GET /api/conversations -- every thread I am in, either side, newest first.
const listConversations = async (req, res) => {
  try {
    const userId = req.body.userId;

    const conversations = await conversationModel
      .find({ $or: [{ buyer: userId }, { seller: userId }] })
      .sort({ lastMessageAt: -1 })
      .populate("listing", "name image price status")
      .populate("buyer", "name email")
      .populate("seller", "name email");

    res.json({ success: true, conversations });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// GET /api/conversations/:id/messages -- full thread, oldest first.
const listMessages = async (req, res) => {
  try {
    const conversation = await loadIfParticipant(req.params.id, req.body.userId);
    if (!conversation) {
      // Deliberately the same response for "does not exist" and "not yours":
      // distinguishing them would let anyone probe which conversation ids are
      // real by watching the error text change.
      return res.json({ success: false, message: "Conversation not found" });
    }

    const messages = await messageModel
      .find({ conversation: conversation._id })
      .sort({ createdAt: 1 })
      .populate("sender", "name");

    res.json({ success: true, conversation, messages });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// POST /api/conversations -- start (or reuse) the thread for a listing.
//
// Idempotent: the same buyer hitting "Message Seller" twice gets the same
// thread, never a duplicate.
const startConversation = async (req, res) => {
  try {
    const { listingId } = req.body;
    const userId = req.body.userId;

    if (!mongoose.isValidObjectId(listingId)) {
      return res.json({ success: false, message: "Invalid listing id" });
    }

    const listing = await productModel.findById(listingId);
    if (!listing) {
      return res.json({ success: false, message: "Listing not found" });
    }
    if (!listing.seller) {
      // Legacy rows seeded before listings had an owner. There is nobody to
      // talk to, so fail clearly instead of creating a thread with a null side.
      return res.json({ success: false, message: "This listing has no seller on record" });
    }
    if (listing.seller.toString() === userId) {
      // Buyers initiate, not sellers. A seller has no way to discover an
      // interested buyer before that buyer speaks, so there is nothing here
      // for them to open.
      return res.json({ success: false, message: "You can't start a conversation on your own listing" });
    }

    const existing = await conversationModel.findOne({ listing: listingId, buyer: userId });
    if (existing) {
      return res.json({ success: true, conversation: existing, created: false });
    }

    const now = Date.now();
    try {
      const conversation = await conversationModel.create({
        listing: listingId,
        buyer: userId,
        seller: listing.seller,
        status: "open",
        lastMessageAt: now,
        createdAt: now,
      });
      return res.json({ success: true, conversation, created: true });
    } catch (error) {
      if (error.code === 11000) {
        // Lost a race against a concurrent request from the same buyer. The
        // unique index did its job; return the thread the winner created.
        const conversation = await conversationModel.findOne({
          listing: listingId,
          buyer: userId,
        });
        return res.json({ success: true, conversation, created: false });
      }
      throw error;
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

export { listConversations, listMessages, startConversation, loadIfParticipant };
