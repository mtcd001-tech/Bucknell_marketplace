import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import connectedDB from './config/mongodb.js'
import connectCloudinary from './config/cloudinary.js'
import userRouter from './routes/userRoute.js'
import productRouter from './routes/productRoute.js'
import cartRouter from './routes/cartRoute.js'
import orderRouter from './routes/orderRoute.js'
import accountRouter from './routes/accountRoute.js'
import aiRouter from './routes/aiRoute.js'
import conversationRouter from './routes/conversationRoute.js'

// App Config
const app = express()
const port = process.env.PORT || 4000
connectedDB()
connectCloudinary()

// middlewares
app.use(express.json())
app.use(cors())

// api endpoints
app.use('/api/user', userRouter)
app.use('/api/product', productRouter)
app.use('/api/cart', cartRouter)
app.use('/api/order', orderRouter)
app.use('/api/account', accountRouter)
app.use('/api/ai', aiRouter)
app.use('/api/conversations', conversationRouter)

app.get('/',(req,res)=>{
    res.send("API Working")
})

app.listen(port, ()=>console.log('Server started on PORT: ' + port))

export default app