// js/auth.js — Firebase Auth module for PrettyMe

let currentUser = null;

// Firebase config — must be filled with your project values
const firebaseConfig = {
  apiKey: 'PLACEHOLDER_FIREBASE_API_KEY',
  authDomain: 'PLACEHOLDER_FIREBASE_AUTH_DOMAIN',
  projectId: 'PLACEHOLDER_FIREBASE_PROJECT_ID'
};

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

firebase.auth().onAuthStateChanged((user) => {
  currentUser = user;
  document.dispatchEvent(new CustomEvent('prettyme:authchange', { detail: user }));
});

export function getCurrentUser() {
  return currentUser;
}

export function isSignedIn() {
  return Boolean(currentUser);
}

export async function getIdToken() {
  if (!currentUser) return null;
  return currentUser.getIdToken().catch(() => null);
}

export function onAuthChange(callback) {
  document.addEventListener('prettyme:authchange', (e) => callback(e.detail));
  // Fire immediately with current state
  if (currentUser !== null) callback(currentUser);
}

export async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  await firebase.auth().signInWithPopup(provider);
}

export async function signInWithApple() {
  const provider = new firebase.auth.OAuthProvider('apple.com');
  await firebase.auth().signInWithPopup(provider);
}

export async function signInWithEmail(email, password) {
  await firebase.auth().signInWithEmailAndPassword(email, password);
}

export async function signUpWithEmail(email, password) {
  await firebase.auth().createUserWithEmailAndPassword(email, password);
}

export async function signOut() {
  await firebase.auth().signOut();
}