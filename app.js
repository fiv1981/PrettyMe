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
const cameraOverlay = document.getElementById('cameraOverlay');
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
const cropEditor = document.getElementById('cropEditor');
const cropViewport = document.getElementById('cropViewport');
const cropImage = document.getElementById('cropImage');
const cropZoom = document.getElementById('cropZoom');
const applyCropBtn = document.getElementById('applyCropBtn');
const cancelCropBtn = document.getElementById('cancelCropBtn');

let stream;
let facingMode = 'user';
let resultCount = 2;
let photoType = 'full';
let capturedDataUrl = '';
let cropSourceDataUrl = '';
let dragState = null;
const generationProvider = 'nanobanana';
const selectedStyles = new Set(['studio', 'travel']);
const cropState = {
  scale: 1,
  minScale: 1,
  x: 0,
  y: 0,
  naturalWidth: 0,
  naturalHeight: 0,
  viewportWidth: 0,
  viewportHeight: 0
};

function setStatus(text, tone = '') {
  statusText.textContent = text;
  statusText.className = `status-text${tone ? ` is-${tone}` : ''}`;
}

function stopStream() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
}

function syncCaptureButtons() {
  const hasStream = Boolean(stream);
  const hasCapture = Boolean(capturedDataUrl);
  const isCropping = !cropEditor.classList.contains('hidden');
  startCameraBtn.classList.toggle('hidden', hasStream || hasCapture || isCropping);
  switchCameraBtn.classList.toggle('hidden', !hasStream || hasCapture || isCropping);
  captureBtn.classList.toggle('hidden', !hasStream || hasCapture || isCropping);
  retakeBtn.classList.toggle('hidden', !hasCapture || isCropping);
  uploadBtn.classList.toggle('hidden', isCropping);
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

document.querySelectorAll('[data-photo-type]').forEach((btn) => {
  btn.addEventListener('click', () => {
    photoType = btn.dataset.photoType;
    document.querySelectorAll('[data-photo-type]').forEach((node) => node.classList.toggle('active', node === btn));
  });
});

async function startCamera() {
  cropEditor.classList.add('hidden');
  cameraWrap.classList.remove('hidden');
  stopStream();
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
  cameraOverlay.classList.remove('hidden');
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
  cameraOverlay.classList.add('hidden');
  cropEditor.classList.add('hidden');
  setStatus('Selfie capturado. Ya puedes generar resultados.', 'success');
  syncCaptureButtons();
}

function resetCapture() {
  capturedDataUrl = '';
  cropSourceDataUrl = '';
  capturedImage.src = '';
  capturedImage.classList.add('hidden');
  cropImage.src = '';
  cropEditor.classList.add('hidden');
  cropZoom.value = '1';
  cameraWrap.classList.remove('hidden');
  if (stream) {
    camera.classList.remove('hidden');
    cameraOverlay.classList.remove('hidden');
    setStatus('Puedes repetir el selfie ahora mismo.');
  } else {
    camera.classList.add('hidden');
    cameraOverlay.classList.add('hidden');
    cameraWrap.classList.add('hidden');
    setStatus('Puedes hacerte otro selfie o subir una foto desde la galería.');
  }
  syncCaptureButtons();
}

function updateCropImage() {
  cropImage.style.width = `${cropState.naturalWidth * cropState.scale}px`;
  cropImage.style.height = `${cropState.naturalHeight * cropState.scale}px`;
  cropImage.style.transform = `translate(${cropState.x}px, ${cropState.y}px)`;
}

function clampCropPosition() {
  const scaledWidth = cropState.naturalWidth * cropState.scale;
  const scaledHeight = cropState.naturalHeight * cropState.scale;
  const minX = Math.min(0, cropState.viewportWidth - scaledWidth);
  const minY = Math.min(0, cropState.viewportHeight - scaledHeight);
  cropState.x = Math.min(0, Math.max(minX, cropState.x));
  cropState.y = Math.min(0, Math.max(minY, cropState.y));
}

function setupCropper() {
  cropState.viewportWidth = cropViewport.clientWidth;
  cropState.viewportHeight = cropViewport.clientHeight;
  cropState.naturalWidth = cropImage.naturalWidth;
  cropState.naturalHeight = cropImage.naturalHeight;
  cropState.minScale = Math.max(
    cropState.viewportWidth / cropState.naturalWidth,
    cropState.viewportHeight / cropState.naturalHeight
  );
  cropState.scale = cropState.minScale;
  cropZoom.value = '1';
  const scaledWidth = cropState.naturalWidth * cropState.scale;
  const scaledHeight = cropState.naturalHeight * cropState.scale;
  cropState.x = (cropState.viewportWidth - scaledWidth) / 2;
  cropState.y = (cropState.viewportHeight - scaledHeight) / 2;
  clampCropPosition();
  updateCropImage();
}

function openCropEditor(dataUrl) {
  cropSourceDataUrl = dataUrl;
  capturedDataUrl = '';
  cameraWrap.classList.add('hidden');
  cropEditor.classList.remove('hidden');
  capturedImage.classList.add('hidden');
  camera.classList.add('hidden');
  cameraOverlay.classList.add('hidden');
  stopStream();
  cropImage.onload = () => {
    setupCropper();
    setStatus('Ajusta el encuadre de la foto y pulsa “Usar recorte”.');
    syncCaptureButtons();
  };
  cropImage.src = dataUrl;
}

function applyCrop() {
  if (!cropImage.src) return;
  const outputWidth = 1200;
  const outputHeight = 1500;
  captureCanvas.width = outputWidth;
  captureCanvas.height = outputHeight;
  const ctx = captureCanvas.getContext('2d');
  const sx = -cropState.x / cropState.scale;
  const sy = -cropState.y / cropState.scale;
  const sw = cropState.viewportWidth / cropState.scale;
  const sh = cropState.viewportHeight / cropState.scale;
  ctx.drawImage(cropImage, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);
  capturedDataUrl = captureCanvas.toDataURL('image/jpeg', 0.95);
  cropEditor.classList.add('hidden');
  cameraWrap.classList.remove('hidden');
  capturedImage.src = capturedDataUrl;
  capturedImage.classList.remove('hidden');
  setStatus('Foto recortada y lista para generar resultados.', 'success');
  syncCaptureButtons();
}

function loadFromGallery(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    openCropEditor(reader.result);
  };
  reader.readAsDataURL(file);
}

function buildPrompt(style, extra) {
  const framing = photoType === 'portrait'
    ? 'Use a bust or close portrait framing, suitable for a profile picture.'
    : 'Prefer full-body or at least three-quarter body framing, unless impossible.';
  return `Use the uploaded selfie only as an identity reference for the person. Do not preserve the original clothes, background, room, furniture, lighting or framing from the source image. Recreate the full image from scratch so everything matches the selected scenario perfectly. ${style.prompt}. ${framing} The result must show the same person, fully recognizable, but in a much more beautiful, flattering and polished way. Beauty and perfection are the highest priority. Make the person look realistically 5 to 10 years younger, while remaining clearly the same real person. Reduce or remove wrinkles, expression lines, skin marks, blemishes, dark circles, pores, uneven texture, dullness, gray hair and visible signs of aging. Skin should look smooth, luminous and healthy, but still realistic. Teeth should look clean, aligned and naturally white when smiling. Hair should look professionally styled, glossy and salon-quality. Improve facial harmony, symmetry, posture and overall attractiveness according to conventional beauty standards, while staying believable and photographic. Preserve identity, face structure and recognizability, but rebuild wardrobe, styling, background and composition to fit the chosen environment naturally. Absolutely no text, letters, logos, brands, watermarks, captions, signs, labels or graphic overlays anywhere in the image unless the user explicitly asks for them in extra details. No old-looking result, no extra people, no duplicate face, no distorted anatomy, no leftover elements from the source selfie. ${extra ? `Extra guidance: ${extra}.` : ''}`;
}

async function generateOne(style, imageBase64, mimeType, extra) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: buildPrompt(style, extra),
      imageBase64,
      mimeType,
      imageDataUrl: capturedDataUrl,
      style: style.label,
      provider: generationProvider
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
  setStatus('Generando tus fotos con Nano Banana… esto puede tardar un poco.', '');
  generateBtn.disabled = true;

  try {
    const [header, data] = capturedDataUrl.split(',');
    const mimeType = header.match(/data:(.*?);base64/)[1];
    const selected = styles.filter((style) => selectedStyles.has(style.id));
    const queue = Array.from({ length: resultCount }, (_, i) => selected[i % selected.length]);

    for (let i = 0; i < queue.length; i += 1) {
      setStatus(`⏳ Generando imagen ${i + 1} de ${queue.length}…`);
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
      setStatus('La cuota o el servicio de generación no está disponible ahora mismo.', 'warning');
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

cropZoom.addEventListener('input', () => {
  const zoomFactor = Number(cropZoom.value);
  cropState.scale = cropState.minScale * zoomFactor;
  clampCropPosition();
  updateCropImage();
});

function getPoint(event) {
  if (event.touches?.[0]) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  return { x: event.clientX, y: event.clientY };
}

function startDrag(event) {
  if (cropEditor.classList.contains('hidden')) return;
  const point = getPoint(event);
  dragState = {
    startX: point.x,
    startY: point.y,
    originX: cropState.x,
    originY: cropState.y
  };
}

function moveDrag(event) {
  if (!dragState) return;
  event.preventDefault();
  const point = getPoint(event);
  cropState.x = dragState.originX + (point.x - dragState.startX);
  cropState.y = dragState.originY + (point.y - dragState.startY);
  clampCropPosition();
  updateCropImage();
}

function endDrag() {
  dragState = null;
}

cropViewport.addEventListener('pointerdown', startDrag);
window.addEventListener('pointermove', moveDrag);
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
applyCropBtn.addEventListener('click', applyCrop);
cancelCropBtn.addEventListener('click', () => {
  cropEditor.classList.add('hidden');
  cropImage.src = '';
  cropSourceDataUrl = '';
  cameraWrap.classList.add('hidden');
  setStatus('Carga otra foto desde la galería o usa la cámara.');
  syncCaptureButtons();
});

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
