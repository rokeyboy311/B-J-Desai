import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initRealtimeSyncManager } from './hooks/useLiveSync';
import { ErrorBoundary } from './components/ErrorBoundary';

// Suppress benign Vite HMR websocket disconnection warnings in cloud container environment
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && typeof event.reason.message === 'string' && event.reason.message.includes('WebSocket')) {
    event.preventDefault();
  }
});

const rootElement = document.getElementById('root');
if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (mountErr) {
    console.error('Failed to render React root:', mountErr);
  }
} else {
  console.error('Root DOM element #root not found in document.');
}

// Safely initialize global multi-device real-time sync after initial render
setTimeout(() => {
  try {
    initRealtimeSyncManager();
  } catch (e) {
    console.warn('Realtime sync manager init skipped:', e);
  }
}, 100);
