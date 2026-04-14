/**
 * Verify a Firebase ID token using Google's JWKS endpoint.
 * Works in Cloudflare Workers/Pages Functions (no Node.js deps).
 */
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const KEY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

let cachedKeys = null;
let cachedKeysAt = 0;

async function fetchJWKS() {
  if (cachedKeys && (Date.now() - cachedKeysAt) < KEY_CACHE_TTL) return cachedKeys;
  const resp = await fetch(JWKS_URL);
  if (!resp.ok) throw new Error(`Failed to fetch JWKS: HTTP ${resp.status}`);
  const data = await resp.json();
  cachedKeys = data.keys;
  cachedKeysAt = Date.now();
  return cachedKeys;
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

async function importJwkKey(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

export async function verifyFirebaseToken(token, projectId) {
  if (!token) return null;

  try {
    const header = decodeJwtHeader(token);
    const payload = decodeJwtPayload(token);
    const keys = await fetchJWKS();
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;

    const key = await importJwkKey(jwk);
    const [b64header, b64payload, b64signature] = token.split('.');
    const signature = base64UrlToUint8Array(b64signature);
    const data = new TextEncoder().encode(`${b64header}.${b64payload}`);

    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
    if (!valid) return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (payload.aud !== projectId) return null;

    return { uid: payload.sub, email: payload.email || null };
  } catch {
    return null;
  }
}