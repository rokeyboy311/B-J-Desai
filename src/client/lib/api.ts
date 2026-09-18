export const PIN_TOKEN_STORAGE_KEY = 'bd_erp_pin_token';

export function getStoredPinToken(): string | null {
  try {
    return localStorage.getItem(PIN_TOKEN_STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

export function setStoredPinToken(token: string): void {
  try {
    localStorage.setItem(PIN_TOKEN_STORAGE_KEY, token);
  } catch (e) {
    console.warn('Failed to store PIN token in localStorage:', e);
  }
}

export function clearStoredPinToken(): void {
  try {
    localStorage.removeItem(PIN_TOKEN_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear PIN token from localStorage:', e);
  }
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = getStoredPinToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("x-app-pin-token", token);
  }

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr) {
    console.error("Network error during fetch:", netErr);
    // Transient network error (e.g. server restarting), wait and retry once
    await new Promise(r => setTimeout(r, 1000));
    response = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
    });
  }

  if (response.status === 401 && !endpoint.startsWith('/auth/')) {
    // Dispatch lock event if session expired
    window.dispatchEvent(new CustomEvent('bd_erp_unauthorized'));
  }

  if (!response.ok) {
    let errorMsg = "API Error";
    try {
      const data = await response.json();
      errorMsg = data.error || errorMsg;
    } catch (e) {
      // JSON parse failed
    }
    throw new Error(errorMsg);
  }

  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && !endpoint.includes('/auth/')) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bd_erp_data_updated'));
    }
  }

  return response.json();
}
