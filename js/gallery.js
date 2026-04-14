// js/gallery.js — Gallery panel logic

import { isSignedIn, onAuthChange } from './auth.js';
import { apiGet } from './api.js';

const galleryPanel = document.getElementById('galleryPanel');
const galleryGrid = document.getElementById('galleryGrid');
const galleryClose = document.getElementById('galleryClose');
const galleryOverlay = document.getElementById('galleryOverlay');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxDownload = document.getElementById('lightboxDownload');
const lightbox = document.getElementById('lightbox');

let loading = false;

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
      document.getElementById('authModal').classList.remove('hidden');
    });
    return;
  }

  loading = true;
  galleryGrid.innerHTML = '<div class="gallery-loading">Cargando…</div>';

  try {
    const data = await apiGet('/api/gallery?limit=50');

    if (!data.images || data.images.length === 0) {
      galleryGrid.innerHTML = `
        <div class="gallery-empty">
          <p>Aún no tienes fotos guardadas</p>
          <p class="gallery-empty-hint">Las fotos que generes se guardarán aquí automáticamente.</p>
        </div>
      `;
      return;
    }

    galleryGrid.innerHTML = '';
    for (const img of data.images) {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.innerHTML = `
        <img src="${img.url}" alt="${img.style || 'Foto'}" loading="lazy" />
        <div class="gallery-card-info">
          <strong>${img.style || ''}</strong>
          <span>${formatDate(img.createdAt)}</span>
        </div>
      `;
      card.querySelector('img').addEventListener('click', () => {
        closeGallery();
        openLightbox(img.url);
      });
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
  if (galleryPanel.classList.contains('is-open')) loadGallery();
});