const KEYS_URL = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys';

export async function onRequestGet(context) {
  try {
    const start = Date.now();
    const resp = await fetch(KEYS_URL);
    const elapsed = Date.now() - start;
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `HTTP ${resp.status}`, elapsed }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
    const data = await resp.json();
    return new Response(JSON.stringify({
      ok: true,
      keyCount: Object.keys(data).length,
      elapsed,
      keyIds: Object.keys(data)
    }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, stack: e.stack?.slice(0, 300) }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}