import { useContext, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { ShopContext } from '../context/ShopContext'
import Title from '../components/Title'
import ListingCard from '../components/ListingCard'
import ChatThread from '../components/ChatThread'
import { currentUserId } from '../utils/currentUser'

const TABS = ['My Listings', 'Purchases', 'Sales', 'Messages']

const EmptyState = ({ title, body, actionLabel, actionTo }) => (
  <div className='text-center py-20 text-gray-500 max-w-md mx-auto'>
    <p className='text-lg font-medium text-gray-700 mb-1'>{title}</p>
    <p className='text-sm mb-6'>{body}</p>
    {actionLabel && (
      <Link to={actionTo} className='inline-block bg-bucknell-orange text-white px-6 py-2 text-sm hover:opacity-90 transition'>{actionLabel}</Link>
    )}
  </div>
)

const Account = () => {

  const { backendUrl, token, getListingsData } = useContext(ShopContext)
  // Deep links from a listing land here as ?tab=Messages&c=<conversationId>,
  // so "Message Seller" can drop you straight into the right thread.
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(
    TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : TABS[0],
  )
  const [myListings, setMyListings] = useState([])
  const [conversations, setConversations] = useState([])
  const [selectedId, setSelectedId] = useState(searchParams.get('c') || '')
  const [changingId, setChangingId] = useState('')
  const me = currentUserId(token)

  const fetchMyListings = async () => {
    try {
      const response = await axios.get(backendUrl + '/api/account/listings', { headers: { token } })
      if (response.data.success) {
        setMyListings(response.data.products)
      } else {
        toast.error(response.data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  const changeListingStatus = async (id, action) => {
    setChangingId(id)
    try {
      const response = await axios.post(
        `${backendUrl}/api/product/${action}`,
        { id },
        { headers: { token } },
      )
      if (!response.data.success) {
        toast.error(response.data.message)
        return
      }
      toast.success(action === 'mark-sold' ? 'Marked as sold.' : 'Relisted.')
      // Both change which threads are open, so the inbox refreshes too.
      await Promise.all([fetchMyListings(), fetchConversations(), getListingsData()])
    } catch (error) {
      toast.error('Could not update this listing.')
      console.log(`${action} failed:`, error)
    } finally {
      setChangingId('')
    }
  }

  const markListingSold = (id) => {
    const ok = window.confirm(
      'Mark this listing as sold? Anyone messaging you about it will see the conversation close. You can relist it afterwards.',
    )
    if (ok) changeListingStatus(id, 'mark-sold')
  }

  const relistListing = (id) => changeListingStatus(id, 'relist')

  const fetchConversations = async () => {
    try {
      const response = await axios.get(backendUrl + '/api/conversations', { headers: { token } })
      if (response.data.success) {
        setConversations(response.data.conversations)
      }
    } catch (error) {
      console.log('load conversations failed:', error)
    }
  }

  useEffect(() => {
    fetchMyListings()
    fetchConversations()
  }, [])

  return (
    <div className='border-t pt-10 pb-20'>
      <div className='text-2xl mb-6'>
        <Title text1={'MY'} text2={'ACCOUNT'} />
      </div>

      <div className='flex gap-2 border-b mb-8 flex-wrap'>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={()=>setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${activeTab === tab ? 'border-bucknell-orange text-bucknell-orange' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'My Listings' && (
        myListings.length > 0 ? (
          <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 gap-y-6'>
            {myListings.map((item) => {
              const sold = item.status === 'sold'
              return (
                // The action sits OUTSIDE ListingCard on purpose: the card is
                // one big <Link>, and a button nested inside a link is invalid
                // HTML that also fires navigation when you meant to click it.
                <div key={item._id} className={sold ? 'opacity-70' : ''}>
                  <ListingCard
                    id={item._id}
                    image={item.image}
                    name={item.name}
                    price={item.price}
                    courseCode={item.courseCode}
                    condition={item.condition}
                    seller={item.seller}
                    pickupLocation={item.pickupLocation}
                  />
                  {sold && (
                    <p className='text-xs text-gray-500 mt-1'>
                      {item.soldPrice != null ? `Sold for $${item.soldPrice}` : 'Marked as sold'}
                    </p>
                  )}
                  <button
                    onClick={() => (sold ? relistListing(item._id) : markListingSold(item._id))}
                    disabled={changingId === item._id}
                    className='mt-2 w-full border border-gray-300 text-xs py-1.5 rounded hover:bg-gray-50 disabled:opacity-50'
                  >
                    {changingId === item._id ? 'Updating…' : sold ? 'Relist' : 'Mark as Sold'}
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title="You haven't posted anything yet"
            body="List a textbook, some furniture, or anything else you don't need anymore."
            actionLabel="Post a Listing"
            actionTo="/sell"
          />
        )
      )}

      {/* TODO: wire to GET /api/account/purchases */}
      {activeTab === 'Purchases' && (
        <EmptyState
          title="No purchases yet"
          body="Items you request to buy will show up here once a seller confirms."
          actionLabel="Browse Listings"
          actionTo="/collection"
        />
      )}

      {/* TODO: wire to GET /api/account/sales */}
      {activeTab === 'Sales' && (
        <EmptyState
          title="No sales yet"
          body="Once someone buys something you've listed, it'll show up here."
        />
      )}

      {activeTab === 'Messages' && (
        conversations.length === 0 ? (
          <EmptyState
            title="No messages yet"
            body="When you message a seller about a listing, the conversation shows up here."
            actionLabel="Browse Listings"
            actionTo="/collection"
          />
        ) : (
          <div className='flex flex-col md:flex-row gap-6'>
            {/* Thread list */}
            <div className='md:w-64 flex flex-col gap-2'>
              {conversations.map((c) => {
                const other = c.buyer?._id === me ? c.seller : c.buyer
                return (
                  <button
                    key={c._id}
                    onClick={() => setSelectedId(c._id)}
                    className={`text-left border rounded px-3 py-2 transition ${selectedId === c._id ? 'border-bucknell-orange bg-bucknell-orange/5' : 'border-gray-300 hover:bg-gray-50'}`}
                  >
                    <p className='text-sm font-medium text-gray-800 truncate'>{c.listing?.name || 'Listing'}</p>
                    <p className='text-xs text-gray-500 truncate'>
                      {c.buyer?._id === me ? 'Buying from' : 'Selling to'} {other?.name || 'unknown'}
                    </p>
                    {c.status === 'closed' && (
                      <span className='text-[10px] text-gray-500'>closed</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Selected thread */}
            <div className='flex-1'>
              {selectedId ? (
                <ChatThread
                  conversation={conversations.find((c) => c._id === selectedId)}
                  onMessageSent={fetchConversations}
                  initialComposer={searchParams.get('compose')}
                />
              ) : (
                <p className='text-sm text-gray-500 py-10 text-center'>Pick a conversation to open it.</p>
              )}
            </div>
          </div>
        )
      )}

    </div>
  )
}

export default Account
