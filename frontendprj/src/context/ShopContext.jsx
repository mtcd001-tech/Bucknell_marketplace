import { createContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import axios from 'axios'

export const ShopContext = createContext();

const ShopContextProvider = (props) => {

    const currency = '$';
    const backendUrl = import.meta.env.VITE_BACKEND_URL.replace(/\/+$/, '')
    const [search, setSearch] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [listings, setListings] = useState([]);
    const [token, setToken] = useState('')
    const navigate = useNavigate();

    const getListingsData = async () => {
        try {

            const response = await axios.get(backendUrl + '/api/product/list')
            if (response.data.success) {
                setListings(response.data.products.reverse())
            } else {
                toast.error(response.data.message)
            }

        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }
    }

    useEffect(() => {
        getListingsData()
    }, [])

    useEffect(() => {
        if (!token && localStorage.getItem('token')) {
            setToken(localStorage.getItem('token'))
        }
    }, [token])

    const value = {
        listings, currency,
        search, setSearch, showSearch, setShowSearch,
        navigate, backendUrl,
        setToken, token
    }

    return (
        <ShopContext.Provider value={value}>
            {props.children}
        </ShopContext.Provider>
    )

}

export default ShopContextProvider;
