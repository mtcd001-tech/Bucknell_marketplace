import express from 'express'
import multer from 'multer'
import { draftListing } from '../controllers/aiController.js'
import authUser from '../middleware/auth.js'

const aiRouter = express.Router()

// Memory storage, not the shared disk-based middleware/multer.js: these photos
// are forwarded to the Python service immediately and never need to exist on
// disk. It also sidesteps two problems with the shared config -- it names files
// by originalname, so two photos called "image.jpg" would overwrite each other,
// and nothing ever cleans the temp files up.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // matches MAX_IMAGE_BYTES in marketmind/app/config.py
    files: 4,                  // matches MAX_IMAGES
  },
})

// upload BEFORE authUser, matching productRoute.js: multer parses the
// multipart body and assigns req.body, which would wipe the userId that
// authUser writes onto it if the order were reversed.
aiRouter.post('/draft-listing', upload.array('images', 4), authUser, draftListing)

export default aiRouter
