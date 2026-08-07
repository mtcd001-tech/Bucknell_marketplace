import { Link } from 'react-router-dom'
import { assets } from '../assets/assets'

const Hero = () => {
  return (
    <div className='flex flex-col sm:flex-row border border-gray-400'>
      {/* Hero Left Side */}
      <div className='w-full sm:w-1/2 flex items-center justify-center py-10 sm:py-0'>
            <div className='text-[#414141]'>
                <div className='flex items-center gap-2'>
                    <p className='w-8 md:w-11 h-[2px] bg-bucknell-orange'></p>
                    <p className=' font-medium text-sm md:text-base'>BY STUDENTS, FOR STUDENTS</p>
                </div>
                <h1 className='prata-regular text-3xl sm:py-3 lg:text-5xl leading-relaxed'>Buy & Sell on Campus</h1>
                <p className='text-sm md:text-base text-gray-600 mb-4'>Textbooks, furniture, electronics, and more — straight from fellow Bucknell students.</p>
                <div className='flex items-center gap-4 flex-wrap'>
                    <Link to='/sell' className='bg-bucknell-orange text-white font-semibold text-sm md:text-base px-6 py-3 hover:opacity-90 transition'>
                      Post a Listing
                    </Link>
                    <Link to='/collection' className='font-semibold text-sm md:text-base text-bucknell-blue hover:underline'>
                      Browse Listings
                    </Link>
                </div>
            </div>
      </div>
      {/* Hero Right Side */}
      <img className='w-full sm:w-1/2' src={assets.hero_img} alt="Bucknell students trading items on campus" />
    </div>
  )
}

export default Hero
