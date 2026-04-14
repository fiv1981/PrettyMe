import { verifyFirebaseToken } from '../_shared/verify-token.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export async function onRequestGet(context) {
  try {
    const FIREBASE_PROJECT_ID = context.env.FIREBASE_PROJECT_ID || '';
    const authHeader = context.request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token || !FIREBASE_PROJECT_ID) {
      return json({ error: 'Authentication required', debug: { hasToken: Boolean(token), hasProjectId: Boolean(FIREBASE_PROJECT_ID), projectId: FIREBASE_PROJECT_ID || '(empty)' } }, 401);
    }

    const decoded = await verifyFirebaseToken(token, FIREBASE_PROJECT_ID);
    if (!decoded) {
      return json({ error: 'Invalid token', debug: { projectId: FIREBASE_PROJECT_ID, tokenPrefix: token?.slice(0, 20) + '...' } }, 401);
    }

    const uid = decoded.uid;
    const url = new URL(context.request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '20'), 1), 50);
    const offset = Math.max(Number(url.searchParams.get('offset') || '0'), 0);

    // Upsert user
    if (context.env.DB) {
      await context.env.DB.prepare(
        `INSERT INTO users (uid, email, display_name, photo_url, provider, last_login)
         VALUES (?, ?, ?, ?, ?, unixepoch())
         ON CONFLICT(uid) DO UPDATE SET last_login = unixepoch()`
      ).bind(uid, decoded.email || '', '', '', '').run();
    }

    if (!context.env.DB) {
      return json({ images: [], hasMore: false });
    }

    const results = await context.env.DB.prepare(
      'SELECT r2_key, style, orientation, photo_type, created_at FROM images WHERE uid = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(uid, limit, offset).all();

    const total = await context.env.DB.prepare(
      'SELECT COUNT(*) as count FROM images WHERE uid = ?'
    ).bind(uid).first();

    const images = (results.results || []).map((row) => ({
      r2Key: row.r2_key,
      url: `/api/images/${row.r2_key}`,
      style: row.style,
      orientation: row.orientation,
      photoType: row.photo_type,
      createdAt: row.created_at
    }));

    return json({
      images,
      hasMore: offset + limit < (total?.count || 0)
    });
  } catch (error) {
    return json({ error: error.message || 'Gallery fetch failed' }, 500);
  }
}