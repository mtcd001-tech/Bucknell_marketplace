import { useContext, useEffect, useState } from 'react'
import { ShopContext } from '../context/ShopContext'
import Title from './Title';
import ListingCard from './ListingCard';

const RelatedListings = ({category}) => {

    const { listings } = useContext(ShopContext);
    const [related,setRelated] = useState([]);

    useEffect(()=>{

        if (listings.length > 0) {

            let listingsCopy = listings.slice();

            listingsCopy = listingsCopy.filter((item) => category === item.category);

            setRelated(listingsCopy.slice(0,5));
        }

    },[listings])

  return (
    <div className='my-24'>
      <div className=' text-center text-3xl py-2'>
        <Title text1={'RELATED'} text2={"LISTINGS"} />
      </div>

      <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 gap-y-6'>
        {related.map((item,index)=>(
            <ListingCard key={index} id={item._id} name={item.name} price={item.price} image={item.image} courseCode={item.courseCode}/>
        ))}
      </div>
    </div>
  )
}

export default RelatedListings
