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
