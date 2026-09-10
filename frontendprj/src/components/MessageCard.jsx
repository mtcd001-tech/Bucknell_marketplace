// Offers and pickups render as cards with actions, not as chat bubbles.
//
// That difference is the point of the whole feature: "I'll give you $40" as
// text is a sentence someone has to read and act on manually. As a card with
// Accept / Decline / Counter, the response is a state transition the database
// records -- which is what makes acceptance rates and final-vs-asking price
// answerable later without parsing English.

const money = (n) => `$${Number(n).toLocaleString()}`;

const OFFER_LABEL = {
  pending: null,
  accepted: "Accepted",
  declined: "Declined",
  countered: "Countered",
  expired: "Expired — sold to someone else",
};

export const OfferCard = ({ message, mine, canRespond, busy, onRespond, onCounter }) => {
  const status = message.offer?.status || "pending";
  const settled = status !== "pending";

  return (
    <div
      className={`max-w-[85%] border rounded p-3 text-sm ${
        mine ? "self-end" : "self-start"
      } ${status === "accepted" ? "border-green-400 bg-green-50" : "border-gray-300 bg-white"}`}
    >
      <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">
        {mine ? "Your offer" : `Offer from ${message.sender?.name || "them"}`}
      </p>
      <p className="text-xl font-medium text-gray-900">{money(message.offer?.amount)}</p>
      {message.body && <p className="text-gray-600 mt-1">{message.body}</p>}

      {settled ? (
        <p
          className={`mt-2 text-xs font-medium ${
            status === "accepted" ? "text-green-700" : "text-gray-500"
          }`}
        >
          {OFFER_LABEL[status]}
        </p>
      ) : canRespond ? (
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            disabled={busy}
            onClick={() => onRespond(message._id, "accept")}
            className="bg-green-600 text-white px-3 py-1.5 text-xs rounded disabled:opacity-50"
          >
            Accept
          </button>
          <button
            disabled={busy}
            onClick={() => onRespond(message._id, "decline")}
            className="border border-gray-400 px-3 py-1.5 text-xs rounded disabled:opacity-50"
          >
            Decline
          </button>
          <button
            disabled={busy}
            onClick={() => onCounter(message._id)}
            className="border border-bucknell-blue text-bucknell-blue px-3 py-1.5 text-xs rounded disabled:opacity-50"
          >
            Counter
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-400">Waiting for a response…</p>
      )}
    </div>
  );
};

const PICKUP_LABEL = {
  proposed: null,
  confirmed: "Pickup arranged",
  declined: "Declined",
};

export const PickupCard = ({ message, mine, canRespond, busy, onRespond }) => {
  const status = message.pickup?.status || "proposed";
  const settled = status !== "proposed";

  return (
    <div
      className={`max-w-[85%] border rounded p-3 text-sm ${
        mine ? "self-end" : "self-start"
      } ${status === "confirmed" ? "border-bucknell-orange bg-bucknell-orange/5" : "border-gray-300 bg-white"}`}
    >
      <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">
        {mine ? "Your pickup proposal" : `Pickup proposed by ${message.sender?.name || "them"}`}
      </p>
      <p className="font-medium text-gray-900">{message.pickup?.location}</p>
      <p className="text-gray-600">{message.pickup?.time}</p>
      {message.body && <p className="text-gray-600 mt-1">{message.body}</p>}

      {settled ? (
        <p
          className={`mt-2 text-xs font-medium ${
            status === "confirmed" ? "text-bucknell-orange" : "text-gray-500"
          }`}
        >
          {PICKUP_LABEL[status]}
        </p>
      ) : canRespond ? (
        <div className="flex gap-2 mt-3">
          <button
            disabled={busy}
            onClick={() => onRespond(message._id, "confirm")}
            className="bg-bucknell-orange text-white px-3 py-1.5 text-xs rounded disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            disabled={busy}
            onClick={() => onRespond(message._id, "decline")}
            className="border border-gray-400 px-3 py-1.5 text-xs rounded disabled:opacity-50"
          >
            Can't make it
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-400">Waiting for confirmation…</p>
      )}
    </div>
  );
};
