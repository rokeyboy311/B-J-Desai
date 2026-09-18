import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initRealtimeSyncManager } from './hooks/useLiveSync';

// Initialize global multi-device real-time sync
initRealtimeSyncManager();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
