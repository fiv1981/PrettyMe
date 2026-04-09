import { GoogleGenAI, Modality } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export async function onRequestPost(context) {
  try {
    if (!GEMINI_API_KEY) {
      return json({ error: 'Missing GEMINI_API_KEY' }, 500);
    }

    const { prompt, imageBase64, mimeType, style } = await context.request.json();
    if (!prompt || !imageBase64 || !mimeType) {
      return json({ error: 'Missing prompt or image' }, 400);
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${prompt}\n\nReturn one single high quality profile-style image. Style label: ${style || 'profile portrait'}.` },
            {
              inlineData: {
                mimeType,
                data: imageBase64
              }
            }
          ]
        }
      ],
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT]
      }
    });

    for (const part of response?.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        return json({ imageUrl: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}` });
      }
    }

    return json({ error: 'No image returned by Gemini' }, 502);
  } catch (error) {
    return json({ error: error.message || 'Generation failed' }, 500);
  }
}
