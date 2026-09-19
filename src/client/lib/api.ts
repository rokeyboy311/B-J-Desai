export const PIN_TOKEN_STORAGE_KEY = 'bd_erp_pin_token';
export const CATEGORY_PIN_TOKEN_KEY = 'bd_erp_category_pin_token';

export function getStoredPinToken(): string | null {
  try {
    const sessionToken = sessionStorage.getItem(PIN_TOKEN_STORAGE_KEY);
    if (sessionToken) return sessionToken;
    const localToken = localStorage.getItem(PIN_TOKEN_STORAGE_KEY);
    if (localToken) {
      sessionStorage.setItem(PIN_TOKEN_STORAGE_KEY, localToken);
      localStorage.removeItem(PIN_TOKEN_STORAGE_KEY);
      return localToken;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function setStoredPinToken(token: string): void {
  try {
    sessionStorage.setItem(PIN_TOKEN_STORAGE_KEY, token);
    localStorage.removeItem(PIN_TOKEN_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to store PIN token in sessionStorage:', e);
  }
}

export function clearStoredPinToken(): void {
  try {
    sessionStorage.removeItem(PIN_TOKEN_STORAGE_KEY);
    localStorage.removeItem(PIN_TOKEN_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear PIN token:', e);
  }
}

export function getStoredCategoryPinToken(): string | null {
  try {
    return sessionStorage.getItem(CATEGORY_PIN_TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

export function setStoredCategoryPinToken(token: string): void {
  try {
    sessionStorage.setItem(CATEGORY_PIN_TOKEN_KEY, token);
  } catch (e) {
    console.warn('Failed to store Category PIN token in sessionStorage:', e);
  }
}

export function clearStoredCategoryPinToken(): void {
  try {
    sessionStorage.removeItem(CATEGORY_PIN_TOKEN_KEY);
  } catch (e) {
    console.warn('Failed to clear Category PIN token from sessionStorage:', e);
  }
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = getStoredPinToken();
  const categoryToken = getStoredCategoryPinToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("x-app-pin-token", token);
  }

  if (categoryToken) {
    headers.set("x-category-pin-token", categoryToken);
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
