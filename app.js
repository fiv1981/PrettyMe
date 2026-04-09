const styles = [
  { id: 'travel', label: 'Viaje icónico', prompt: 'luxury travel portrait in a famous cinematic destination, flattering face, elegant styling, premium lighting' },
  { id: 'studio', label: 'Estudio premium', prompt: 'studio portrait for social profile, ultra flattering beauty lighting, premium editorial look, perfect skin, natural realism' },
  { id: 'beach', label: 'Playa chic', prompt: 'beautiful beach portrait, golden hour, flattering pose, premium fashion vibe, photorealistic' },
  { id: 'executive', label: 'Profesional top', prompt: 'confident professional portrait, linkedin style but glamorous, luxury office background, polished and photorealistic' },
  { id: 'street', label: 'Street fashion', prompt: 'stylish street fashion portrait in a trendy city, flattering angles, premium photography, photorealistic' },
  { id: 'editorial', label: 'Editorial glam', prompt: 'high end editorial beauty portrait, cinematic light, luxury beauty campaign, realistic facial identity preserved' },
  { id: 'cafe', label: 'Café europeo', prompt: 'beautiful portrait in an elegant european cafe terrace, flattering natural pose, premium lifestyle photography' },
  { id: 'night', label: 'Noche exclusiva', prompt: 'night city portrait with luxury vibe, flattering makeup and lighting, premium social media profile image' }
];

const camera = document.getElementById('camera');
const cameraWrap = document.getElementById('cameraWrap');
const capturedImage = document.getElementById('capturedImage');
const galleryInput = document.getElementById('galleryInput');
const captureCanvas = document.getElementById('captureCanvas');
const statusText = document.getElementById('statusText');
const styleGrid = document.getElementById('styleGrid');
const resultsGrid = document.getElementById('resultsGrid');
const extraPrompt = document.getElementById('extraPrompt');
const switchCameraBtn = document.getElementById('switchCameraBtn');
const startCameraBtn = document.getElementById('startCameraBtn');
const uploadBtn = document.getElementById('uploadBtn');
const captureBtn = document.getElementById('captureBtn');
const retakeBtn = document.getElementById('retakeBtn');
const generateBtn = document.getElementById('generateBtn');

let stream;
let facingMode = 'user';
let resultCount = 2;
let capturedDataUrl = '';
const selectedStyles = new Set(['studio', 'travel']);

function setStatus(text, tone = '') {
  statusText.textContent = text;
  statusText.className = `status-text${tone ? ` is-${tone}` : ''}`;
}

function syncCaptureButtons() {
  const hasStream = Boolean(stream);
  const hasCapture = Boolean(capturedDataUrl);
  startCameraBtn.classList.toggle('hidden', hasStream || hasCapture);
  switchCameraBtn.classList.toggle('hidden', !hasStream || hasCapture);
  captureBtn.classList.toggle('hidden', !hasStream || hasCapture);
  retakeBtn.classList.toggle('hidden', !hasCapture);
}

function renderStyles() {
  styleGrid.innerHTML = styles.map((style) => `
    <button class="style-chip ${selectedStyles.has(style.id) ? 'active' : ''}" data-style="${style.id}">${style.label}</button>
  `).join('');
  styleGrid.querySelectorAll('[data-style]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.style;
      if (selectedStyles.has(id)) {
        if (selectedStyles.size > 1) selectedStyles.delete(id);
      } else {
        selectedStyles.add(id);
      }
      renderStyles();
    });
  });
}

document.querySelectorAll('[data-count]').forEach((btn) => {
  btn.addEventListener('click', () => {
    resultCount = Number(btn.dataset.count);
    document.querySelectorAll('[data-count]').forEach((node) => node.classList.toggle('active', node === btn));
  });
});

async function startCamera() {
  cameraWrap.classList.remove('hidden');
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode,
      width: { ideal: 1536 },
      height: { ideal: 1920 }
    },
    audio: false
  });
  camera.srcObject = stream;
  camera.classList.remove('hidden');
  capturedImage.classList.add('hidden');
  setStatus('Cámara lista. Hazte un selfie bonito ✨');
  syncCaptureButtons();
}

function capturePhoto() {
  if (!stream) return;
  const width = camera.videoWidth;
  const height = camera.videoHeight;
  captureCanvas.width = width;
  captureCanvas.height = height;
  const ctx = captureCanvas.getContext('2d');
  ctx.drawImage(camera, 0, 0, width, height);
  capturedDataUrl = captureCanvas.toDataURL('image/jpeg', 0.98);
  capturedImage.src = capturedDataUrl;
  capturedImage.classList.remove('hidden');
  camera.classList.add('hidden');
  setStatus('Selfie capturado. Ya puedes generar resultados.', 'success');
  syncCaptureButtons();
}

function resetCapture() {
  capturedDataUrl = '';
  capturedImage.src = '';
  capturedImage.classList.add('hidden');
  cameraWrap.classList.remove('hidden');
  if (stream) {
    camera.classList.remove('hidden');
    setStatus('Puedes repetir el selfie ahora mismo.');
  } else {
    camera.classList.add('hidden');
    cameraWrap.classList.add('hidden');
    setStatus('Puedes hacerte otro selfie o subir una foto desde la galería.');
  }
  syncCaptureButtons();
}

function loadFromGallery(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    capturedDataUrl = reader.result;
    cameraWrap.classList.remove('hidden');
    camera.classList.add('hidden');
    capturedImage.src = capturedDataUrl;
    capturedImage.classList.remove('hidden');
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    setStatus('Foto cargada desde la galería. Ya puedes generar resultados.', 'success');
    syncCaptureButtons();
  };
  reader.readAsDataURL(file);
}

function buildPrompt(style, extra) {
  return `Use the uploaded selfie as the only identity reference. Preserve identity strongly and keep the face fully recognizable. Make the same person look exceptionally attractive, photogenic and flattering, suitable for a premium profile photo. ${style.prompt}. Preserve bone structure, nose, mouth, eyes and overall identity. Improve beauty in a realistic way: soften wrinkles, blemishes, under-eye darkness, skin texture irregularities and small asymmetries, but do not erase them completely. Keep all features believable and faithful to the real person. Improve harmony, facial symmetry, skin quality, light, posture and styling according to conventional beauty standards while remaining realistic and natural. No plastic skin, no fake face, no age regression to a different person, no changing ethnicity, no changing gender, no extra people, no duplicate face, no distorted hands. High-end photography, flattering retouching, luxurious result, maximum realism. ${extra ? `Extra guidance: ${extra}.` : ''}`;
}

async function generateOne(style, imageBase64, mimeType, extra) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: buildPrompt(style, extra),
      imageBase64,
      mimeType,
      style: style.label
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Error generating image');
  }
  return response.json();
}

function addResultCard({ imageUrl, styleLabel }, index) {
  const card = document.createElement('article');
  card.className = 'result-card';
  card.innerHTML = `
    <img src="${imageUrl}" alt="Resultado ${index + 1}" />
    <strong>${styleLabel}</strong>
    <div class="result-actions">
      <a class="download-btn" href="${imageUrl}" download="prettyme-${index + 1}.png">Descargar</a>
    </div>
  `;
  resultsGrid.appendChild(card);
}

async function generateResults() {
  if (!capturedDataUrl) {
    setStatus('Hazte primero un selfie desde la app.', 'warning');
    return;
  }

  const hadResults = resultsGrid.children.length > 0;
  if (!hadResults) resultsGrid.innerHTML = '';
  setStatus('Generando tus fotos… esto puede tardar un poco.', '');
  generateBtn.disabled = true;

  try {
    const [header, data] = capturedDataUrl.split(',');
    const mimeType = header.match(/data:(.*?);base64/)[1];
    const selected = styles.filter((style) => selectedStyles.has(style.id));
    const queue = Array.from({ length: resultCount }, (_, i) => selected[i % selected.length]);

    for (let i = 0; i < queue.length; i += 1) {
      setStatus(`Generando imagen ${i + 1} de ${queue.length}…`);
      const result = await generateOne(queue[i], data, mimeType, extraPrompt.value.trim());
      addResultCard({ imageUrl: result.imageUrl, styleLabel: queue[i].label }, i);
    }

    setStatus('¡Listo! Ya puedes descargar tus fotos en máxima calidad.', 'success');
  } catch (error) {
    console.error(error);
    const message = String(error.message || 'Error desconocido');
    if (message.includes('RESOURCE_EXHAUSTED') || message.includes('quota') || message.includes('429')) {
      if (!resultsGrid.children.length) resultsGrid.innerHTML = `
        <article class="empty-state">
          <strong>La generación no está disponible ahora mismo</strong>
          <span>La API de imagen ha respondido que no hay cuota disponible en este momento.</span>
          <span>Puedes volver a intentarlo más tarde o cambiar a una clave/proyecto con cuota activa.</span>
        </article>
      `;
      setStatus('La cuota de generación de imagen no está disponible ahora mismo.', 'warning');
    } else {
      if (!resultsGrid.children.length) resultsGrid.innerHTML = `
        <article class="empty-state">
          <strong>No he podido generar las fotos</strong>
          <span>Algo ha fallado al hablar con el motor de imagen.</span>
          <span>Prueba otra vez en un momento.</span>
        </article>
      `;
      setStatus('No he podido generar las fotos ahora mismo.', 'error');
    }
  } finally {
    generateBtn.disabled = false;
  }
}

startCameraBtn.addEventListener('click', startCamera);
switchCameraBtn.addEventListener('click', async () => {
  facingMode = facingMode === 'user' ? 'environment' : 'user';
  await startCamera();
});
uploadBtn.addEventListener('click', () => galleryInput.click());
galleryInput.addEventListener('change', (event) => loadFromGallery(event.target.files?.[0]));
captureBtn.addEventListener('click', capturePhoto);
retakeBtn.addEventListener('click', resetCapture);
generateBtn.addEventListener('click', generateResults);

renderStyles();
syncCaptureButtons();
setStatus('Abre la cámara o sube una foto desde la galería para empezar.');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
