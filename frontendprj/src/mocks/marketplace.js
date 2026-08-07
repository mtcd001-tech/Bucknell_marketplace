// TODO: This is the ONLY file in the frontend that holds placeholder/mock
// marketplace data. Every export below stands in for something the backend
// does not provide yet. When the real API surface exists, delete this file
// and swap each call site over — see the per-export TODOs for the endpoint
// each one maps to. Grep the codebase for "marketplace.js" to find every
// call site that needs to change.

// TODO: replace with the real campus categories once GET /api/product/list
// (or its future /api/listing/list) returns a campus category enum instead
// of Men/Women/Kids.
export const CAMPUS_CATEGORIES = [
  'Textbooks',
  'Furniture',
  'Electronics',
  'Dorm & Kitchen',
  'Bikes & Transport',
  'Clothing',
  'Tickets & Passes',
  'Free Stuff',
];

// TODO: replace with the real condition enum once the backend listing model
// has a `condition` field.
export const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Well Loved'];

// TODO: replace with real campus pickup spots (or a free-text/geocoded
// location) once the backend supports a pickup location field.
export const PICKUP_SPOTS = [
  'Bostwick Marketplace',
  'Elaine Langone Center',
  'Smith Hall',
  'The Cellar',
  'Hunt Hall',
  'Off campus',
];

const SELLER_NAMES = ['Alex R.', 'Jordan M.', 'Sam K.', 'Taylor B.', 'Casey L.', 'Morgan P.'];

// Deterministic string hash so a given listing id always gets the same
// placeholder condition/seller/pickup instead of a new one on every render.
function hashId(id) {
  let hash = 0;
  const str = String(id);
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// TODO: replace with fields returned directly on each listing by
// GET /api/product/list and GET /api/product/single once the backend adds
// seller, condition, and pickup location to the listing model.
export const getPlaceholderListingMeta = (id) => {
  const h = hashId(id);
  const sellerName = SELLER_NAMES[h % SELLER_NAMES.length];
  return {
    condition: CONDITIONS[h % CONDITIONS.length],
    sellerName,
    sellerRating: (3.5 + (h % 15) / 10).toFixed(1),
    sellerMemberSince: String(2022 + (h % 4)),
    pickupArea: PICKUP_SPOTS[h % PICKUP_SPOTS.length],
    // TODO: replace with the real seller's contact/message channel once
    // GET /api/product/single returns seller info instead of just an owner id.
    sellerContactEmail: `${sellerName.split(' ')[0].toLowerCase()}@bucknell.edu`,
  };
};

// TODO: replace with POST /api/ai/draft-listing once the separate
// Python/FastAPI drafting service exists. That endpoint should accept the
// uploaded photos and return this exact shape, so swapping this out is a
// one-line change at the single call site in src/pages/Sell.jsx.
export const draftListingWithAI = async ({ photos } = {}) => {
  void photos; // unused until the real endpoint inspects the uploaded photos

  await new Promise((resolve) => setTimeout(resolve, 1400));

  return {
    title: 'Organic Chemistry Textbook (7th Edition)',
    category: 'Textbooks',
    condition: 'Good',
    description: 'Used for one semester, some highlighting in the first few chapters but otherwise in good shape. No missing or torn pages.',
    suggestedPrice: 45,
    priceReasoning: 'Priced below the campus bookstore buyback rate based on similar recent textbook listings.',
    missingInfo: ['ISBN', 'Edition year'],
  };
};
