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

const NANO_BANANA_BASE_URL = 'https://api.nanobananaapi.ai/api/v1/nanobanana';

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

async function uploadInputImage(imageBase64, mimeType) {
  const response = await fetch(`data:${mimeType};base64,${imageBase64}`);
  const blob = await response.blob();
  const formData = new FormData();
  formData.append('file', blob, `prettyme-input.${mimeType.split('/')[1] || 'jpg'}`);

  const uploadResponse = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST',
    body: formData
  });

  const uploadData = await uploadResponse.json();
  const fileUrl = uploadData?.data?.url;
  if (!uploadResponse.ok || !fileUrl) {
    throw new Error('No he podido preparar la imagen para Nano Banana.');
  }

  return fileUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
}

async function pollNanoBananaTask(taskId, apiKey) {
  const maxAttempts = 40;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(`${NANO_BANANA_BASE_URL}/record-info?taskId=${encodeURIComponent(taskId)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.msg || 'Nano Banana no ha devuelto el estado de la tarea.');
    }

    const payload = data?.data || data;
    const successFlag = payload?.successFlag;

    if (successFlag === 1) {
      const imageUrl = payload?.response?.resultImageUrl || payload?.response?.originImageUrl;
      if (!imageUrl) {
        throw new Error('Nano Banana terminó la tarea pero no devolvió imagen.');
      }
      return imageUrl;
    }

    if (successFlag === 2 || successFlag === 3) {
      throw new Error(payload?.errorMessage || 'Nano Banana no pudo generar la imagen.');
    }

    await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  throw new Error('Nano Banana está tardando demasiado en generar la imagen.');
}

async function generateWithNanoBanana({ apiKey, prompt, imageBase64, mimeType }) {
  const imageUrl = await uploadInputImage(imageBase64, mimeType);

  const createResponse = await fetch(`${NANO_BANANA_BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      type: 'IMAGETOIAMGE',
      numImages: 1,
      image_size: '4:5',
      imageUrls: [imageUrl],
      callBackUrl: 'https://example.com/nanobanana-callback'
    })
  });

  const createData = await createResponse.json();
  if (!createResponse.ok || createData?.code !== 200 || !createData?.data?.taskId) {
    throw new Error(createData?.msg || 'Nano Banana no ha aceptado la tarea.');
  }

  return pollNanoBananaTask(createData.data.taskId, apiKey);
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
    const NANO_BANANA_API_KEY = context.env.NANO_BANANA_API_KEY || '';
    const GEMINI_API_KEY = context.env.GEMINI_API_KEY || context.env.GOOGLE_API_KEY || '';

    const { prompt, imageBase64, mimeType, style, provider, imageDataUrl } = await context.request.json();
    const imageParts = imageBase64 && mimeType ? { imageBase64, mimeType } : dataUrlToParts(imageDataUrl);

    if (!prompt || !imageParts?.imageBase64 || !imageParts?.mimeType) {
      return json({ error: 'Missing prompt or image' }, 400);
    }

    const requestedProvider = provider === 'nanobanana' ? 'nanobanana' : 'gemini';

    if (requestedProvider === 'nanobanana') {
      if (!NANO_BANANA_API_KEY) {
        return json({ error: 'Missing NANO_BANANA_API_KEY' }, 500);
      }

      const imageUrl = await generateWithNanoBanana({
        apiKey: NANO_BANANA_API_KEY,
        prompt,
        imageBase64: imageParts.imageBase64,
        mimeType: imageParts.mimeType
      });

      return json({ imageUrl, provider: 'nanobanana' });
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

    return json({ imageUrl, provider: 'gemini' });
  } catch (error) {
    return json({ error: error.message || 'Generation failed' }, 500);
  }
}
