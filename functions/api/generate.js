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

function dataUrlToParts(dataUrl) {
  const match = /^data:(.*?);base64,(.*)$/.exec(dataUrl || '');
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
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

export async function onRequestPost(context) {
  try {
    const GEMINI_API_KEY = context.env.GEMINI_API_KEY || context.env.GOOGLE_API_KEY || '';

    const { prompt, imageBase64, mimeType, style, imageDataUrl } = await context.request.json();
    const imageParts = imageBase64 && mimeType ? { imageBase64, mimeType } : dataUrlToParts(imageDataUrl);

    if (!prompt || !imageParts?.imageBase64 || !imageParts?.mimeType) {
      return json({ error: 'Missing prompt or image' }, 400);
    }

    if (!GEMINI_API_KEY) {
      return json({ error: 'Missing GEMINI_API_KEY' }, 500);
    }

    const imageUrl = await generateWithGemini({
      apiKey: GEMINI_API_KEY,
      prompt,
      imageBase64: imageParts.imageBase64,
      mimeType: imageParts.mimeType,
      style
    });

    return json({ imageUrl, provider: 'gemini-2.5-flash-image' });
  } catch (error) {
    return json({ error: error.message || 'Generation failed' }, 500);
  }
}
