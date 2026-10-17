import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initSentry } from './utils/sentry.ts';
import { registerServiceWorker } from './utils/pwa.ts';
import { AuthProvider } from './context/AuthContext.tsx';

// Error telemetry starts once the browser is idle, after the app has painted.
const startTelemetry = () => void initSentry();
const idle = (window as { requestIdleCallback?: (fn: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
if (idle) idle(startTelemetry, { timeout: 4000 });
else setTimeout(startTelemetry, 1500);

// Register PWA Service Worker for offline kitchen and grocery use
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
