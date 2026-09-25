import { executeApiAction } from './api';

export interface Investor {
  id: string | number;
  name: string;
  mobile?: string;
  email?: string;
  address?: string;
  notes?: string;
  totalCapital: number;
  totalUpad: number;
  totalAllocated: number;
  totalInvested: number;
  availableCapital: number;
  createdAt: string;
}

export async function fetchInvestors(): Promise<Investor[]> {
  return await executeApiAction<Investor[]>('GET_INVESTORS');
}

export async function createInvestor(data: {
  name: string;
  mobile?: string;
  email?: string;
  address?: string;
  notes?: string;
  totalCapital?: number;
  date?: string;
  paymentMethod?: string;
  referenceNumber?: string;
}) {
  return await executeApiAction('CREATE_INVESTOR', data);
}

export async function fetchInvestorPassbook(investorId: string | number) {
  return await executeApiAction('GET_INVESTOR_PASSBOOK', { investorId });
}
