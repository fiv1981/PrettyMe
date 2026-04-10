# PrettyMe

PrettyMe genera fotos de perfil muy favorecedoras a partir de un selfie hecho desde la propia app.

## Funciones
- captura selfie desde cámara
- selector de 2, 4 o 6 resultados
- varios estilos premium
- integración con Gemini y soporte para Nano Banana API
- descarga directa de imágenes en máxima resolución
- PWA instalable

## Requisitos
- Node.js 20+
- una API key de Gemini o una API key de Nano Banana

## Variables
Crea `.dev.vars` para Cloudflare Pages local o variables de entorno en Pages:

```bash
GEMINI_API_KEY=tu_api_key
NANO_BANANA_API_KEY=tu_api_key_nanobanana
```

## Desarrollo local
```bash
npm install
npm run dev
```

## Despliegue
Sube el repo a GitHub y conéctalo a Cloudflare Pages.

## Proveedor actual
La app puede trabajar con Gemini o Nano Banana. Ahora mismo el frontend está preparado para usar Nano Banana como proveedor principal en `/api/generate`, usando el endpoint `https://api.nanobananaapi.ai/api/v1/nanobanana/generate` y consultando el estado por `record-info`.

Build command:
```bash
npm install
```

Output directory:
```bash
/
```

Function directory:
```bash
functions
```
