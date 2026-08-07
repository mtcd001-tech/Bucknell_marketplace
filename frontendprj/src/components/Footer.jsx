import { assets } from '../assets/assets'

const Footer = () => {
  return (
    <div>
      <div className='flex flex-col sm:grid grid-cols-[3fr_1fr_1fr] gap-14 my-10 mt-40 text-sm'>

        <div>
            <img src={assets.logo} className='mb-5 w-32' alt="Bucknell Campus Marketplace" />
            <p className='w-full md:w-2/3 text-gray-600'>
            A peer-to-peer marketplace built for Bucknell students. List what you no longer need, find what you do - no shipping, no middleman. </p>
        </div>

        <div>
            <p className='text-xl font-medium mb-5'>WHO WE ARE</p>
            <ul className='flex flex-col gap-1 text-gray-600'>
                <li>Home</li>
                <li>About</li>
                <li>How it works</li>
                <li>Safety tip</li>
                <li>Privacy Policy</li>
            </ul>
        </div>

        <div>
            <p className='text-xl font-medium mb-5'>GET IN TOUCH</p>
            <ul className='flex flex-col gap-1 text-gray-600'>
                <li>+1-570-551-4374</li>
                <li>mtcd001@bucknell.edu</li>
            </ul>
        </div>

      </div>

        <div>
            <hr />
            <p className='py-5 text-sm text-center'>© 2026 Bucknell Campus Marketplace — All Rights Reserved</p>
        </div>

    </div>
  )
}

export default Footer
