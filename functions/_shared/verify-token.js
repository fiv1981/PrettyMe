/**
 * Verify a Firebase ID token using the Firebase Auth REST API.
 * Simpler and more reliable than manual JWT verification,
 * especially since Google retired the X.509 key endpoint.
 */
const FIREBASE_API_KEY = 'AIzaSyABhZx47LD_YXHfFZjf32bJx1rLGNqpLP0';

export async function verifyFirebaseToken(token, projectId) {
  if (!token || !projectId) return null;

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken: token })
      }
    );

    const data = await resp.json();
    if (!resp.ok || !data.users || !data.users.length) return null;

    const user = data.users[0];

    // Verify the token belongs to the right project
    if (user.projectId && user.projectId !== projectId) return null;

    return { uid: user.localId, email: user.email || null };
  } catch {
    return null;
  }
}