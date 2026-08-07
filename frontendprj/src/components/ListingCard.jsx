import { useContext } from 'react'
import { ShopContext } from '../context/ShopContext'
import { Link } from 'react-router-dom'
import { getPlaceholderListingMeta } from '../mocks/marketplace'

const ListingCard = ({ id, image, name, price, courseCode }) => {

    const { currency } = useContext(ShopContext);

    // TODO: wire to backend — condition, sellerName, and pickupArea should
    // come from the listing itself once the backend model supports them.
    const { condition, sellerName, pickupArea } = getPlaceholderListingMeta(id);

  return (
    <Link onClick={()=>scrollTo(0,0)} className='text-gray-700 cursor-pointer block' to={`/listing/${id}`}>
      <div className='overflow-hidden relative'>
        <img className='hover:scale-110 transition ease-in-out' src={image[0]} alt="" />
        <span className='absolute top-2 left-2 bg-white/90 text-gray-700 text-[10px] font-medium px-2 py-1 rounded'>{condition}</span>
      </div>
      <p className='pt-3 pb-1 text-sm'>{name}</p>
      {courseCode && (
        <span className='inline-block mb-1 text-[10px] font-medium px-2 py-0.5 rounded bg-bucknell-blue/10 text-bucknell-blue'>{courseCode}</span>
      )}
      <p className='text-sm font-medium'>{currency}{price}</p>
      <p className='text-xs text-gray-500'>{sellerName} · {pickupArea}</p>
    </Link>
  )
}

export default ListingCard
