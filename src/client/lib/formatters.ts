/**
 * Formats numbers into the Indian numbering system (en-IN) without trailing .00 decimals.
 * Example:
 *  100000 -> "1,00,000"
 *  1000000.00 -> "10,00,000"
 *  1250.50 -> "1,250.5"
 */
export function formatINR(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0";
  const cleaned = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
  if (isNaN(cleaned) || !isFinite(cleaned)) return "0";
  const rounded = Math.round(cleaned * 100) / 100;
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rounded);
}

/**
 * Formats a date string or Date object into dd-mm-yyyy format.
 * Preserves any trailing time string if present (e.g., "2026-10-30 14:20" -> "30-10-2026 14:20").
 */
export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "-";
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return "-";
    const dd = String(dateInput.getDate()).padStart(2, "0");
    const mm = String(dateInput.getMonth() + 1).padStart(2, "0");
    const yyyy = dateInput.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  const str = String(dateInput).trim();
  if (!str || str === "-") return "-";

  // Already in dd-mm-yyyy format
  if (/^\d{2}-\d{2}-\d{4}/.test(str)) {
    return str;
  }

  // Match YYYY-MM-DD (optionally followed by T or space and time)
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
  if (match) {
    const [, yyyy, mm, dd, rest] = match;
    if (rest && rest.startsWith("T")) {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        const pDd = String(parsed.getDate()).padStart(2, "0");
        const pMm = String(parsed.getMonth() + 1).padStart(2, "0");
        const pYyyy = parsed.getFullYear();
        return `${pDd}-${pMm}-${pYyyy}`;
      }
    }
    return `${dd}-${mm}-${yyyy}${rest || ""}`;
  }

  // Match YYYY/MM/DD
  const slashMatch = str.match(/^(\d{4})\/(\d{2})\/(\d{2})(.*)$/);
  if (slashMatch) {
    const [, yyyy, mm, dd, rest] = slashMatch;
    return `${dd}-${mm}-${yyyy}${rest || ""}`;
  }

  return str;
}
