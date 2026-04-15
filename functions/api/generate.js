import { verifyFirebaseToken } from '../_shared/verify-token.js';

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function dataUrlToParts(dataUrl) {
  const match = /^data:(.*?);base64,(.*)$/.exec(dataUrl || '');
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

function base64ToUint8Array(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function generateWithGemini({ apiKey, prompt, imageBase64, mimeType, style }) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${prompt}\n\nReturn one single high quality profile-style image. Style label: ${style || 'profile portrait'}.`
            },
            {
              inlineData: {
                mimeType,
                data: imageBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Gemini request failed');
  }

  for (const part of data?.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData?.data) {
      return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
  }

  throw new Error('No image returned by Gemini');
}

async function generateWithQwen({ apiKey, prompt, imageBase64, mimeType }) {
  const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;

  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'qwen-image-edit',
      input: {
        messages: [
          {
            role: 'user',
            content: [
              { image: imageDataUrl },
              { text: prompt }
            ]
          }
        ]
      },
      parameters: {
        n: 1,
        watermark: false
      }
    })
  });

  const data = await response.json();
  if (!response.ok || data.code) {
    throw new Error(data?.message || data?.code || 'Qwen request failed');
  }

  const images = data?.output?.choices?.[0]?.message?.content || [];
  const imageUrl = images.find(c => c.image)?.image;
  if (!imageUrl) throw new Error('No image returned by Qwen');

  // Qwen returns expiring URLs — fetch and convert to data URL
  const imgResp = await fetch(imageUrl);
  if (!imgResp.ok) throw new Error('Failed to download Qwen image');
  const imgBlob = await imgResp.blob();
  const arrayBuf = await imgBlob.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
  return `data:${imgBlob.type || 'image/png'};base64,${b64}`;
}

async function persistImage({ env, uid, dataUrl, style, orientation, photoType }) {
  if (!env.IMAGES || !env.DB) return null;

  try {
    const parts = dataUrlToParts(dataUrl);
    if (!parts) return null;

    const isPng = parts.mimeType === 'image/png';
    const ext = isPng ? 'png' : 'jpg';
    const contentType = isPng ? 'image/png' : 'image/jpeg';
    const imageBytes = base64ToUint8Array(parts.base64);

    const r2Key = `${uid}/${crypto.randomUUID()}.${ext}`;

    await env.IMAGES.put(r2Key, imageBytes, {
      httpMetadata: { contentType, cacheControl: 'public, max-age=31536000' },
      customMetadata: { uid, style: style || '' }
    });

    await env.DB.prepare(
      'INSERT INTO images (uid, r2_key, style, orientation, photo_type) VALUES (?, ?, ?, ?, ?)'
    ).bind(uid, r2Key, style || null, orientation || null, photoType || null).run();

    // Upsert user
    await env.DB.prepare(
      `INSERT INTO users (uid, email, last_login) VALUES (?, ?, unixepoch())
       ON CONFLICT(uid) DO UPDATE SET last_login = unixepoch()`
    ).bind(uid, '').run();

    return r2Key;
  } catch (err) {
    console.error('R2/D1 persist error:', err);
    return null;
  }
}

export async function onRequestPost(context) {
  try {
    const GEMINI_API_KEY = context.env.GEMINI_API_KEY || context.env.GOOGLE_API_KEY || '';
    const FIREBASE_PROJECT_ID = context.env.FIREBASE_PROJECT_ID || '';

    // Optional auth
    let uid = null;
    const authHeader = context.request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token && FIREBASE_PROJECT_ID) {
      const decoded = await verifyFirebaseToken(token, FIREBASE_PROJECT_ID);
      if (decoded) uid = decoded.uid;
    }

    const { prompt, imageBase64, mimeType, style, imageDataUrl, orientation, photoType, provider } = await context.request.json();
    const imageParts = imageBase64 && mimeType ? { imageBase64, mimeType } : dataUrlToParts(imageDataUrl);

    if (!prompt || !imageParts?.imageBase64 || !imageParts?.mimeType) {
      return json({ error: 'Missing prompt or image' }, 400);
    }

    const DASHSCOPE_API_KEY = context.env.DASHSCOPE_API_KEY || '';
    const useQwen = provider === 'qwen' && DASHSCOPE_API_KEY;

    let imageUrl;
    let providerName;

    if (useQwen) {
      imageUrl = await generateWithQwen({
        apiKey: DASHSCOPE_API_KEY,
        prompt,
        imageBase64: imageParts.imageBase64,
        mimeType: imageParts.mimeType
      });
      providerName = 'qwen-image-edit';
    } else {
      if (!GEMINI_API_KEY) {
        return json({ error: 'Missing GEMINI_API_KEY' }, 500);
      }
      imageUrl = await generateWithGemini({
        apiKey: GEMINI_API_KEY,
        prompt,
        imageBase64: imageParts.imageBase64,
        mimeType: imageParts.mimeType,
        style
      });
      providerName = 'gemini-2.5-flash-image';
    }

    // Persist if authenticated
    let r2Key = null;
    if (uid) {
      r2Key = await persistImage({ env: context.env, uid, dataUrl: imageUrl, style, orientation, photoType });
      if (!r2Key) {
        console.warn('persistImage returned null — R2 or D1 binding may be missing');
      }
    } else {
      console.warn('No uid — image will not be saved to gallery. Check FIREBASE_PROJECT_ID env var.');
    }

    const response = { imageUrl, provider: providerName };
    if (r2Key) response.r2Key = r2Key;
    return json(response);
  } catch (error) {
    return json({ error: error.message || 'Generation failed' }, 500);
  }
}