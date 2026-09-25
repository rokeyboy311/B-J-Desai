/**
 * B-J DESAI ACCOUNTING - CENTRAL API & NETWORK LAYER
 * Supports dual mode: Google Apps Script Web App API (₹0 production hosting)
 * and express backend proxy fallback.
 */

export const WEB_APP_URL_STORAGE_KEY = 'bd_desai_web_app_url';
export const PENDING_QUEUE_KEY = 'bd_desai_pending_queue';

export function getGoogleWebAppUrl(): string | null {
  try {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl && envUrl.trim() !== '' && !envUrl.includes('placeholder')) {
      return envUrl.trim();
    }
    const savedUrl = localStorage.getItem(WEB_APP_URL_STORAGE_KEY);
    if (savedUrl && savedUrl.trim() !== '') {
      return savedUrl.trim();
    }
  } catch (e) {}
  return null;
}

export function setGoogleWebAppUrl(url: string): void {
  try {
    if (url && url.trim() !== '') {
      localStorage.setItem(WEB_APP_URL_STORAGE_KEY, url.trim());
    } else {
      localStorage.removeItem(WEB_APP_URL_STORAGE_KEY);
    }
  } catch (e) {}
}

export function generateRequestId(prefix: string = 'REQ'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
}

export interface ApiResponse<T = any> {
  success: boolean;
  requestId: string;
  data: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    status?: number;
  } | null;
}

export async function executeApiAction<T = any>(action: string, payload: any = {}, customRequestId?: string): Promise<T> {
  const webAppUrl = getGoogleWebAppUrl();
  const requestId = customRequestId || generateRequestId('REQ');

  if (webAppUrl) {
    // Direct Google Apps Script Web App API Execution
    try {
      const response = await fetch(webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8', // GAS preflight compatibility
        },
        body: JSON.stringify({
          action,
          requestId,
          timestamp: new Date().toISOString(),
          payload
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error (${response.status}) from Google Web App API`);
      }

      const result: ApiResponse<T> = await response.json();
      if (!result.success) {
        throw new Error(result.error?.message || result.message || 'Operation failed on Google Sheets API.');
      }

      return result.data;
    } catch (err: any) {
      console.warn(`[API] Google Web App Action ${action} failed:`, err.message || err);
      
      // Save to offline queue if it's a write mutation
      if (['CREATE', 'TRANSFER', 'UPDATE', 'DELETE', 'RESTORE'].some(k => action.startsWith(k))) {
        saveToPendingQueue(action, payload, requestId);
        throw new Error(`Network connection interrupted. Transaction saved to Pending Sync Queue.`);
      }
      throw err;
    }
  } else {
    // Fallback to Express backend proxy
    const endpoint = `/api/gas-proxy`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, requestId, payload })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || data.message || 'API request failed');
      }
      return data.data;
    } catch (fallbackErr: any) {
      // If local proxy endpoint fails, attempt direct fetch endpoint
      return executeLegacyFallback(action, payload);
    }
  }
}

async function executeLegacyFallback(action: string, payload: any): Promise<any> {
  // Legacy endpoint routing fallback
  let endpoint = '/api/records';
  let method = 'GET';
  
  if (action === 'GET_LOCATIONS') endpoint = '/api/locations';
  if (action === 'GET_INVESTORS') endpoint = '/api/investments/global-investors';
  if (action === 'CREATE_LOCATION') { endpoint = '/api/locations'; method = 'POST'; }
  if (action === 'CREATE_INVESTOR') { endpoint = '/api/investments/global-investors'; method = 'POST'; }

  const res = await fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method !== 'GET' ? JSON.stringify(payload) : undefined
  });
  return await res.json();
}

function saveToPendingQueue(action: string, payload: any, requestId: string): void {
  try {
    const current = getPendingQueue();
    current.push({
      requestId,
      action,
      payload,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(current));
  } catch (e) {}
}

export function getPendingQueue(): Array<{ requestId: string; action: string; payload: any; timestamp: string }> {
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function clearPendingQueue(): void {
  try {
    localStorage.removeItem(PENDING_QUEUE_KEY);
  } catch (e) {}
}
