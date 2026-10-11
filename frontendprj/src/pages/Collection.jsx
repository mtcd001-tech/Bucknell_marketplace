import { useContext, useEffect, useState } from 'react'
import { ShopContext } from '../context/ShopContext'
import { assets } from '../assets/assets';
import Title from '../components/Title';
import ListingCard from '../components/ListingCard';
import { CAMPUS_CATEGORIES, CONDITIONS } from '../mocks/marketplace';

const Collection = () => {

  const { listings , search , showSearch } = useContext(ShopContext);
  const [showFilter,setShowFilter] = useState(false);
  const [filterListings,setFilterListings] = useState([]);
  const [category,setCategory] = useState([]);
  const [condition,setCondition] = useState([]);
  const [sortType,setSortType] = useState('relavent')

  const toggleCategory = (e) => {

    if (category.includes(e.target.value)) {
        setCategory(prev=> prev.filter(item => item !== e.target.value))
    }
    else{
      setCategory(prev => [...prev,e.target.value])
    }

  }

  const toggleCondition = (e) => {

    if (condition.includes(e.target.value)) {
      setCondition(prev=> prev.filter(item => item !== e.target.value))
    }
    else{
      setCondition(prev => [...prev,e.target.value])
    }
  }

  const applyFilter = () => {

    let listingsCopy = listings.slice();

    if (showSearch && search) {
      listingsCopy = listingsCopy.filter(item => item.name.toLowerCase().includes(search.toLowerCase()))
    }

    if (category.length > 0) {
      listingsCopy = listingsCopy.filter(item => category.includes(item.category));
    }

    if (condition.length > 0) {
      listingsCopy = listingsCopy.filter(item => condition.includes(item.condition));
    }

    setFilterListings(listingsCopy)

  }

  const sortListings = () => {

    let flCopy = filterListings.slice();

    switch (sortType) {
      case 'low-high':
        setFilterListings(flCopy.sort((a,b)=>(a.price - b.price)));
        break;

      case 'high-low':
        setFilterListings(flCopy.sort((a,b)=>(b.price - a.price)));
        break;

      default:
        applyFilter();
        break;
    }

  }

  useEffect(()=>{
      applyFilter();
  },[category,condition,search,showSearch,listings])

  useEffect(()=>{
    sortListings();
  },[sortType])

  return (
    <div className='flex flex-col sm:flex-row gap-1 sm:gap-10 pt-10 border-t'>

      {/* Filter Options */}
      <div className='min-w-60'>
        <p onClick={()=>setShowFilter(!showFilter)} className='my-2 text-xl flex items-center cursor-pointer gap-2'>FILTERS
          <img className={`h-3 sm:hidden ${showFilter ? 'rotate-90' : ''}`} src={assets.dropdown_icon} alt="" />
        </p>
        {/* Category Filter */}
        <div className={`border border-gray-300 pl-5 py-3 mt-6 ${showFilter ? '' :'hidden'} sm:block`}>
          <p className='mb-3 text-sm font-medium'>CATEGORY</p>
          <div className='flex flex-col gap-2 text-sm font-light text-gray-700'>
            {CAMPUS_CATEGORIES.map((cat) => (
              <p className='flex gap-2' key={cat}>
                <input className='w-3' type="checkbox" value={cat} onChange={toggleCategory}/> {cat}
              </p>
            ))}
          </div>
        </div>
        {/* Condition Filter */}
        <div className={`border border-gray-300 pl-5 py-3 my-5 ${showFilter ? '' :'hidden'} sm:block`}>
          <p className='mb-3 text-sm font-medium'>CONDITION</p>
          <div className='flex flex-col gap-2 text-sm font-light text-gray-700'>
            {CONDITIONS.map((c) => (
              <p className='flex gap-2' key={c}>
                <input className='w-3' type="checkbox" value={c} onChange={toggleCondition}/> {c}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side */}
      <div className='flex-1'>

        <div className='flex justify-between text-base sm:text-2xl mb-4'>
            <Title text1={'ALL'} text2={'LISTINGS'} />
            {/* Listing Sort */}
            <select onChange={(e)=>setSortType(e.target.value)} className='border-2 border-gray-300 text-sm px-2'>
              <option value="relavent">Sort by: Relevant</option>
              <option value="low-high">Sort by: Low to High</option>
              <option value="high-low">Sort by: High to Low</option>
            </select>
        </div>

        {/* Map Listings */}
        {filterListings.length > 0 ? (
          <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 gap-y-6'>
            {
              filterListings.map((item,index)=>(
                <ListingCard key={index} name={item.name} id={item._id} price={item.price} image={item.image} courseCode={item.courseCode} condition={item.condition} seller={item.seller} pickupLocation={item.pickupLocation}/>
              ))
            }
          </div>
        ) : (
          <div className='text-center py-20 text-gray-500'>
            <p className='text-lg font-medium mb-1'>No listings match yet</p>
            <p className='text-sm'>Try clearing a filter, or be the first to post one.</p>
          </div>
        )}
      </div>

    </div>
  )
}

export default Collection
