import Title from '../components/Title'
import { assets } from '../assets/assets'
import NewsletterBox from '../components/NewsletterBox'

const About = () => {
  return (
    <div>

      <div className='text-2xl text-center pt-8 border-t'>
          <Title text1={'ABOUT'} text2={'US'} />
      </div>

      <div className='my-10 flex flex-col md:flex-row gap-16'>
          <img className='w-full md:max-w-[450px]' src={assets.about_img} alt="Bucknell campus" />
          <div className='flex flex-col justify-center gap-6 md:w-2/4 text-gray-600'>
              <p>Bucknell Campus Marketplace started with a simple problem: every semester, students throw out furniture, sell textbooks for pennies to a buyback counter, or leave a mini-fridge on the curb — while the next student down the hall is buying the exact same thing new.</p>
              <p>We built a place for Bucknell students to trade directly with each other. No shipping, no warehouse, no stranger from across the country — just someone in your dorm, your class, or your club who has what you need.</p>
              <b className='text-gray-800'>Our Mission</b>
              <p>Make it easy and safe for Bucknell students to buy and sell with each other, so fewer things end up in a dumpster and more things end up with someone who'll actually use them.</p>
          </div>
      </div>

      <div className=' text-xl py-4'>
          <Title text1={'WHY'} text2={'IT WORKS'} />
      </div>

      <div className='flex flex-col md:flex-row text-sm mb-20'>
          <div className='border px-10 md:px-16 py-8 sm:py-20 flex flex-col gap-5'>
            <b>.edu Verified:</b>
            <p className=' text-gray-600'>Every account is tied to a bucknell.edu email, so you always know you're dealing with a fellow student.</p>
          </div>
          <div className='border px-10 md:px-16 py-8 sm:py-20 flex flex-col gap-5'>
            <b>No Shipping Needed:</b>
            <p className=' text-gray-600'>Meet up on campus, hand off the item, done. No boxes, no carriers, no waiting.</p>
          </div>
          <div className='border px-10 md:px-16 py-8 sm:py-20 flex flex-col gap-5'>
            <b>Two-Way Ratings:</b>
            <p className=' text-gray-600'>Buyers and sellers rate each other after every trade, so trust builds up over time.</p>
          </div>
      </div>

      <NewsletterBox/>
      
    </div>
  )
}

export default About
