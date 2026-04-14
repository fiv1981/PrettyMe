// js/auth.js — Firebase Auth module for PrettyMe

let currentUser = null;

// Firebase config — must be filled with your project values
const firebaseConfig = {
  apiKey: 'AIzaSyABhZx47LD_YXHfFZjf32bJx1rLGNqpLP0',
  authDomain: 'gen-lang-client-0078028208.firebaseapp.com',
  projectId: 'gen-lang-client-0078028208'
};

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

firebase.auth().onAuthStateChanged((user) => {
  currentUser = user;
  document.dispatchEvent(new CustomEvent('prettyme:authchange', { detail: user }));
});

// Handle redirect result (fallback from signInWithRedirect on mobile)
firebase.auth().getRedirectResult().catch(() => {});

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
  try {
    await firebase.auth().signInWithPopup(provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
      await firebase.auth().signInWithRedirect(provider);
    } else {
      throw e;
    }
  }
}

export async function signInWithApple() {
  const provider = new firebase.auth.OAuthProvider('apple.com');
  try {
    await firebase.auth().signInWithPopup(provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
      await firebase.auth().signInWithRedirect(provider);
    } else {
      throw e;
    }
  }
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