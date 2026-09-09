import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import {BrowserRouter} from 'react-router-dom'
import ShopContextProvider from './context/ShopContext.jsx'
import SocketProvider from './context/SocketContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ShopContextProvider>
        {/* Inside ShopContextProvider: the socket handshake needs the token. */}
        <SocketProvider>
          <App />
        </SocketProvider>
      </ShopContextProvider>
    </BrowserRouter>
  </StrictMode>,
)
