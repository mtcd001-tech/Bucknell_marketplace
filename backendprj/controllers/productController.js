import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import productModel from "../models/productModel.js";
import { recordSuggestionOutcome } from "../models/priceSuggestionModel.js";
import { closeNegotiations, reopenNegotiations } from "./offerController.js";

// function for add product
const addProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      condition,
      pickupLocation,
      courseCode,
    } = req.body;

    // 1. Sửa lỗi đọc thuộc tính của undefined bằng toán tử ?.
    const image1 = req.files?.image1 && req.files.image1[0];
    const image2 = req.files?.image2 && req.files.image2[0];
    const image3 = req.files?.image3 && req.files.image3[0];
    const image4 = req.files?.image4 && req.files.image4[0];

    const images = [image1, image2, image3, image4].filter(
      (item) => item !== undefined,
    );

    let imagesUrl = await Promise.all(
      images.map(async (item) => {
        let result = await cloudinary.uploader.upload(item.path, {
          resource_type: "image",
        });
        return result.secure_url;
      }),
    );

    // Chuẩn hóa dữ liệu khớp hoàn toàn với Mongoose Schema
   const productData = {
      name,
      description,
      category,
      price: Number(price),
      condition,
      pickupLocation,
      courseCode: courseCode || null,
      image: imagesUrl,
      date: Date.now(),
      seller: req.body.userId,
    };

    console.log(productData);

    const product = new productModel(productData);
    await product.save();

    // Close the loop on the AI suggestion, if this listing came from one.
    // recordSuggestionOutcome swallows its own errors -- a logging problem
    // must never turn a successful post into a failed one.
    await recordSuggestionOutcome({
      listingDraftId: req.body.listingDraftId,
      finalPrice: productData.price,
      listingId: product._id,
    });

    res.json({ success: true, message: "Product added successfully!" });
    
  } catch (error) {
    console.log(error);
    console.log('files received:', JSON.stringify(req.files, null, 2))
    res.json({ success: false, message: error.message });
  }
};

// function for list product
const listProducts = async (req, res) => {
  

    try{

      // Sold listings drop out of browse but stay reachable by id, so links
      // and conversation context on a sold item never 404. $ne rather than
      // { status: 'active' }: rows seeded before the field existed have no
      // status at all and must still appear.
      const products = await productModel
        .find({ status: { $ne: 'sold' } })
        .populate('seller', 'name email')
      res.json({success:true, products})
    } catch(error){
    console.log(error);
    res.json({ success: false, message: error.message });
    }
};

// function for listing the current user's own listings
const myListings = async (req, res) => {
  try {
    const products = await productModel
      .find({ seller: req.body.userId })
      .sort({ date: -1 })
      .populate('seller', 'name email')
    res.json({ success: true, products })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
};

// function for remove product
const removeProduct = async (req, res) => {
  try{
    const listing = await productModel.findById(req.body.id)

    if (!listing) {
      return res.json({ success: false, message: "Listing not found" })
    }

    // TODO: allow an admin bypass here once userModel has an isAdmin field.
    // listing.seller is an ObjectId, req.body.userId is a string (from the
    // JWT payload) -- compare with .toString() or this always rejects, even
    // for the real owner.
    if (listing.seller?.toString() !== req.body.userId) {
      return res.json({ success: false, message: "Not authorized to remove this listing" })
    }

    await productModel.findByIdAndDelete(req.body.id)
    res.json({success:true, message:"Product removed"})
  } catch(error){
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Loads a listing only if the caller owns it. Same ObjectId-vs-string rule as
// removeProduct: listing.seller is an ObjectId, the JWT id is a string.
const loadOwnListing = async (listingId, userId) => {
  if (!mongoose.isValidObjectId(listingId)) return null;
  const listing = await productModel.findById(listingId);
  if (!listing || listing.seller?.toString() !== userId) return null;
  return listing;
};

// POST /api/product/mark-sold -- the seller sold it outside the app.
//
// soldPrice and soldTo stay null on purpose. There was no in-app offer, so
// there is no agreed price to record and no buyer to credit. Writing 0 (or the
// asking price) would put a made-up number into the final-vs-asking data.
const markSold = async (req, res) => {
  try {
    const listing = await loadOwnListing(req.body.id, req.body.userId);
    if (!listing) {
      return res.json({ success: false, message: "Listing not found" });
    }
    if (listing.status === "sold") {
      return res.json({ success: false, message: "This listing is already sold" });
    }

    const now = Date.now();
    listing.status = "sold";
    listing.soldAt = now;
    listing.soldPrice = null;
    listing.soldTo = null;
    await listing.save();

    // No winner to keep open -- the sale happened elsewhere -- so every
    // thread closes. Same helper the accept-offer path uses.
    const result = await closeNegotiations(listing._id, { now });

    const updated = await productModel.findById(listing._id).populate("seller", "name email");
    res.json({ success: true, listing: updated, ...result });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// POST /api/product/relist -- undo a sale, most often a mis-click on Mark as
// Sold. Also covers a deal that fell through after an accepted offer.
const relist = async (req, res) => {
  try {
    const listing = await loadOwnListing(req.body.id, req.body.userId);
    if (!listing) {
      return res.json({ success: false, message: "Listing not found" });
    }
    if (listing.status !== "sold") {
      return res.json({ success: false, message: "This listing isn't marked as sold" });
    }

    listing.status = "active";
    listing.soldAt = null;
    listing.soldPrice = null;
    listing.soldTo = null;
    await listing.save();

    const result = await reopenNegotiations(listing._id);

    const updated = await productModel.findById(listing._id).populate("seller", "name email");
    res.json({ success: true, listing: updated, ...result });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// function for add single product info
const singleProduct = async (req, res) => {
  try{
    const { productId } = req.body
    // Populated like listProducts so the detail page renders the same seller
    // card either way. This is also the ONLY way to load a sold listing --
    // browse filters those out, so a sold item's page and its conversations
    // would otherwise have nothing to render.
    const product = await productModel
      .findById(productId)
      .populate('seller', 'name email')
    res.json({success:true, product})

  }catch(error){
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

export { addProduct, listProducts, myListings, removeProduct, singleProduct, markSold, relist };