import { useEffect, useCallback } from 'react';
import { getApiUrl } from '../lib/api';

let globalKnownVersion = 0;
let sseConnection: EventSource | null = null;
let broadcastChannel: BroadcastChannel | null = null;
let isManagerInitialized = false;

/**
 * Initializes the real-time sync client listener across SSE, BroadcastChannel, and fallback polling.
 */
export function initRealtimeSyncManager() {
  if (isManagerInitialized || typeof window === 'undefined') return;
  isManagerInitialized = true;

  // 1. Setup cross-tab BroadcastChannel
  try {
    if ('BroadcastChannel' in window) {
      broadcastChannel = new BroadcastChannel('bd_erp_realtime_sync');
      broadcastChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'SYNC') {
          dispatchUpdateEvent();
        }
      };
    }
  } catch (e) {
    console.warn('BroadcastChannel not supported:', e);
  }

  // 2. Setup Server-Sent Events (SSE) stream for instant server pushes
  function connectSSE() {
    if (sseConnection) {
      try {
        sseConnection.close();
      } catch (e) {}
    }

    try {
      sseConnection = new EventSource(getApiUrl('/sync/events'));

      sseConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'MUTATION') {
            if (data.version && data.version > globalKnownVersion) {
              globalKnownVersion = data.version;
              dispatchUpdateEvent();
            }
          } else if (data.type === 'INIT' && data.version) {
            globalKnownVersion = data.version;
          }
        } catch (err) {
          console.warn('Error parsing SSE event:', err);
        }
      };

      sseConnection.onerror = () => {
        // Automatically close and reconnect after a short delay
        if (sseConnection) {
          sseConnection.close();
          sseConnection = null;
        }
        setTimeout(connectSSE, 4000);
      };
    } catch (e) {
      console.warn('SSE connection failed, relying on fast polling:', e);
    }
  }

  connectSSE();

  // 3. Fast Version Poll fallback (checks every 3.5 seconds)
  async function checkVersion() {
    try {
      const res = await fetch(getApiUrl('/sync/version'), {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (data && typeof data.version === 'number' && data.version > globalKnownVersion) {
            globalKnownVersion = data.version;
            dispatchUpdateEvent();
          }
        } catch {
          // ignore non-json responses (e.g. dev server reloads)
        }
      }
    } catch (err) {
      // ignore transient network errors
    }
  }

  const pollInterval = setInterval(() => {
    if (document.visibilityState === 'visible') {
      checkVersion();
    }
  }, 3500);

  // 4. Instant sync on visibility change (tab focus, phone unlock)
  const onVisibilityOrFocus = () => {
    if (document.visibilityState === 'visible') {
      checkVersion();
      if (!sseConnection || sseConnection.readyState === EventSource.CLOSED) {
        connectSSE();
      }
    }
  };

  window.addEventListener('visibilitychange', onVisibilityOrFocus);
  window.addEventListener('focus', onVisibilityOrFocus);
}

function dispatchUpdateEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bd_erp_data_updated'));
  }
}

/**
 * Triggered manually or after mutations to instantly inform this tab, all tabs, and the server
 */
export function triggerGlobalSync(eventType?: string, details?: any) {
  if (typeof window !== 'undefined') {
    globalKnownVersion = Date.now();
    dispatchUpdateEvent();
    
    // Broadcast to other open tabs
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type: 'SYNC', eventType, details, timestamp: Date.now() });
      } catch (e) {}
    }

    // Ping server sync endpoint
    fetch(getApiUrl('/sync/trigger'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, details, timestamp: Date.now() })
    }).catch(() => {});
  }
}

export const triggerSync = triggerGlobalSync;

/**
 * Hook to automatically trigger component data reload whenever data changes on ANY device
 */
export function useLiveSync(onSync: () => void | Promise<void>, intervalMs: number = 3500) {
  const handleSync = useCallback(() => {
    try {
      const result = onSync();
      if (result instanceof Promise) {
        result.catch((e) => console.warn('Sync callback error:', e));
      }
    } catch (e) {
      console.warn('Sync callback error:', e);
    }
  }, [onSync]);

  useEffect(() => {
    // Ensure manager is initialized
    initRealtimeSyncManager();

    // 1. Tab visibility / window focus listener
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleSync();
      }
    };
    const onFocus = () => {
      handleSync();
    };

    // 2. Custom event dispatched when ANY device or tab mutates data
    const onDataUpdated = () => {
      handleSync();
    };

    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('bd_erp_data_updated', onDataUpdated);

    // 3. Fallback active polling (conservative fallback to prevent network storms)
    let timer: any = null;
    const effectiveInterval = Math.max(intervalMs || 0, 30000);
    if (intervalMs > 0) {
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          handleSync();
        }
      }, effectiveInterval);
    }

    return () => {
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('bd_erp_data_updated', onDataUpdated);
      if (timer) clearInterval(timer);
    };
  }, [handleSync, intervalMs]);
}
