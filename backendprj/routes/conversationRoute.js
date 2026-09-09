import express from 'express'
import {
  listConversations,
  listMessages,
  startConversation,
} from '../controllers/conversationController.js'
import authUser from '../middleware/auth.js'

const conversationRouter = express.Router()

// Every route is participant-guarded inside the controller as well as
// authUser-guarded here: authUser proves who you are, the controller proves
// this particular thread is yours.
conversationRouter.get('/', authUser, listConversations)
conversationRouter.get('/:id/messages', authUser, listMessages)
conversationRouter.post('/', authUser, startConversation)

export default conversationRouter
