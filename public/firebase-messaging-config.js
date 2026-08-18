/*
 * Firebase configuration used only by the service worker to receive FCM
 * messages in the background. Firebase web configuration is public by design;
 * access control still comes from Auth, Firestore Rules and the server.
 *
 * Update this file together with firebase-applet-config.json when the app is
 * moved to another Firebase project.
 */
self.__SUVECA_FIREBASE_CONFIG__ = {
  apiKey: 'AIzaSyBqmLWEl9ONqUFGlmvdTP-tN4lWVaMP2gc',
  authDomain: 'gen-lang-client-0165685347.firebaseapp.com',
  projectId: 'gen-lang-client-0165685347',
  storageBucket: 'gen-lang-client-0165685347.firebasestorage.app',
  messagingSenderId: '800480353019',
  appId: '1:800480353019:web:c8bf2a62c5142c6d102e5e'
};
