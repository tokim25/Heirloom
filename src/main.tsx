import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initSentry } from './utils/sentry.ts';
import { registerServiceWorker } from './utils/pwa.ts';
import { AuthProvider } from './context/AuthContext.tsx';

// Initialize Sentry error telemetry
initSentry();

// Register PWA Service Worker for offline kitchen and grocery use
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
