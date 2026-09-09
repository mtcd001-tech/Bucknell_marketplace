import { useContext, useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { ShopContext } from "../context/ShopContext";
import { SocketContext } from "../context/SocketContext";
import { currentUserId } from "../utils/currentUser";

// One conversation.
//
// RECONNECTION, which is the whole reason this component is shaped this way:
//
//   REST is the source of truth. The socket is a live channel on top of it.
//
// If the wifi drops, socket.io reconnects on its own -- but any message sent
// during the gap was broadcast to a room this browser was no longer in, so it
// is simply not delivered. Rather than build a replay protocol, every
// (re)connect re-joins the room AND re-fetches the thread from the database.
// Anything missed comes back from Mongo, where it was written before it was
// ever broadcast. The gap closes deterministically, with no acks to track and
// no ordering to reconcile.
//
// The cost is refetching the whole thread on reconnect. For campus haggling
// (tens of messages) that is nothing. If threads ever got long, the fix is a
// ?since=<createdAt> parameter on the messages endpoint, not a replay buffer.
const ChatThread = ({ conversation, onMessageSent }) => {
  const { backendUrl, token } = useContext(ShopContext);
  const { socket, connected } = useContext(SocketContext);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const conversationId = conversation?._id;
  const me = currentUserId(token);
  const isClosed = conversation?.status === "closed";

  const loadThread = useCallback(async () => {
    if (!conversationId) return;
    try {
      const res = await axios.get(
        `${backendUrl}/api/conversations/${conversationId}/messages`,
        { headers: { token } },
      );
      if (res.data.success) {
        setMessages(res.data.messages);
      } else {
        toast.error(res.data.message);
      }
    } catch (error) {
      console.log("load thread failed:", error);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, token, conversationId]);

  useEffect(() => {
    setLoading(true);
    loadThread();
  }, [loadThread]);

  useEffect(() => {
    if (!socket || !conversationId) return;

    // Runs on first connect and on every reconnect: rejoin, then resync.
    const joinAndSync = () => {
      socket.emit("conversation:join", { conversationId });
      loadThread();
    };

    if (socket.connected) joinAndSync();
    socket.on("connect", joinAndSync);

    const onNew = ({ message }) => {
      if (String(message.conversation) !== String(conversationId)) return;
      // De-duplicate: a message can arrive both from the room broadcast and
      // from a resync refetch. _id is the only reliable identity.
      setMessages((prev) =>
        prev.some((m) => m._id === message._id) ? prev : [...prev, message],
      );
      onMessageSent?.();
    };
    socket.on("message:new", onNew);

    return () => {
      socket.emit("conversation:leave", { conversationId });
      socket.off("connect", joinAndSync);
      socket.off("message:new", onNew);
    };
  }, [socket, conversationId, loadThread, onMessageSent]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !socket || sending) return;

    setSending(true);
    socket.emit("message:send", { conversationId, body }, (ack) => {
      setSending(false);
      if (!ack?.success) {
        toast.error(ack?.message || "Could not send that message.");
        return;
      }
      // Only clear the box once the server confirms the write. The message
      // itself arrives through the room broadcast, so there is no optimistic
      // copy to reconcile -- what you see is what is in the database.
      setDraft("");
    });
  };

  if (!conversationId) return null;

  return (
    <div className="flex flex-col h-[28rem] border border-gray-300 rounded">
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-gray-800 truncate">
            {conversation.listing?.name || "Listing"}
          </p>
          <p className="text-xs text-gray-500">
            {conversation.buyer?._id === me
              ? `Seller: ${conversation.seller?.name || "unknown"}`
              : `Buyer: ${conversation.buyer?.name || "unknown"}`}
          </p>
        </div>
        <span
          className={`text-[10px] px-2 py-1 rounded whitespace-nowrap ${connected ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}
        >
          {connected ? "Live" : "Reconnecting…"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-400">
            No messages yet. Say hello and ask about the item.
          </p>
        ) : (
          messages.map((m) => {
            const mine = String(m.sender?._id || m.sender) === String(me);
            return (
              <div
                key={m._id}
                className={`max-w-[75%] px-3 py-2 rounded text-sm ${
                  mine
                    ? "self-end bg-bucknell-blue text-white"
                    : "self-start bg-gray-100 text-gray-800"
                }`}
              >
                {!mine && (
                  <p className="text-[10px] opacity-70 mb-0.5">
                    {m.sender?.name || "them"}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {isClosed ? (
        <p className="px-4 py-3 border-t text-sm text-gray-500 bg-gray-50">
          This listing sold to someone else. The conversation is read-only.
        </p>
      ) : (
        <form onSubmit={send} className="flex gap-2 p-3 border-t">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="Write a message…"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="bg-bucknell-orange text-white px-5 py-2 text-sm rounded disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      )}
    </div>
  );
};

export default ChatThread;
