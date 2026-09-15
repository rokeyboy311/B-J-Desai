/**
 * @file src/shared/financialYear.ts
 * Dynamic Indian Financial Year calculations.
 * Indian Financial Year runs from April 1 to March 31.
 * Pure TypeScript with ZERO external dependencies.
 */

export interface FYDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;     // e.g. "FY 2026-27"
  value: string;     // e.g. "2026-2027"
}

export class FinancialYearService {
  /**
   * Computes the Indian Financial Year string (e.g., '2026-2027') for any given date.
   * If no date is provided, defaults to current date.
   */
  static getFinancialYear(dateInput?: Date | string): string {
    const date = dateInput ? new Date(dateInput) : new Date();
    const month = date.getMonth() + 1; // 1-indexed: 1 = Jan, 4 = Apr
    const year = date.getFullYear();
    const startYear = month >= 4 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
  }

  /**
   * Generates display label like "FY 2026-27".
   */
  static getFYLabel(fyString?: string): string {
    const fy = fyString || this.getFinancialYear();
    const parts = fy.split('-');
    if (parts.length === 2 && parts[1].length === 4) {
      return `FY ${parts[0]}-${parts[1].slice(2)}`;
    }
    return `FY ${fy}`;
  }

  /**
   * Returns start date (YYYY-04-01) and end date (YYYY-03-31) for a given FY string.
   */
  static getFYDateRange(fyString?: string): FYDateRange {
    const fy = fyString || this.getFinancialYear();
    const [startYearStr, endYearStr] = fy.split('-');
    const startYear = parseInt(startYearStr, 10);
    const endYear = parseInt(endYearStr, 10) || startYear + 1;

    return {
      startDate: `${startYear}-04-01`,
      endDate: `${endYear}-03-31`,
      label: this.getFYLabel(fy),
      value: `${startYear}-${endYear}`,
    };
  }

  /**
   * Generates a list of recent financial years for dropdown filters.
   * e.g., current year, 2 previous years, 1 future year.
   */
  static getAvailableFinancialYears(range: number = 2): FYDateRange[] {
    const currentFY = this.getFinancialYear();
    const currentStartYear = parseInt(currentFY.split('-')[0], 10);

    const list: FYDateRange[] = [];
    for (let y = currentStartYear + 1; y >= currentStartYear - range; y--) {
      list.push(this.getFYDateRange(`${y}-${y + 1}`));
    }
    return list;
  }
}
