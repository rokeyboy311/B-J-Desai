import { getStoredPinToken, getStoredCategoryPinToken } from './api';

export async function downloadExcelReport(endpoint: string, fallbackFilename: string = 'BJ_Export.xlsx'): Promise<void> {
  const token = getStoredPinToken();
  const categoryToken = getStoredCategoryPinToken();
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-app-pin-token'] = token;
  }
  if (categoryToken) {
    headers['x-category-pin-token'] = categoryToken;
  }

  const res = await fetch(`/api${endpoint}`, { headers });
  if (!res.ok) {
    let errMsg = 'Failed to download Excel file';
    try {
      const errJson = await res.json();
      errMsg = errJson.error || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  // Determine filename from response header if available
  let filename = fallbackFilename;
  const disposition = res.headers.get('Content-Disposition');
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match && match[1]) {
      filename = match[1].replace(/['"]/g, '');
    }
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 200);
}
