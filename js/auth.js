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

// Check for redirect result on page load (for mobile fallback)
firebase.auth().getRedirectResult().then((result) => {
  if (result && result.user) {
    console.log('Redirect sign-in successful:', result.user.email);
  }
}).catch((error) => {
  console.warn('Redirect sign-in error:', error.code, error.message);
});

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
  // Try popup first, fall back to redirect on mobile/blockers
  try {
    const result = await firebase.auth().signInWithPopup(provider);
    return result;
  } catch (e) {
    // Redirect fallback for: popup blocked, closed by user on mobile, or COOP issues
    if (
      e.code === 'auth/popup-blocked' ||
      e.code === 'auth/popup-closed-by-user' ||
      e.code === 'auth/cancelled-popup-request' ||
      e.code === 'auth/web-storage-unsupported' ||
      e.code === 'auth/unauthorized-domain'
    ) {
      if (e.code === 'auth/unauthorized-domain') {
        throw new Error('Dominio no autorizado. Añade este dominio en Firebase Console > Authentication > Settings > Authorized domains.');
      }
      await firebase.auth().signInWithRedirect(provider);
    } else {
      throw e;
    }
  }
}

export async function signInWithApple() {
  const provider = new firebase.auth.OAuthProvider('apple.com');
  try {
    const result = await firebase.auth().signInWithPopup(provider);
    return result;
  } catch (e) {
    if (
      e.code === 'auth/popup-blocked' ||
      e.code === 'auth/popup-closed-by-user' ||
      e.code === 'auth/cancelled-popup-request' ||
      e.code === 'auth/web-storage-unsupported'
    ) {
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