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

let activeDeletePassword: string | null = null;

export function setActiveDeletePassword(password: string | null): void {
  activeDeletePassword = password;
}

export function getActiveDeletePassword(): string | null {
  return activeDeletePassword;
}

export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/api/')
    ? endpoint.slice(4)
    : endpoint.startsWith('api/')
    ? endpoint.slice(3)
    : endpoint;

  const normalizedPath = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;

  // If VITE_API_URL is configured (e.g. deployed backend URL for Vercel static deployments)
  const envBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) 
    ? String(import.meta.env.VITE_API_URL).trim() 
    : '';

  if (envBase && !envBase.includes('placeholder')) {
    const cleanBase = envBase.replace(/\/+$/, '');
    if (cleanBase.endsWith('/api')) {
      return `${cleanBase}${normalizedPath}`;
    }
    return `${cleanBase}/api${normalizedPath}`;
  }

  // Default same-origin relative URL (standard for Vite dev & Vercel rewrites)
  return `/api${normalizedPath}`;
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

  const method = (options.method || 'GET').toUpperCase();
  if (method === 'DELETE' && activeDeletePassword) {
    headers.set("x-delete-password", activeDeletePassword);
  }

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const cleanEndpoint = endpoint.startsWith('/api/')
    ? endpoint.slice(4)
    : endpoint.startsWith('api/')
    ? endpoint.slice(3)
    : endpoint;
  const targetUrl = getApiUrl(cleanEndpoint);

  let response: Response | null = null;
  let lastError: any = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      response = await fetch(targetUrl, {
        ...options,
        headers,
      });
      break; // Succeeded
    } catch (netErr: any) {
      lastError = netErr;
      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff: 300ms, 600ms)
        await new Promise(r => setTimeout(r, attempt * 300));
      }
    }
  }

  if (!response) {
    console.warn(`[API] Network connection issue to ${targetUrl} after ${maxRetries} attempts:`, lastError?.message || lastError);
    throw new Error(`Unable to connect to server. Please check your network or try again in a moment.`);
  }

  if (response.status === 401 && !cleanEndpoint.startsWith('/auth/')) {
    // Dispatch lock event if session expired
    window.dispatchEvent(new CustomEvent('bd_erp_unauthorized'));
  }

  const responseText = await response.text();

  if (!response.ok) {
    let errorMsg = `API Error (${response.status})`;
    try {
      const data = JSON.parse(responseText);
      errorMsg = data.error || data.message || errorMsg;
    } catch {
      if (responseText && !responseText.includes('<!doctype') && !responseText.includes('<html')) {
        errorMsg = responseText.slice(0, 120);
      }
    }
    throw new Error(errorMsg);
  }

  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && !cleanEndpoint.includes('/auth/')) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bd_erp_data_updated'));
    }
  }

  if (!responseText || responseText.trim() === '') {
    return null;
  }

  try {
    return JSON.parse(responseText);
  } catch (err) {
    console.warn(`Non-JSON response received from ${targetUrl}:`, responseText.slice(0, 100));
    return responseText;
  }
}
