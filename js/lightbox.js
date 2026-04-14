// js/lightbox.js — Shared lightbox with navigation

const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxDownload = document.getElementById('lightboxDownload');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
const lightboxCounter = document.getElementById('lightboxCounter');

let lightboxUrls = [];
let currentIndex = 0;
let touchStartX = 0;
let touchStartY = 0;

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

export function openLightbox(urlsOrSingle, startIndex = 0) {
  lightboxUrls = typeof urlsOrSingle === 'string' ? [urlsOrSingle] : urlsOrSingle;
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
  currentIndex = 0;
  document.removeEventListener('keydown', onKeydown);
  // Only restore scroll if no overlay panel is still open
  const galleryPanel = document.getElementById('galleryPanel');
  if (!galleryPanel || !galleryPanel.classList.contains('is-open')) {
    document.body.style.overflow = '';
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