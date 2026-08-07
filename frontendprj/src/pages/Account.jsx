import { useState } from 'react'
import { Link } from 'react-router-dom'
import Title from '../components/Title'

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

  const [activeTab, setActiveTab] = useState(TABS[0])

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

      {/* TODO: wire to GET /api/account/listings — listings owned by the current user */}
      {activeTab === 'My Listings' && (
        <EmptyState
          title="You haven't posted anything yet"
          body="List a textbook, some furniture, or anything else you don't need anymore."
          actionLabel="Post a Listing"
          actionTo="/sell"
        />
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

      {/* TODO: replace with real-time chat (Phase 5), backed by GET /api/account/messages */}
      {activeTab === 'Messages' && (
        <EmptyState
          title="No messages yet"
          body="Conversations with buyers and sellers will show up here once messaging is built."
        />
      )}

    </div>
  )
}

export default Account
