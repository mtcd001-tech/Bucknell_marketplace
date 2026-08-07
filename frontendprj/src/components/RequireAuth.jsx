import { useContext, useEffect } from 'react'
import { ShopContext } from '../context/ShopContext'

// Frontend-only guard: redirects to /login if there's no token. Real
// authorization still has to happen server-side once these pages call
// real endpoints.
const RequireAuth = ({ children }) => {

  const { token, navigate } = useContext(ShopContext)

  useEffect(() => {
    if (!token) {
      navigate('/login')
    }
  }, [token])

  if (!token) {
    return null
  }

  return children
}

export default RequireAuth
