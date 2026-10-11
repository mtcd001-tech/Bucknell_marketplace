import express from 'express'
import { myListings } from '../controllers/productController.js'
import authUser from '../middleware/auth.js'

const accountRouter = express.Router()

accountRouter.get('/listings', authUser, myListings)

export default accountRouter
