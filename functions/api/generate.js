export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
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

export async function onRequestPost(context) {
  try {
    const GEMINI_API_KEY = context.env.GEMINI_API_KEY || context.env.GOOGLE_API_KEY || '';
    if (!GEMINI_API_KEY) {
      return json({ error: 'Missing GEMINI_API_KEY' }, 500);
    }

    const { prompt, imageBase64, mimeType, style } = await context.request.json();
    if (!prompt || !imageBase64 || !mimeType) {
      return json({ error: 'Missing prompt or image' }, 400);
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
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
      return json({ error: data?.error?.message || 'Gemini request failed', details: data }, 502);
    }

    for (const part of data?.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        return json({ imageUrl: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}` });
      }
    }

    return json({ error: 'No image returned by Gemini', details: data }, 502);
  } catch (error) {
    return json({ error: error.message || 'Generation failed' }, 500);
  }
}
