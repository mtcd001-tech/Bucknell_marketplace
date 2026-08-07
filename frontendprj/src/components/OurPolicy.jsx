import React from 'react'
import { assets } from '../assets/assets'

const OurPolicy = () => {
  return (
    <div className='flex flex-col sm:flex-row justify-around gap-12 sm:gap-2 text-center py-20 text-xs sm:text-sm md:text-base text-gray-700'>
      
      <div>
        <img src={assets.exchange_icon} className='w-12 m-auto mb-5' alt="" />
        <p className=' font-semibold'>Verified Students Only</p>
        <p className=' text-gray-400'>Every account is tied to a bucknell.edu email</p>
      </div>
      <div>
        <img src={assets.quality_icon} className='w-12 m-auto mb-5' alt="" />
        <p className=' font-semibold'>Meet On Campus</p>
        <p className=' text-gray-400'>Arrange pickup at a public campus spot that works for both of you</p>
      </div>
      <div>
        <img src={assets.support_img} className='w-12 m-auto mb-5' alt="" />
        <p className=' font-semibold'>Rated Both Ways</p>
        <p className=' text-gray-400'>Buyers and sellers rate each other after every trade</p>
      </div>

    </div>
  )
}

export default OurPolicy
