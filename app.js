const styles = [
  { id: 'travel', label: 'Viaje icónico', emoji: '✈️', prompt: 'luxury travel portrait in a famous cinematic destination, flattering face, elegant styling, premium lighting', wardrobe: 'Use casual stylish clothing by default, elegant but relaxed, adapted naturally to the travel destination and weather, unless the user asks for something else in extra details.' },
  { id: 'studio', label: 'Estudio premium', emoji: '📸', prompt: 'studio portrait for social profile, ultra flattering beauty lighting, premium editorial look, perfect skin, natural realism', wardrobe: 'Use casual flattering clothing by default, modern and polished but not formal, unless the user asks for something else in extra details.' },
  { id: 'beach', label: 'Playa chic', emoji: '🏖️', prompt: 'beautiful beach portrait, golden hour, flattering pose, premium fashion vibe, photorealistic', wardrobe: 'Use beach-appropriate clothing by default, such as tasteful swimwear, bikini, swimsuit, linen clothing, pareo, beach dress or elegant beachwear, always matching the seaside scene naturally, unless the user asks for something else in extra details.' },
  { id: 'executive', label: 'Profesional top', emoji: '💼', prompt: 'confident professional portrait, linkedin style but glamorous, luxury office background, polished and photorealistic', wardrobe: 'Use a professional polished look by default, suitable for a top executive portrait, unless the user asks for something else in extra details.' },
  { id: 'street', label: 'Street fashion', emoji: '🏙️', prompt: 'stylish street fashion portrait in a trendy city, flattering angles, premium photography, photorealistic', wardrobe: 'Use casual street-style clothing by default, fashionable and natural, matching the urban scene, unless the user asks for something else in extra details.' },
  { id: 'editorial', label: 'Editorial glam', emoji: '✨', prompt: 'high end editorial beauty portrait, cinematic light, luxury beauty campaign, realistic facial identity preserved', wardrobe: 'Use casual but very flattering editorial styling by default, sophisticated without looking formal officewear, unless the user asks for something else in extra details.' },
  { id: 'cafe', label: 'Café europeo', emoji: '☕', prompt: 'beautiful portrait in an elegant european cafe terrace, flattering natural pose, premium lifestyle photography', wardrobe: 'Use casual chic clothing by default, natural, attractive and appropriate for an elegant European café terrace, unless the user asks for something else in extra details.' },
  { id: 'night', label: 'Noche exclusiva', emoji: '🌃', prompt: 'night city portrait with luxury vibe, flattering makeup and lighting, premium social media profile image', wardrobe: 'Use casual night-out clothing by default, attractive and scene-appropriate, more social than formal, unless the user asks for something else in extra details.' }
];

const camera = document.getElementById('camera');
const cameraWrap = document.getElementById('cameraWrap');
const cameraOverlay = document.getElementById('cameraOverlay');
const capturedImage = document.getElementById('capturedImage');
const cameraPlaceholder = document.getElementById('cameraPlaceholder');
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
const nextStep1Btn = document.getElementById('nextStep1Btn');
const backStep2Btn = document.getElementById('backStep2Btn');
const forwardStep2Btn = document.getElementById('forwardStep2Btn');
const restartBtn = document.getElementById('restartBtn');
const regenerateBtn = document.getElementById('regenerateBtn');
const cropEditor = document.getElementById('cropEditor');
const cropViewport = document.getElementById('cropViewport');
const cropImage = document.getElementById('cropImage');
const cropZoom = document.getElementById('cropZoom');
const rotateCropBtn = document.getElementById('rotateCropBtn');
const applyCropBtn = document.getElementById('applyCropBtn');
const cancelCropBtn = document.getElementById('cancelCropBtn');
const lightbox = document.getElementById('lightbox');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxDownload = document.getElementById('lightboxDownload');

let stream;
let facingMode = 'user';
let currentStep = 1;
let resultCount = 2;
let photoType = 'full';
let orientation = 'vertical';
let capturedDataUrl = '';
let cropSourceDataUrl = '';
let dragState = null;
let pinchState = null;
const generationProvider = 'gemini';
const selectedStyles = new Set(['studio', 'travel']);
const cropState = {
  scale: 1,
  minScale: 1,
  x: 0,
  y: 0,
  imageWidth: 0,
  imageHeight: 0,
  baseWidth: 0,
  baseHeight: 0,
  viewportWidth: 0,
  viewportHeight: 0,
  rotation: 0
};

/* ===== Wizard navigation ===== */
function goToStep(step) {
  currentStep = step;
  document.querySelectorAll('.step').forEach((el) => {
    el.classList.toggle('active', Number(el.dataset.step) === step);
  });
  document.querySelectorAll('.dot').forEach((el) => {
    const dotStep = Number(el.dataset.dot);
    el.classList.toggle('active', dotStep === step);
    el.classList.toggle('completed', dotStep < step);
  });
  forwardStep2Btn.classList.toggle('hidden', step !== 2 || resultsGrid.children.length === 0);
}

nextStep1Btn.addEventListener('click', () => {
  if (capturedDataUrl) goToStep(2);
});

backStep2Btn.addEventListener('click', () => goToStep(1));
forwardStep2Btn.addEventListener('click', () => {
  if (resultsGrid.children.length > 0) goToStep(3);
});

restartBtn.addEventListener('click', () => {
  resultsGrid.innerHTML = '';
  goToStep(1);
});

regenerateBtn.addEventListener('click', () => {
  goToStep(2);
});

/* ===== Lightbox ===== */
function openLightbox(imageUrl) {
  lightboxImage.src = imageUrl;
  lightboxDownload.href = imageUrl;
  lightbox.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.add('hidden');
  lightboxImage.src = '';
  document.body.style.overflow = '';
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});

/* ===== Status ===== */
function setStatus(text, tone = '') {
  statusText.textContent = text;
  statusText.className = `status-text${tone ? ` is-${tone}` : ''}`;
}

/* ===== Camera ===== */
function stopStream() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
}

function updateCameraMirror() {
  camera.classList.toggle('is-mirrored', facingMode === 'user');
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
  nextStep1Btn.disabled = !hasCapture;
  cameraPlaceholder.classList.toggle('hidden', hasStream || hasCapture);
  cameraWrap.classList.toggle('hidden', isCropping);
  if (hasStream || hasCapture) {
    cameraWrap.classList.remove('camera-wrap--compact');
  }
}

function renderStyles() {
  styleGrid.innerHTML = styles.map((style) => `
    <button class="style-chip ${selectedStyles.has(style.id) ? 'active' : ''}" data-style="${style.id}">
      <span class="style-emoji">${style.emoji}</span>
      ${style.label}
    </button>
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

document.querySelectorAll('[data-orientation]').forEach((btn) => {
  btn.addEventListener('click', () => {
    orientation = btn.dataset.orientation;
    document.querySelectorAll('[data-orientation]').forEach((node) => node.classList.toggle('active', node === btn));
  });
});

async function startCamera(forceRestart = false) {
  cropEditor.classList.add('hidden');
  cameraWrap.classList.remove('hidden');
  cameraWrap.classList.remove('camera-wrap--compact');

  if (stream && !forceRestart) {
    camera.classList.remove('hidden');
    cameraOverlay.classList.remove('hidden');
    capturedImage.classList.add('hidden');
    camera.play?.().catch(() => {});
    updateCameraMirror();
    setStatus('Cámara lista. Hazte un selfie bonito ✨');
    syncCaptureButtons();
    return;
  }

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
  updateCameraMirror();
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
  cameraWrap.classList.remove('camera-wrap--compact');
  cameraOverlay.classList.add('hidden');
  cropEditor.classList.add('hidden');
  setStatus('Selfie capturado. Pulsa Siguiente para continuar.', 'success');
  syncCaptureButtons();
}

function resetCapture() {
  capturedDataUrl = '';
  cropSourceDataUrl = '';
  dragState = null;
  pinchState = null;
  capturedImage.src = '';
  capturedImage.classList.add('hidden');
  cropImage.src = '';
  cropEditor.classList.add('hidden');
  cropZoom.value = '1';
  cameraWrap.classList.remove('hidden');
  cameraWrap.classList.add('camera-wrap--compact');
  if (stream) {
    camera.classList.remove('hidden');
    cameraOverlay.classList.remove('hidden');
    camera.play?.().catch(() => {});
    updateCameraMirror();
    setStatus('Puedes repetir el selfie ahora mismo.');
  } else {
    camera.classList.add('hidden');
    cameraOverlay.classList.add('hidden');
    setStatus('Abre la cámara o sube una foto desde la galería.');
  }
  syncCaptureButtons();
}

/* ===== Crop editor ===== */
function getRotatedDimensions(width, height, rotation) {
  const quarterTurns = ((rotation % 360) + 360) % 360;
  return quarterTurns === 90 || quarterTurns === 270
    ? { width: height, height: width }
    : { width, height };
}

function updateZoomSlider() {
  cropZoom.value = String(cropState.scale / cropState.minScale);
}

function updateCropImage() {
  const normalizedRotation = ((cropState.rotation % 360) + 360) % 360;
  const scaledBaseWidth = cropState.baseWidth * cropState.scale;
  const scaledBaseHeight = cropState.baseHeight * cropState.scale;
  cropImage.style.width = `${scaledBaseWidth}px`;
  cropImage.style.height = `${scaledBaseHeight}px`;

  let transform = `translate(${cropState.x}px, ${cropState.y}px) `;
  if (normalizedRotation === 90) {
    transform += `translate(${cropState.imageWidth * cropState.scale}px, 0) rotate(90deg)`;
  } else if (normalizedRotation === 180) {
    transform += `translate(${cropState.imageWidth * cropState.scale}px, ${cropState.imageHeight * cropState.scale}px) rotate(180deg)`;
  } else if (normalizedRotation === 270) {
    transform += `translate(0, ${cropState.imageHeight * cropState.scale}px) rotate(270deg)`;
  }

  cropImage.style.transform = transform;
}

function clampCropPosition() {
  const scaledWidth = cropState.imageWidth * cropState.scale;
  const scaledHeight = cropState.imageHeight * cropState.scale;
  const minX = Math.min(0, cropState.viewportWidth - scaledWidth);
  const minY = Math.min(0, cropState.viewportHeight - scaledHeight);
  cropState.x = Math.min(0, Math.max(minX, cropState.x));
  cropState.y = Math.min(0, Math.max(minY, cropState.y));
}

function fitCropToViewport() {
  const previousCenterX = (cropState.viewportWidth / 2 - cropState.x) / cropState.scale;
  const previousCenterY = (cropState.viewportHeight / 2 - cropState.y) / cropState.scale;
  cropState.minScale = Math.max(
    cropState.viewportWidth / cropState.imageWidth,
    cropState.viewportHeight / cropState.imageHeight
  );
  cropState.scale = Math.max(cropState.scale, cropState.minScale);
  cropState.x = cropState.viewportWidth / 2 - previousCenterX * cropState.scale;
  cropState.y = cropState.viewportHeight / 2 - previousCenterY * cropState.scale;
  clampCropPosition();
  updateZoomSlider();
  updateCropImage();
}

function setupCropper() {
  cropState.viewportWidth = cropViewport.clientWidth;
  cropState.viewportHeight = cropViewport.clientHeight;
  cropState.baseWidth = cropImage.naturalWidth;
  cropState.baseHeight = cropImage.naturalHeight;
  cropState.rotation = 0;
  const rotated = getRotatedDimensions(cropState.baseWidth, cropState.baseHeight, cropState.rotation);
  cropState.imageWidth = rotated.width;
  cropState.imageHeight = rotated.height;
  cropState.minScale = Math.max(
    cropState.viewportWidth / cropState.imageWidth,
    cropState.viewportHeight / cropState.imageHeight
  );
  cropState.scale = cropState.minScale;
  cropZoom.value = '1';
  const scaledWidth = cropState.imageWidth * cropState.scale;
  const scaledHeight = cropState.imageHeight * cropState.scale;
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
    setStatus('Ajusta el encuadre, usa pellizco para zoom y rota si hace falta.');
    syncCaptureButtons();
  };
  cropImage.src = dataUrl;
}

function drawRotatedSource(ctx, image, rotation, width, height) {
  if (rotation === 0) {
    ctx.drawImage(image, 0, 0, width, height);
    return;
  }

  if (rotation === 90) {
    ctx.translate(height, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(image, 0, 0, width, height);
    return;
  }

  if (rotation === 180) {
    ctx.translate(width, height);
    ctx.rotate(Math.PI);
    ctx.drawImage(image, 0, 0, width, height);
    return;
  }

  ctx.translate(0, width);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(image, 0, 0, width, height);
}

function applyCrop() {
  if (!cropImage.src) return;
  const rotatedCanvas = document.createElement('canvas');
  const rotatedCtx = rotatedCanvas.getContext('2d');
  const rotated = getRotatedDimensions(cropState.baseWidth, cropState.baseHeight, cropState.rotation);
  rotatedCanvas.width = rotated.width;
  rotatedCanvas.height = rotated.height;
  drawRotatedSource(rotatedCtx, cropImage, cropState.rotation, cropState.baseWidth, cropState.baseHeight);

  const outputWidth = 1200;
  const outputHeight = 1500;
  captureCanvas.width = outputWidth;
  captureCanvas.height = outputHeight;
  const ctx = captureCanvas.getContext('2d');
  const sx = -cropState.x / cropState.scale;
  const sy = -cropState.y / cropState.scale;
  const sw = cropState.viewportWidth / cropState.scale;
  const sh = cropState.viewportHeight / cropState.scale;
  ctx.drawImage(rotatedCanvas, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);
  capturedDataUrl = captureCanvas.toDataURL('image/jpeg', 0.95);
  cropEditor.classList.add('hidden');
  cameraWrap.classList.remove('hidden');
  cameraWrap.classList.remove('camera-wrap--compact');
  capturedImage.src = capturedDataUrl;
  capturedImage.classList.remove('hidden');
  setStatus('Foto recortada. Pulsa Siguiente para continuar.', 'success');
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

/* ===== Generation ===== */
function buildPrompt(style, extra) {
  const framing = photoType === 'portrait'
    ? 'Use a bust or close portrait framing, suitable for a profile picture.'
    : 'Prefer full-body or at least three-quarter body framing, unless impossible.';
  const orient = orientation === 'vertical'
    ? 'The image must be in portrait orientation (taller than wide).'
    : 'The image must be in landscape orientation (wider than tall).';
  return `Use the uploaded selfie only as an identity reference for the person. Do not preserve the original clothes, background, room, furniture, lighting or framing from the source image. Recreate the full image from scratch so everything matches the selected scenario perfectly. ${style.prompt}. ${style.wardrobe} ${framing} ${orient} The result must show the same person, fully recognizable, but in a much more beautiful, flattering and polished way. Beauty and perfection are the highest priority. Make the person look realistically 5 to 10 years younger, while remaining clearly the same real person. Reduce or remove wrinkles, expression lines, skin marks, blemishes, dark circles, pores, uneven texture, dullness, gray hair and visible signs of aging. Skin should look smooth, luminous and healthy, but still realistic. Teeth should look clean, aligned and naturally white when smiling. Hair should look professionally styled, glossy and salon-quality. Improve facial harmony, symmetry, posture and overall attractiveness according to conventional beauty standards, while staying believable and photographic. Preserve identity, face structure and recognizability, but rebuild wardrobe, styling, background and composition to fit the chosen environment naturally. Clothing must match the selected scene and feel coherent, realistic and attractive. Unless the user explicitly asks otherwise in extra details, default to casual clothing for every style except Profesional top, which should stay professionally dressed by default. Absolutely no text, letters, logos, brands, watermarks, captions, signs, labels or graphic overlays anywhere in the image unless the user explicitly asks for them in extra details. No old-looking result, no extra people, no duplicate face, no distorted anatomy, no leftover elements from the source selfie. ${extra ? `Extra guidance: ${extra}.` : ''}`;
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

function addPlaceholderCard(styleLabel, index) {
  const card = document.createElement('div');
  card.className = 'result-placeholder';
  card.dataset.placeholderIndex = index;
  card.innerHTML = `
    <div class="placeholder-image">
      <div class="placeholder-glow"></div>
    </div>
    <div class="placeholder-label"></div>
    <div class="placeholder-btn"></div>
  `;
  resultsGrid.appendChild(card);
}

function replacePlaceholderWithResult(index, { imageUrl, styleLabel }) {
  const placeholder = resultsGrid.querySelector(`[data-placeholder-index="${index}"]`);
  if (!placeholder) return;
  const card = document.createElement('article');
  card.className = 'result-card';
  card.innerHTML = `
    <img src="${imageUrl}" alt="Resultado ${index + 1}" data-lightbox="${imageUrl}" />
    <strong>${styleLabel}</strong>
    <div class="result-actions">
      <a class="download-btn" href="${imageUrl}" download="prettyme-${index + 1}.png">Descargar</a>
    </div>
  `;
  card.querySelector('img').addEventListener('click', () => openLightbox(imageUrl));
  placeholder.replaceWith(card);
}

async function generateResults() {
  if (!capturedDataUrl) {
    setStatus('Hazte primero un selfie desde la app.', 'warning');
    return;
  }

  goToStep(3);
  resultsGrid.innerHTML = '';
  generateBtn.disabled = true;
  regenerateBtn.disabled = true;

  try {
    const [header, data] = capturedDataUrl.split(',');
    const mimeType = header.match(/data:(.*?);base64/)[1];
    const selected = styles.filter((style) => selectedStyles.has(style.id));
    const queue = Array.from({ length: resultCount }, (_, i) => selected[i % selected.length]);

    for (let i = 0; i < queue.length; i += 1) {
      addPlaceholderCard(queue[i].label, i);
    }

    setStatus('Generando tus fotos… esto puede tardar un poco.', '');

    for (let i = 0; i < queue.length; i += 1) {
      setStatus(`Generando imagen ${i + 1} de ${queue.length}…`);
      const result = await generateOne(queue[i], data, mimeType, extraPrompt.value.trim());
      replacePlaceholderWithResult(i, { imageUrl: result.imageUrl, styleLabel: queue[i].label });
    }

    setStatus('¡Listo! Toca una imagen para verla en grande.', 'success');
  } catch (error) {
    console.error(error);
    const message = String(error.message || 'Error desconocido');
    if (message.includes('RESOURCE_EXHAUSTED') || message.includes('quota') || message.includes('429')) {
      resultsGrid.innerHTML = `
        <article class="empty-state">
          <strong>La generación no está disponible ahora mismo</strong>
          <span>La API de imagen ha respondido que no hay cuota disponible.</span>
          <span>Prueba más tarde o cambia a una clave con cuota activa.</span>
        </article>
      `;
      setStatus('Cuota no disponible ahora mismo.', 'warning');
    } else {
      resultsGrid.innerHTML = `
        <article class="empty-state">
          <strong>No he podido generar las fotos</strong>
          <span>Algo ha fallado al hablar con el motor de imagen.</span>
          <span>Prueba otra vez en un momento.</span>
        </article>
      `;
      setStatus('No he podido generar las fotos.', 'error');
    }
  } finally {
    generateBtn.disabled = false;
    regenerateBtn.disabled = false;
  }
}

/* ===== Crop touch/pointer handlers ===== */
function getPoint(event) {
  if (event.touches?.[0]) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  return { x: event.clientX, y: event.clientY };
}

function setScaleFromZoomFactor(zoomFactor, anchorX = cropState.viewportWidth / 2, anchorY = cropState.viewportHeight / 2) {
  const clampedZoomFactor = Math.min(3, Math.max(1, zoomFactor));
  const nextScale = cropState.minScale * clampedZoomFactor;
  const imageAnchorX = (anchorX - cropState.x) / cropState.scale;
  const imageAnchorY = (anchorY - cropState.y) / cropState.scale;
  cropState.scale = nextScale;
  cropState.x = anchorX - imageAnchorX * cropState.scale;
  cropState.y = anchorY - imageAnchorY * cropState.scale;
  clampCropPosition();
  updateZoomSlider();
  updateCropImage();
}

cropZoom.addEventListener('input', () => {
  setScaleFromZoomFactor(Number(cropZoom.value));
});

function getDistance(touchA, touchB) {
  const dx = touchA.clientX - touchB.clientX;
  const dy = touchA.clientY - touchB.clientY;
  return Math.hypot(dx, dy);
}

function getMidpoint(touchA, touchB) {
  return {
    x: (touchA.clientX + touchB.clientX) / 2,
    y: (touchA.clientY + touchB.clientY) / 2
  };
}

function startDrag(event) {
  if (cropEditor.classList.contains('hidden')) return;
  if (event.pointerType === 'touch') return;
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

cropViewport.addEventListener('touchstart', (event) => {
  if (cropEditor.classList.contains('hidden')) return;
  if (event.touches.length === 2) {
    const midpoint = getMidpoint(event.touches[0], event.touches[1]);
    pinchState = {
      startDistance: getDistance(event.touches[0], event.touches[1]),
      startZoomFactor: cropState.scale / cropState.minScale,
      midpoint
    };
    dragState = null;
    return;
  }
  if (event.touches.length === 1) {
    const point = getPoint(event);
    dragState = {
      startX: point.x,
      startY: point.y,
      originX: cropState.x,
      originY: cropState.y
    };
  }
}, { passive: false });

cropViewport.addEventListener('touchmove', (event) => {
  if (pinchState && event.touches.length === 2) {
    event.preventDefault();
    const distance = getDistance(event.touches[0], event.touches[1]);
    const midpoint = getMidpoint(event.touches[0], event.touches[1]);
    pinchState.midpoint = midpoint;
    setScaleFromZoomFactor((distance / pinchState.startDistance) * pinchState.startZoomFactor, midpoint.x - cropViewport.getBoundingClientRect().left, midpoint.y - cropViewport.getBoundingClientRect().top);
    return;
  }
  if (dragState && event.touches.length === 1) {
    event.preventDefault();
    const point = getPoint(event);
    cropState.x = dragState.originX + (point.x - dragState.startX);
    cropState.y = dragState.originY + (point.y - dragState.startY);
    clampCropPosition();
    updateCropImage();
  }
}, { passive: false });

cropViewport.addEventListener('touchend', (event) => {
  if (event.touches.length < 2) pinchState = null;
  if (event.touches.length === 0) dragState = null;
}, { passive: true });

cropViewport.addEventListener('touchcancel', () => {
  pinchState = null;
  dragState = null;
}, { passive: true });

rotateCropBtn.addEventListener('click', () => {
  cropState.rotation = (cropState.rotation + 90) % 360;
  const rotated = getRotatedDimensions(cropState.baseWidth, cropState.baseHeight, cropState.rotation);
  cropState.imageWidth = rotated.width;
  cropState.imageHeight = rotated.height;
  fitCropToViewport();
  updateCropImage();
  setStatus('Foto rotada. Ajusta el encuadre si hace falta.');
});

applyCropBtn.addEventListener('click', applyCrop);
cancelCropBtn.addEventListener('click', () => {
  cropEditor.classList.add('hidden');
  cropImage.src = '';
  cropSourceDataUrl = '';
  pinchState = null;
  dragState = null;
  cameraWrap.classList.remove('hidden');
  cameraPlaceholder.classList.remove('hidden');
  setStatus('Carga otra foto desde la galería o usa la cámara.');
  syncCaptureButtons();
});

/* ===== Button wiring ===== */
startCameraBtn.addEventListener('click', startCamera);
switchCameraBtn.addEventListener('click', async () => {
  facingMode = facingMode === 'user' ? 'environment' : 'user';
  await startCamera(true);
});
uploadBtn.addEventListener('click', () => galleryInput.click());
galleryInput.addEventListener('change', (event) => loadFromGallery(event.target.files?.[0]));
captureBtn.addEventListener('click', capturePhoto);
retakeBtn.addEventListener('click', resetCapture);
generateBtn.addEventListener('click', generateResults);

/* ===== Init ===== */
renderStyles();
goToStep(1);
syncCaptureButtons();
setStatus('Abre la cámara o sube una foto para empezar.');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
