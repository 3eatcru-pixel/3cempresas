import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  !(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ &&
  !(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Service worker registration is optional in restricted preview contexts
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
