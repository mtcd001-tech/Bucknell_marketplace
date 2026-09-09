import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import conversationModel from "./models/conversationModel.js";
import messageModel from "./models/messageModel.js";

// THE SOCKET LAYER IS DELIVERY, NOT STORAGE.
//
// Every handler here writes to MongoDB first and only then broadcasts. If the
// recipient is offline, asleep, or on a dead subway wifi, the message is
// already durable -- they will see it the next time they open the thread,
// because the thread is read over REST from the database, not replayed from
// socket memory. Nothing that matters lives only in a socket.
//
// The corollary: a failed write must NOT broadcast. Emitting a message the
// database rejected would show both users a message that does not exist.

const roomFor = (conversationId) => `conversation:${conversationId}`;

// Shared with the REST layer in spirit: same JWT, same secret, same shape.
// Note that admin tokens (signed as a bare string, not {id}) decode to a
// string with no .id, so they fail this check -- correct, since admins are
// not conversation participants.
const authenticate = (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Not authorized"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) return next(new Error("Not authorized"));

    socket.userId = decoded.id;
    return next();
  } catch {
    return next(new Error("Not authorized"));
  }
};

// A conversation id is a guessable ObjectId, and joining a room means
// receiving everything said in it. Membership must be proven, never assumed.
const loadIfParticipant = async (conversationId, userId) => {
  const conversation = await conversationModel.findById(conversationId).catch(() => null);
  if (!conversation) return null;

  const isParticipant =
    conversation.buyer.toString() === userId || conversation.seller.toString() === userId;

  return isParticipant ? conversation : null;
};

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    // Matches the permissive cors() already applied to the REST app. Tighten
    // both together to the deployed frontend origin before going public.
    cors: { origin: "*" },
  });

  io.use(authenticate);

  io.on("connection", (socket) => {
    // Join the room for one conversation. The client re-sends this on every
    // reconnect, because room membership does not survive a dropped socket.
    socket.on("conversation:join", async ({ conversationId } = {}, ack) => {
      const conversation = await loadIfParticipant(conversationId, socket.userId);
      if (!conversation) {
        return ack?.({ success: false, message: "Conversation not found" });
      }

      socket.join(roomFor(conversationId));
      return ack?.({ success: true });
    });

    socket.on("conversation:leave", ({ conversationId } = {}) => {
      socket.leave(roomFor(conversationId));
    });

    socket.on("message:send", async ({ conversationId, body } = {}, ack) => {
      try {
        const conversation = await loadIfParticipant(conversationId, socket.userId);
        if (!conversation) {
          return ack?.({ success: false, message: "Conversation not found" });
        }
        if (conversation.status === "closed") {
          return ack?.({ success: false, message: "This conversation is closed" });
        }

        const text = (body || "").trim();
        if (!text) {
          return ack?.({ success: false, message: "Message is empty" });
        }

        // 1. PERSIST.
        const now = Date.now();
        const saved = await messageModel.create({
          conversation: conversation._id,
          sender: socket.userId,
          type: "text",
          body: text,
          createdAt: now,
        });

        // Keeps the inbox ordered by real activity.
        conversation.lastMessageAt = now;
        await conversation.save();

        const message = await saved.populate("sender", "name");

        // 2. THEN DELIVER -- to the whole room, sender included, so the
        // sender's other open tabs stay in sync. Clients de-duplicate on _id.
        io.to(roomFor(conversationId)).emit("message:new", { message });

        // The ack is what tells the sender it is safely stored, not merely
        // sent. The UI waits for this rather than assuming success.
        return ack?.({ success: true, message });
      } catch (error) {
        console.log("socket message:send failed:", error.message);
        return ack?.({ success: false, message: "Could not send message" });
      }
    });
  });

  return io;
};

export default initSocket;
export { roomFor };
