import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Collection from './pages/Collection'
import About from './pages/About'
import Contact from './pages/Contact'
import ListingDetail from './pages/ListingDetail'
import Login from './pages/Login'
import Sell from './pages/Sell'
import Navbar from './components/NavBar.jsx'
import Footer from './components/Footer.jsx'
import SearchBar from './components/SearchBar.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const App = () => {
  return (
    <div className='px-4 sm:px-[5vw] md:px-[7vw] lg:px-[9vw]'>
      <ToastContainer />
      <Navbar />
      <SearchBar />
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/collection' element={<Collection />} />
        <Route path='/about' element={<About />} />
        <Route path='/contact' element={<Contact />} />
        <Route path='/listing/:listingId' element={<ListingDetail />} />
        <Route path='/login' element={<Login />} />
        <Route path='/sell' element={<RequireAuth><Sell /></RequireAuth>} />
      </Routes>
      <Footer />
    </div>
  )
}

export default App
