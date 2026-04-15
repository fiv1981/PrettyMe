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
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

export async function onRequestDelete(context) {
  try {
    const FIREBASE_PROJECT_ID = context.env.FIREBASE_PROJECT_ID || '';
    const authHeader = context.request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token || !FIREBASE_PROJECT_ID) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }

    const decoded = await verifyFirebaseToken(token, FIREBASE_PROJECT_ID);
    if (!decoded) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }

    const url = new URL(context.request.url);
    const key = url.pathname.replace(/^\/api\/images\/?/, '');

    if (!key) {
      return new Response(JSON.stringify({ error: 'Missing image key' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }

    if (!key.startsWith(`${decoded.uid}/`)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } });
    }

    // Delete from R2
    if (context.env.IMAGES) {
      await context.env.IMAGES.delete(key);
    }

    // Delete from D1
    if (context.env.DB) {
      await context.env.DB.prepare('DELETE FROM images WHERE uid = ? AND r2_key = ?').bind(decoded.uid, key).run();
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Delete failed' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}