import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name: {type: String, required: true},
    description: {type: String, required: true},
    price: {type: Number, required: true},
    image: {type: Array, required: true},
    category: {type: String, required: true},
    subCategory: {type: String, required: false},
    size: {type: Array, required: false},
    bestSeller: {type: Boolean},
    date: {type: Number, required: true},
    condition: { type: String },
    pickupLocation: { type: String },
    courseCode: { type: String, default: null },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },

    // Set when a seller accepts an offer. Legacy rows predate this field and
    // have no `status` at all, which is why browse filters on { $ne: 'sold' }
    // rather than { status: 'active' } -- the latter would hide every listing
    // seeded before this existed.
    status: { type: String, enum: ['active', 'sold'], default: 'active' },
    soldPrice: { type: Number, default: null },
    soldTo: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
    soldAt: { type: Number, default: null },
})

// Final price vs asking price, the second question offers-as-data answers.
//
// The soldPrice filter is LOAD-BEARING, not defensive. A listing marked sold
// manually (sold off-app, no in-app offer) has soldPrice: null by design --
// there is no agreed number to record. Drop the filter and those rows count
// toward `sales` while contributing nothing to the averages, quietly skewing
// the discount; worse, anyone who later "fixes" nulls with $ifNull(..., 0)
// turns every off-app sale into a 100%-off sale.
//
// Note the query-vs-expression difference: in this $match, { $ne: null }
// excludes both null AND a missing field. Inside an aggregation expression,
// { $eq: ["$soldPrice", null] } does NOT treat a missing field as null.
//
//   db.products.aggregate([
//     { $match: { status: "sold", soldPrice: { $ne: null } } },
//     { $group: {
//         _id: null,
//         sales:     { $sum: 1 },
//         avgAsking: { $avg: "$price" },
//         avgSold:   { $avg: "$soldPrice" },
//         avgDiscountPct: { $avg: { $multiply: [
//             { $divide: [{ $subtract: ["$price", "$soldPrice"] }, "$price"] }, 100 ] } }
//     }}
//   ])
//
// Add { $group: { _id: "$category", ... } } to see which categories haggle
// hardest. None of this is answerable if "I'll do $40" is a chat string.
//
// How many sales happen in the app versus off it (a manual sale has no price):
//
//   db.products.aggregate([
//     { $match: { status: "sold" } },
//     { $group: { _id: { $cond: [{ $gt: ["$soldPrice", null] }, "in-app offer", "marked sold"] },
//                 n: { $sum: 1 } } }
//   ])

const productModel = mongoose.models.product || mongoose.model("product", productSchema);

export default productModel
