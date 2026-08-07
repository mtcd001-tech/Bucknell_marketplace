import { NavLink } from 'react-router-dom'
import { assets } from '../assets/assets.js'
const SideBar = () => {
  return (
    <div className = 'w-[18%] min-h-screen border-r-2'>
        <div className = 'flex flex-col gap-4 px-6 pl-[20%] text-[15px]'>

            <NavLink className = 'flex items-center gap-3 border border-gray-300 border-r-0 px-3 py-2 rounded-l' to="/list">
                <img className = 'w-5 h-5' src={assets.order_icon} alt="" />
                <p className = 'hidden md:block'> Moderate Listings</p>
            </NavLink>

            <NavLink className = 'flex items-center gap-3 border border-gray-300 border-r-0 px-3 py-2 rounded-l' to="/orders">
                <img className = 'w-5 h-5' src={assets.order_icon} alt="" />
                <p className = 'hidden md:block'> Orders</p>
            </NavLink>

            {/* TODO: add a "Reports" nav item once flagged-listing / flagged-user
                moderation exists (backend: GET /api/admin/reports). Not built yet. */}
        </div>
    </div>
  )
}

export default SideBar
