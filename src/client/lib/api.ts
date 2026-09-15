import { auth } from "./firebase";

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const user = auth.currentUser;
  const headers = new Headers(options.headers || {});

  if (user) {
    const token = await user.getIdToken();
    headers.set("Authorization", `Bearer ${token}`);
  }

  headers.set("Content-Type", "application/json");

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

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

  return response.json();
}
