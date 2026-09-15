import { auth } from "./firebase";

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  const headers = new Headers(options.headers || {});

  if (user) {
    const token = await user.getIdToken();
    headers.set("Authorization", `Bearer ${token}`);
  }

  const activeBusinessId = localStorage.getItem("active_business_id");
  if (activeBusinessId && !headers.has("x-business-id")) {
    headers.set("x-business-id", activeBusinessId);
  }

  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `API Error (${response.status})`;
    try {
      const data = await response.json();
      errorMsg = data.error || errorMsg;
    } catch (e) {
      // JSON parse failed
    }
    throw new Error(errorMsg);
  }

  // Handle empty responses (204 or empty text)
  const text = await response.text();
  return text ? JSON.parse(text) : (null as any);
}

export async function apiDownload(endpoint: string, filename: string) {
  const user = auth.currentUser;
  const headers = new Headers();

  if (user) {
    const token = await user.getIdToken();
    headers.set("Authorization", `Bearer ${token}`);
  }

  const activeBusinessId = localStorage.getItem("active_business_id");
  if (activeBusinessId) {
    headers.set("x-business-id", activeBusinessId);
  }

  const response = await fetch(`/api${endpoint}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
