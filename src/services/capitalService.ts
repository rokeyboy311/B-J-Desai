import { executeApiAction } from './api';

export interface AdminCapitalSummary {
  totalContributed: number;
  totalAllocated: number;
  totalPurchases: number;
  totalWithdrawn: number;
  availableAdminCapital: number;
}

export async function fetchCapitalSummary(): Promise<AdminCapitalSummary> {
  return await executeApiAction<AdminCapitalSummary>('GET_CAPITAL_SUMMARY');
}

export async function transferAdminToInvestor(data: {
  investorId: string | number;
  locationId: string | number;
  amount: number;
  date?: string;
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
}) {
  return await executeApiAction('TRANSFER_ADMIN_TO_INVESTOR', data);
}

export async function transferInvestorToInvestment(data: {
  investorId: string | number;
  locationId: string | number;
  amount: number;
  date?: string;
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
}) {
  return await executeApiAction('TRANSFER_INVESTOR_TO_INVESTMENT', data);
}
