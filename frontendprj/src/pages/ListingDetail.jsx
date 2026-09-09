import { useContext, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ShopContext } from '../context/ShopContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import RelatedListings from '../components/RelatedListings';

const ListingDetail = () => {

  const { listingId } = useParams();
  const { listings, currency, backendUrl, token, navigate } = useContext(ShopContext);
  const [listingData, setListingData] = useState(false);
  const [image, setImage] = useState('')
  const [reserved, setReserved] = useState(false)
  const [openingChat, setOpeningChat] = useState(false)

  const fetchListingData = async () => {

    listings.map((item) => {
      if (item._id === listingId) {
        setListingData(item)
        setImage(item.image[0])
        return null;
      }
    })

  }

  useEffect(() => {
    fetchListingData();
  }, [listingId,listings])

  // Opens (or reuses) the thread for this listing and drops the buyer into it.
  // The endpoint is idempotent, so clicking twice never makes a second thread.
  const messageSeller = async () => {
    if (!token) {
      navigate('/login')
      return
    }
    setOpeningChat(true)
    try {
      const response = await axios.post(
        `${backendUrl}/api/conversations`,
        { listingId },
        { headers: { token } },
      )
      if (!response.data.success) {
        toast.error(response.data.message)
        return
      }
      navigate(`/account?tab=Messages&c=${response.data.conversation._id}`)
    } catch (error) {
      toast.error('Could not open that conversation.')
      console.log('start conversation failed:', error)
    } finally {
      setOpeningChat(false)
    }
  }

  return listingData ? (
    <div className='border-t-2 pt-10 transition-opacity ease-in duration-500 opacity-100'>
      {/*----------- Listing Data-------------- */}
      <div className='flex gap-12 sm:gap-12 flex-col sm:flex-row'>

        {/*---------- Listing Images------------- */}
        <div className='flex-1 flex flex-col-reverse gap-3 sm:flex-row'>
          <div className='flex sm:flex-col overflow-x-auto sm:overflow-y-scroll justify-between sm:justify-normal sm:w-[18.7%] w-full'>
              {
                listingData.image.map((item,index)=>(
                  <img onClick={()=>setImage(item)} src={item} key={index} className='w-[24%] sm:w-full sm:mb-3 flex-shrink-0 cursor-pointer' alt="" />
                ))
              }
          </div>
          <div className='w-full sm:w-[80%]'>
              <img className='w-full h-auto' src={image} alt="" />
          </div>
        </div>

        {/* -------- Listing Info ---------- */}
        <div className='flex-1'>
          <h1 className='font-medium text-2xl mt-2'>{listingData.name}</h1>
          <div className='flex items-center gap-2 mt-2'>
              {listingData.condition && (
                <span className='text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-700'>{listingData.condition}</span>
              )}
              {listingData.courseCode && (
                <span className='text-xs font-medium px-2 py-1 rounded bg-bucknell-blue/10 text-bucknell-blue'>{listingData.courseCode}</span>
              )}
          </div>
          <p className='mt-5 text-3xl font-medium'>{currency}{listingData.price}</p>
          <p className='mt-5 text-gray-500 md:w-4/5'>{listingData.description}</p>

          {/* -------- Seller Card ---------- */}
          {/* TODO: add rating and member-since once reviews exist and the user
              model stores a signup date (Phase 4+) */}
          <div className='mt-8 border border-gray-300 rounded p-4 flex items-center justify-between gap-4 max-w-md'>
            <div>
              <p className='font-medium text-gray-800'>{listingData.seller?.name || 'Unknown seller'}</p>
              {listingData.pickupLocation && (
                <p className='text-sm text-gray-500'>Pickup: {listingData.pickupLocation}</p>
              )}
            </div>
            <button onClick={messageSeller} disabled={openingChat} className='border border-black px-4 py-2 text-sm hover:bg-black hover:text-white transition-all duration-300 whitespace-nowrap disabled:opacity-50'>{openingChat ? 'Opening…' : 'Message Seller'}</button>
          </div>

          {/* -------- Request to Buy ---------- */}
          {/* TODO: replace with real-time chat + offer flow (Phase 5) */}
          {!reserved ? (
            <button onClick={()=>setReserved(true)} className='mt-6 bg-bucknell-orange text-white px-8 py-3 text-sm hover:opacity-90 transition'>Request to Buy</button>
          ) : (
            <div className='mt-6 border border-bucknell-orange/40 bg-bucknell-orange/5 rounded p-4 max-w-md'>
              <p className='font-medium text-gray-800 mb-2'>Request sent to {listingData.seller?.name || 'the seller'}</p>
              <p className='text-sm text-gray-600'>Contact: {listingData.seller?.email || 'not available'}</p>
              <p className='text-sm text-gray-600 mb-3'>Arrange a pickup at {listingData.pickupLocation || 'a public campus spot'}, or agree on another public campus spot that works for both of you.</p>
              <button onClick={()=>setReserved(false)} className='text-sm text-gray-500 underline hover:text-gray-700'>Cancel request</button>
            </div>
          )}

          <hr className='mt-8 sm:w-4/5' />
        </div>
      </div>

      {/* --------- display related listings ---------- */}

      <RelatedListings category={listingData.category} />

    </div>
  ) : <div className=' opacity-0'></div>
}

export default ListingDetail