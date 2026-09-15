import { auth } from "./firebase";

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  if (!auth.currentUser && typeof auth.authStateReady === "function") {
    try {
      await auth.authStateReady();
    } catch (e) {
      console.warn("Auth state readiness check:", e);
    }
  }

  const user = auth.currentUser;
  const headers = new Headers(options.headers || {});

  if (user) {
    try {
      const token = await user.getIdToken();
      headers.set("Authorization", `Bearer ${token}`);
    } catch (e) {
      console.warn("Failed to get ID token:", e);
    }
  }

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  // If 401 Unauthorized and user is logged in, try force-refreshing the token once
  if (response.status === 401 && user) {
    try {
      const freshToken = await user.getIdToken(true);
      headers.set("Authorization", `Bearer ${freshToken}`);
      response = await fetch(`/api${endpoint}`, {
        ...options,
        headers,
      });
    } catch (refreshErr) {
      console.error("Token refresh retry failed:", refreshErr);
    }
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

  return response.json();
}
