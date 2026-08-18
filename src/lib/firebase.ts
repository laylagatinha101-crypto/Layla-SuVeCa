import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const firebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const firestoreDatabaseId = firebaseConfig.firestoreDatabaseId || '(default)';

// Firestore's persistent cache lets previously opened modules, notes and
// flashcard schedules remain usable without a connection. Pending writes are
// replayed by the SDK as soon as the learner comes back online.
export const db = (() => {
  try {
    return initializeFirestore(
      firebaseApp,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      firestoreDatabaseId
    );
  } catch (error) {
    // A second Firebase bundle or a restrictive browser can already have a
    // Firestore instance. The app remains functional with the default cache.
    console.warn('Cache persistente do Firestore indisponível:', error);
    return getFirestore(firebaseApp, firestoreDatabaseId);
  }
})();

export { signInWithPopup, signOut, onAuthStateChanged };
export type { User };
