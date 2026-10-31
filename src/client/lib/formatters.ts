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
 * Formats any date string or Date object into strictly dd-mm-yyyy format.
 * Example:
 *  "2026-10-30" -> "30-10-2026"
 *  "2026-10-30T14:20:00.000Z" -> "30-10-2026"
 *  "10/30/2026" -> "30-10-2026"
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

  // Check if string is already dd-mm-yyyy (with optional trailing time)
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(.*)$/);
  if (ddmmyyyyMatch) {
    const p1 = parseInt(ddmmyyyyMatch[1], 10);
    const p2 = parseInt(ddmmyyyyMatch[2], 10);
    const yyyy = ddmmyyyyMatch[3];
    // If p1 <= 12 and p2 > 12, it was mm-dd-yyyy, flip them
    if (p1 <= 12 && p2 > 12) {
      const dd = String(p2).padStart(2, "0");
      const mm = String(p1).padStart(2, "0");
      return `${dd}-${mm}-${yyyy}`;
    }
    // Otherwise p1 is day, p2 is month
    const dd = String(p1).padStart(2, "0");
    const mm = String(p2).padStart(2, "0");
    return `${dd}-${mm}-${yyyy}`;
  }

  // Match YYYY-MM-DD or YYYY/MM/DD (optionally followed by T or space and time)
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(.*)$/);
  if (isoMatch) {
    const yyyy = isoMatch[1];
    const mm = isoMatch[2].padStart(2, "0");
    const dd = isoMatch[3].padStart(2, "0");
    return `${dd}-${mm}-${yyyy}`;
  }

  // Try standard Date parsing as fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const dd = String(parsed.getDate()).padStart(2, "0");
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const yyyy = parsed.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  return str;
}

/**
 * Converts a date string in DD-MM-YYYY (or any format) into ISO standard YYYY-MM-DD
 * for backend API submission and HTML date inputs.
 */
export function toISODate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Match DD-MM-YYYY or DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) {
    let p1 = parseInt(m[1], 10);
    let p2 = parseInt(m[2], 10);
    const yyyy = m[3];
    // If p1 <= 12 and p2 > 12, user typed MM-DD-YYYY
    if (p1 <= 12 && p2 > 12) {
      const dd = String(p2).padStart(2, "0");
      const mm = String(p1).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
    const dd = String(p1).padStart(2, "0");
    const mm = String(p2).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // Fallback to Date parse
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return s;
}

/**
 * Returns today's date in YYYY-MM-DD format (ideal for form initial state).
 */
export function getTodayISODate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns today's date in DD-MM-YYYY format.
 */
export function getTodayDDMMYYYY(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}`;
}
