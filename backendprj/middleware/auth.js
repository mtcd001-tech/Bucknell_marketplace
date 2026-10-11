import jwt from 'jsonwebtoken';

const authUser = async (req, res, next) => {

    const { token } = req.headers;

    if (!token) {
        return res.json({ success: false, message: "Not Authorized Login Again" });
}
    try {
        const token_decode = jwt.verify(token, process.env.JWT_SECRET);
        // express.json() only sets req.body when the request actually sends a
        // JSON body -- a GET with no body leaves req.body undefined, and
        // writing .userId onto it would throw before next() ever runs.
        req.body = req.body || {};
        req.body.userId = token_decode.id;
        next()
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

export default authUser;