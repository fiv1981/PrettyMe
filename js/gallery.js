// js/gallery.js — Gallery panel logic

import { isSignedIn, onAuthChange, getIdToken } from './auth.js';

const galleryPanel = document.getElementById('galleryPanel');
const galleryGrid = document.getElementById('galleryGrid');
const galleryClose = document.getElementById('galleryClose');
const galleryOverlay = document.getElementById('galleryOverlay');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxDownload = document.getElementById('lightboxDownload');
const lightbox = document.getElementById('lightbox');

let loading = false;

// Cache for image blob URLs (avoids re-fetching)
const imageCache = new Map();

export function openGallery() {
  galleryPanel.classList.add('is-open');
  galleryOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  loadGallery();
}

export function closeGallery() {
  galleryPanel.classList.remove('is-open');
  galleryOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

function makeDownloadName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `PrettyMe_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function openLightbox(url) {
  lightboxImage.src = url;
  if (lightboxDownload) {
    lightboxDownload.onclick = (e) => {
      e.preventDefault();
      downloadAsJpg(url);
    };
  }
  lightbox.classList.remove('hidden');
}

function downloadAsJpg(imageUrl) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${makeDownloadName()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/jpeg', 0.9);
  };
  img.src = imageUrl;
}

function formatDate(timestamp) {
  const d = new Date(timestamp * 1000);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Fetch an image with auth header and return a blob URL
async function fetchImageUrl(path) {
  if (imageCache.has(path)) return imageCache.get(path);

  try {
    const token = await getIdToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(path, { headers });
    if (!resp.ok) return path; // Fallback to direct URL
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    imageCache.set(path, url);
    return url;
  } catch {
    return path; // Fallback to direct URL
  }
}

async function loadGallery() {
  if (loading) return;

  if (!isSignedIn()) {
    galleryGrid.innerHTML = `
      <div class="gallery-auth-prompt">
        <p>Inicia sesión para ver tu galería</p>
        <button class="btn btn-primary gallery-login-btn">Iniciar sesión</button>
      </div>
    `;
    galleryGrid.querySelector('.gallery-login-btn')?.addEventListener('click', () => {
      closeGallery();
      document.getElementById('authModal').classList.remove('hidden');
    });
    return;
  }

  loading = true;
  galleryGrid.innerHTML = '<div class="gallery-loading">Cargando…</div>';

  try {
    const token = await getIdToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch('/api/gallery?limit=50', { headers });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      console.error('Gallery API error:', resp.status, errorData);
      galleryGrid.innerHTML = `<div class="gallery-empty"><p>Error al cargar la galería (${resp.status})</p></div>`;
      return;
    }

    const data = await resp.json();

    if (data.error) {
      console.error('Gallery API returned error:', data.error);
      galleryGrid.innerHTML = `<div class="gallery-empty"><p>${data.error}</p></div>`;
      return;
    }

    if (!data.images || data.images.length === 0) {
      galleryGrid.innerHTML = `
        <div class="gallery-empty">
          <p>Aún no tienes fotos</p>
          <p class="gallery-empty-hint">Las fotos que generes aparecerán aquí automáticamente.</p>
        </div>
      `;
      return;
    }

    galleryGrid.innerHTML = '';
    for (const img of data.images) {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      // Show a placeholder while loading
      card.innerHTML = `
        <div class="gallery-card-loading" style="aspect-ratio:3/4;background:var(--card-hover);border-radius:var(--radius)"></div>
        <div class="gallery-card-info">
          <strong>${img.style || ''}</strong>
          <span>${formatDate(img.createdAt)}</span>
        </div>
      `;

      // Fetch image with auth and then set the src
      const imageUrl = await fetchImageUrl(img.url);
      const imgEl = document.createElement('img');
      imgEl.src = imageUrl;
      imgEl.alt = img.style || 'Foto';
      imgEl.loading = 'lazy';
      imgEl.addEventListener('click', () => {
        closeGallery();
        openLightbox(imageUrl);
      });
      imgEl.style.aspectRatio = '3/4';
      imgEl.style.objectFit = 'cover';
      imgEl.style.cursor = 'pointer';

      // Replace placeholder with actual image
      card.querySelector('.gallery-card-loading')?.replaceWith(imgEl);
      galleryGrid.appendChild(card);
    }
  } catch {
    galleryGrid.innerHTML = '<div class="gallery-empty"><p>No se pudo cargar la galería</p></div>';
  } finally {
    loading = false;
  }
}

// Wire close button
if (galleryClose) galleryClose.addEventListener('click', closeGallery);
if (galleryOverlay) galleryOverlay.addEventListener('click', closeGallery);

// Reload gallery when auth changes
onAuthChange(() => {
  // Clear cached images on auth change
  imageCache.forEach((url) => URL.revokeObjectURL(url));
  imageCache.clear();
  if (galleryPanel.classList.contains('is-open')) loadGallery();
});