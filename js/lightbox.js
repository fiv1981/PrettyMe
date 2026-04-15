// js/lightbox.js — Shared lightbox with navigation

import { getIdToken } from './auth.js';

const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxDownload = document.getElementById('lightboxDownload');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
const lightboxCounter = document.getElementById('lightboxCounter');
const lightboxDelete = document.getElementById('lightboxDelete');

let lightboxUrls = [];
let lightboxR2Keys = [];
let currentIndex = 0;
let touchStartX = 0;
let touchStartY = 0;
let onDelete = null;

function makeDownloadName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `PrettyMe_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function downloadAsJpg(imageUrl) {
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

function showCurrentImage() {
  lightboxImage.src = lightboxUrls[currentIndex];
  if (lightboxDownload) {
    const url = lightboxUrls[currentIndex];
    lightboxDownload.onclick = (e) => {
      e.preventDefault();
      downloadAsJpg(url);
    };
  }
  if (lightboxCounter) {
    lightboxCounter.textContent = lightboxUrls.length > 1
      ? `${currentIndex + 1} / ${lightboxUrls.length}`
      : '';
  }
  // Show delete button only for gallery images (have r2Key)
  const hasR2Key = lightboxR2Keys[currentIndex];
  if (lightboxDelete) lightboxDelete.classList.toggle('hidden', !hasR2Key);
}

function toggleNav() {
  const multi = lightboxUrls.length > 1;
  if (lightboxPrev) lightboxPrev.classList.toggle('hidden', !multi);
  if (lightboxNext) lightboxNext.classList.toggle('hidden', !multi);
  if (lightboxCounter) lightboxCounter.classList.toggle('hidden', !multi);
}

function navigate(delta) {
  if (lightboxUrls.length <= 1) return;
  currentIndex = (currentIndex + delta + lightboxUrls.length) % lightboxUrls.length;
  showCurrentImage();
}

function onKeydown(e) {
  if (e.key === 'ArrowLeft') { e.preventDefault(); navigate(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); navigate(1); }
  else if (e.key === 'Escape') { closeLightbox(); }
}

export function openLightbox(urlsOrSingle, startIndex = 0, r2Keys = []) {
  lightboxUrls = typeof urlsOrSingle === 'string' ? [urlsOrSingle] : urlsOrSingle;
  lightboxR2Keys = r2Keys.length ? r2Keys : lightboxUrls.map(() => null);
  currentIndex = Math.max(0, Math.min(startIndex, lightboxUrls.length - 1));
  showCurrentImage();
  toggleNav();
  lightbox.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKeydown);
}

export function closeLightbox() {
  lightbox.classList.add('hidden');
  lightboxImage.src = '';
  lightboxUrls = [];
  lightboxR2Keys = [];
  currentIndex = 0;
  onDelete = null;
  document.removeEventListener('keydown', onKeydown);
  // Only restore scroll if no overlay panel is still open
  const galleryPanel = document.getElementById('galleryPanel');
  if (!galleryPanel || !galleryPanel.classList.contains('is-open')) {
    document.body.style.overflow = '';
  }
}

async function deleteCurrentImage() {
  const r2Key = lightboxR2Keys[currentIndex];
  if (!r2Key) return;
  if (!confirm('¿Eliminar esta foto de tu galería?')) return;

  try {
    const token = await getIdToken();
    const resp = await fetch(`/api/images/${r2Key}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resp.ok) throw new Error('Delete failed');

    // Remove from arrays
    lightboxUrls.splice(currentIndex, 1);
    lightboxR2Keys.splice(currentIndex, 1);

    // Notify gallery to refresh
    if (onDelete) onDelete(r2Key);

    if (lightboxUrls.length === 0) {
      closeLightbox();
      return;
    }
    if (currentIndex >= lightboxUrls.length) currentIndex = lightboxUrls.length - 1;
    showCurrentImage();
    toggleNav();
  } catch (err) {
    console.error('Delete error:', err);
    alert('No se pudo eliminar la foto.');
  }
}

// Static event listeners
if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
if (lightbox) {
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
}
if (lightboxPrev) {
  lightboxPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    navigate(-1);
  });
}
if (lightboxNext) {
  lightboxNext.addEventListener('click', (e) => {
    e.stopPropagation();
    navigate(1);
  });
}
if (lightboxDelete) {
  lightboxDelete.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteCurrentImage();
  });
}

// Touch swipe
if (lightbox) {
  lightbox.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  lightbox.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx > 50 && absDx > absDy * 1.5) {
      navigate(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
}

export function setOnDelete(cb) { onDelete = cb; }