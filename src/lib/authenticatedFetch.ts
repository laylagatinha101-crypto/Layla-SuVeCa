import { auth } from './firebase';

/** Sends a short-lived Firebase identity token only to same-origin APIs. */
export async function authenticatedFetch(input: string, init: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Entre na sua conta para usar os recursos de IA.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }
  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(input, { ...init, headers });
}
