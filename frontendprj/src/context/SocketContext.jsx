import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { ShopContext } from "./ShopContext";

export const SocketContext = createContext();

// One socket for the whole app, tied to the login token.
//
// It is deliberately thin: it owns the connection lifecycle and nothing else.
// No message state lives here, because messages are not the socket's to keep
// -- they live in MongoDB and are read over REST. This connection is only the
// live channel that saves you from polling.
const SocketProvider = (props) => {
  const { token, backendUrl } = useContext(ShopContext);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Logged out: no socket at all. The server would reject it anyway, since
    // the handshake requires a valid JWT.
    if (!token) {
      setSocket(null);
      setConnected(false);
      return;
    }

    // socket.io-client reconnects on its own with backoff. Reconnection is
    // handled here only as far as tracking the flag; the work of catching up
    // on anything missed belongs to whoever is showing a thread, because only
    // they know which conversation to re-sync. See ChatThread.
    const connection = io(backendUrl, { auth: { token } });

    connection.on("connect", () => setConnected(true));
    connection.on("disconnect", () => setConnected(false));
    connection.on("connect_error", () => setConnected(false));

    setSocket(connection);

    // Logging out or changing identity must not leave the old socket open --
    // it is still authenticated as the previous user.
    return () => {
      connection.close();
      setSocket(null);
      setConnected(false);
    };
  }, [token, backendUrl]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {props.children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;
