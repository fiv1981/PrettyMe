import { verifyFirebaseToken } from '../../_shared/verify-token.js';

export async function onRequestGet(context) {
  try {
    const FIREBASE_PROJECT_ID = context.env.FIREBASE_PROJECT_ID || '';
    const authHeader = context.request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token || !FIREBASE_PROJECT_ID) {
      return new Response('Authentication required', { status: 401 });
    }

    const decoded = await verifyFirebaseToken(token, FIREBASE_PROJECT_ID);
    if (!decoded) {
      return new Response('Invalid token', { status: 401 });
    }

    // Extract key from URL path after /api/images/
    const url = new URL(context.request.url);
    const key = url.pathname.replace(/^\/api\/images\/?/, '');

    if (!key) {
      return new Response('Missing image key', { status: 400 });
    }

    // Authorization: key must start with the authenticated user's uid
    if (!key.startsWith(`${decoded.uid}/`)) {
      return new Response('Forbidden', { status: 403 });
    }

    if (!context.env.IMAGES) {
      return new Response('Storage not configured', { status: 500 });
    }

    const object = await context.env.IMAGES.get(key);
    if (!object) {
      return new Response('Not found', { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000');
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(object.body, { headers });
  } catch (error) {
    return new Response(error.message || 'Image fetch failed', { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}