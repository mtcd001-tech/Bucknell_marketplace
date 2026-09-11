import { useContext, useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { ShopContext } from '../context/ShopContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import RelatedListings from '../components/RelatedListings';
import { currentUserId } from '../utils/currentUser';

const ListingDetail = () => {

  const { listingId } = useParams();
  const { listings, currency, backendUrl, token, navigate } = useContext(ShopContext);
  const [listingData, setListingData] = useState(false);
  const [image, setImage] = useState('')
  const [openingChat, setOpeningChat] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const me = currentUserId(token)
  // /api/product/list populates seller into an object; a direct fetch may too,
  // but older callers can still hand back a bare id. Accept either shape.
  const sellerId = String(listingData?.seller?._id || listingData?.seller || '')
  const isMine = Boolean(me) && sellerId === String(me)
  const isSold = listingData?.status === 'sold'
  const iBoughtIt =
    isSold && String(listingData?.soldTo?._id || listingData?.soldTo || '') === String(me)

  const fetchListingData = useCallback(async () => {
    // Fast path: the browse list is already in memory.
    const fromContext = listings.find((item) => item._id === listingId)
    if (fromContext) {
      setListingData(fromContext)
      setImage(fromContext.image[0])
      return
    }

    // Fall back to fetching by id. This is not just an optimization for deep
    // links: browse excludes sold listings, so a sold item exists ONLY through
    // this path. Without it, every sold listing's page would render blank.
    try {
      const res = await axios.post(`${backendUrl}/api/product/single`, { productId: listingId })
      if (res.data.success && res.data.product) {
        setListingData(res.data.product)
        setImage(res.data.product.image?.[0] || '')
      } else {
        setNotFound(true)
      }
    } catch (error) {
      console.log('load listing failed:', error)
      setNotFound(true)
    }
  }, [listings, listingId, backendUrl])

  useEffect(() => {
    fetchListingData();
  }, [fetchListingData])

  // Both buttons land here. The POST is idempotent, so a buyer who already has
  // a thread on this listing is returned to it rather than getting a second
  // one -- the unique (listing, buyer) index guarantees that server-side.
  //
  // `compose` is the only difference between them: "Request to Buy" opens the
  // thread with the offer form ready, "Message Seller" opens it for chat.
  const openConversation = async (compose) => {
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
      const query = `tab=Messages&c=${response.data.conversation._id}${compose ? `&compose=${compose}` : ''}`
      navigate(`/account?${query}`)
    } catch (error) {
      toast.error('Could not open that conversation.')
      console.log('start conversation failed:', error)
    } finally {
      setOpeningChat(false)
    }
  }

  if (notFound) {
    return (
      <div className='border-t-2 pt-20 pb-20 text-center text-gray-500'>
        <p className='text-lg font-medium text-gray-700 mb-1'>Listing not found</p>
        <p className='text-sm'>It may have been removed by the seller.</p>
      </div>
    )
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
          <div className='w-full sm:w-[80%] relative'>
              <img className={`w-full h-auto ${isSold ? 'opacity-60' : ''}`} src={image} alt="" />
              {isSold && (
                <span className='absolute top-3 left-3 bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded'>
                  SOLD
                </span>
              )}
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
              <p className='font-medium text-gray-800'>
                {isMine ? 'You' : listingData.seller?.name || 'Unknown seller'}
              </p>
              {listingData.pickupLocation && (
                <p className='text-sm text-gray-500'>Pickup: {listingData.pickupLocation}</p>
              )}
            </div>
            {/* No point offering to message yourself. */}
            {!isMine && !isSold && (
              <button
                onClick={() => openConversation('text')}
                disabled={openingChat}
                className='border border-black px-4 py-2 text-sm hover:bg-black hover:text-white transition-all duration-300 whitespace-nowrap disabled:opacity-50'
              >
                {openingChat ? 'Opening…' : 'Message Seller'}
              </button>
            )}
          </div>

          {/* -------- Buy action, or why there isn't one ---------- */}
          {isSold ? (
            <div className='mt-6 border border-gray-300 bg-gray-50 rounded p-4 max-w-md'>
              <p className='font-medium text-gray-800 mb-1'>
                {iBoughtIt ? 'You bought this' : 'This listing sold'}
              </p>
              <p className='text-sm text-gray-600'>
                {listingData.soldPrice != null
                  ? `Sold for ${currency}${listingData.soldPrice}.`
                  : 'It is no longer available.'}
                {' '}
                {isMine || iBoughtIt
                  ? 'Your conversation stays open in My Account so you can arrange pickup.'
                  : 'It is no longer available.'}
              </p>
            </div>
          ) : isMine ? (
            <div className='mt-6 border border-gray-300 bg-gray-50 rounded p-4 max-w-md'>
              <p className='font-medium text-gray-800 mb-1'>This is your listing</p>
              <p className='text-sm text-gray-600'>
                Buyers who message you show up under Messages in My Account.
              </p>
            </div>
          ) : (
            <button
              onClick={() => openConversation('offer')}
              disabled={openingChat}
              className='mt-6 bg-bucknell-orange text-white px-8 py-3 text-sm hover:opacity-90 transition disabled:opacity-50'
            >
              {openingChat ? 'Opening…' : 'Request to Buy'}
            </button>
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
