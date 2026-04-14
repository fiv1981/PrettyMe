/**
 * Verify a Firebase ID token using Google's public X.509 keys.
 * Works in Cloudflare Workers/Pages Functions (no Node.js deps).
 */
const KEYS_URL = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys';
const KEY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

let cachedKeys = null;
let cachedKeysAt = 0;

async function fetchPublicKeys() {
  if (cachedKeys && (Date.now() - cachedKeysAt) < KEY_CACHE_TTL) return cachedKeys;
  try {
    const resp = await fetch(KEYS_URL);
    if (!resp.ok) throw new Error(`Failed to fetch Firebase public keys: HTTP ${resp.status}`);
    cachedKeys = await resp.json();
    cachedKeysAt = Date.now();
    return cachedKeys;
  } catch (e) {
    // If we have stale cached keys, use them as fallback
    if (cachedKeys) return cachedKeys;
    throw e;
  }
}

function base64UrlToUint8Array(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 2 ? '==' : b64.length % 4 === 3 ? '=' : '';
  const binary = atob(b64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJwtHeader(token) {
  const part = token.split('.')[0];
  return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
}

function decodeJwtPayload(token) {
  const part = token.split('.')[1];
  return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
}

async function verifySignature(token, pemKey) {
  const [b64header, b64payload, b64signature] = token.split('.');
  const signature = base64UrlToUint8Array(b64signature);
  const data = new TextEncoder().encode(`${b64header}.${b64payload}`);

  // Parse PEM to ArrayBuffer
  const pemBody = pemKey.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const binary = atob(pemBody);
  const keyBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) keyBytes[i] = binary.charCodeAt(i);

  const key = await crypto.subtle.importKey(
    'spki',
    keyBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature.buffer, data);
}

export async function verifyFirebaseToken(token, projectId) {
  if (!token) return { uid: null, debug: 'no token' };

  try {
    const header = decodeJwtHeader(token);
    const payload = decodeJwtPayload(token);
    const keys = await fetchPublicKeys();
    const pem = keys[header.kid];
    if (!pem) return { uid: null, debug: `no matching key for kid=${header.kid}, available=${Object.keys(keys).join(',')}` };

    const valid = await verifySignature(token, pem);
    if (!valid) return { uid: null, debug: 'signature verification failed' };

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return { uid: null, debug: `token expired (exp=${payload.exp}, now=${now})` };
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return { uid: null, debug: `iss mismatch: got=${payload.iss}, expected=https://securetoken.google.com/${projectId}` };
    if (payload.aud !== projectId) return { uid: null, debug: `aud mismatch: got=${payload.aud}, expected=${projectId}` };

    return { uid: payload.sub, email: payload.email || null };
  } catch (e) {
    return { uid: null, debug: `verify error: ${e.message}`, stack: e.stack?.slice(0, 200) };
  }
}