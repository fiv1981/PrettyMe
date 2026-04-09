# PrettyMe

PrettyMe genera fotos de perfil muy favorecedoras a partir de un selfie hecho desde la propia app.

## Funciones
- captura selfie desde cámara
- selector de 2, 4 o 6 resultados
- varios estilos premium
- integración con Gemini / Nano Banana style image generation
- descarga directa de imágenes en máxima resolución
- PWA instalable

## Requisitos
- Node.js 20+
- una API key de Gemini con generación de imagen habilitada

## Variables
Crea `.dev.vars` para Cloudflare Pages local o variables de entorno en Pages:

```bash
GEMINI_API_KEY=tu_api_key
```

## Desarrollo local
```bash
npm install
npm run dev
```

## Despliegue
Sube el repo a GitHub y conéctalo a Cloudflare Pages.

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
