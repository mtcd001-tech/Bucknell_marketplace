import { useContext, useEffect, useState } from 'react'
import { ShopContext } from '../context/ShopContext'
import Title from './Title';
import ListingCard from './ListingCard';

const LatestCollection = () => {

    const { listings } = useContext(ShopContext);
    const [latestListings,setLatestListings] = useState([]);

    useEffect(()=>{
        setLatestListings(listings.slice(0,10));
    },[listings])

  return (
    <div className='my-10'>
      <div className='text-center py-8 text-3xl'>
          <Title text1={'LISTINGS'} />
          <p className='w-3/4 m-auto text-xs sm:text-sm md:text-base text-gray-600'>
          Newly posted by Bucknell students. Browse what's for sale on campus right now.          
          </p>
      </div>

      {/* Rendering Listings */}
      <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 gap-y-6'>
        {
          latestListings.map((item,index)=>(
            <ListingCard key={index} id={item._id} image={item.image} name={item.name} price={item.price} courseCode={item.courseCode} />
          ))
        }
      </div>
    </div>
  )
}

export default LatestCollection
