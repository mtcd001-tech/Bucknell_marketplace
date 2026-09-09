// Reads the user id out of the JWT payload.
//
// DISPLAY ONLY. This decides which side of the thread a bubble sits on and
// nothing else. It is not a security check and must never become one: the
// payload is base64, not encrypted, so anyone can edit it. Every actual
// authorization decision happens server-side, where the signature is verified.
export const currentUserId = (token) => {
  try {
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload?.id || null;
  } catch {
    return null;
  }
};
