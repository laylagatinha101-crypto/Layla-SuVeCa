import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerAppServiceWorker } from './lib/pwa.ts';

// Offline reading is available independently of notification permission. The
// registration is deferred until after the document has loaded so it never
// delays first render on mobile connections.
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    void registerAppServiceWorker();
  }, { once: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
