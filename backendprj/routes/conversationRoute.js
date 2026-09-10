import express from 'express'
import {
  listConversations,
  listMessages,
  startConversation,
} from '../controllers/conversationController.js'
import {
  sendStructuredMessage,
  respondToMessage,
} from '../controllers/offerController.js'
import authUser from '../middleware/auth.js'

const conversationRouter = express.Router()

// Every route is participant-guarded inside the controller as well as
// authUser-guarded here: authUser proves who you are, the controller proves
// this particular thread is yours.
conversationRouter.get('/', authUser, listConversations)
conversationRouter.get('/:id/messages', authUser, listMessages)
conversationRouter.post('/', authUser, startConversation)

// Structured messages (offer / pickup) and their responses. Plain text goes
// over the socket instead; these mutate other documents and need a real
// request/response.
conversationRouter.post('/:id/messages', authUser, sendStructuredMessage)
conversationRouter.post('/:id/messages/:messageId/respond', authUser, respondToMessage)

export default conversationRouter
