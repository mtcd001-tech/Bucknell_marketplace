import express from 'express'
import  { addProduct, listProducts, removeProduct, singleProduct, markSold, relist } from '../controllers/productController.js';
import upload from '../middleware/multer.js';
import adminAuth from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';

const productRouter = express.Router();

productRouter.post('/add', upload.fields([
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 },
  { name: 'image3', maxCount: 1 },
  { name: 'image4', maxCount: 1 }
]), authUser, addProduct)
productRouter.get('/list',listProducts)
productRouter.post('/remove',authUser, removeProduct)
productRouter.post('/single', singleProduct)

// Seller-only; ownership is enforced inside the controller.
productRouter.post('/mark-sold', authUser, markSold)
productRouter.post('/relist', authUser, relist)

export default productRouter