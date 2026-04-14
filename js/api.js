// js/api.js — Authenticated fetch helper

import { getIdToken } from './auth.js';

export async function authenticatedFetch(url, options = {}) {
  const token = await getIdToken();
  if (token) {
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    options.headers = headers;
  }
  return fetch(url, options);
}

export async function apiGet(url) {
  const token = await getIdToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const resp = await fetch(url, { headers });
  return resp.json();
}