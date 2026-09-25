import { executeApiAction } from './api';

export interface LocationItem {
  id: string | number;
  name: string;
  address?: string;
  createdAt: string;
  totalInvestment: number;
  totalPurchases: number;
  totalSiteSupply: number;
  totalLabourCost: number;
  totalContractorCost: number;
  totalSupervisorCost: number;
  totalExpenses: number;
  availableBalance: number;
}

export async function fetchLocations(): Promise<LocationItem[]> {
  return await executeApiAction<LocationItem[]>('GET_LOCATIONS');
}

export async function createLocation(data: { name: string; address?: string }) {
  return await executeApiAction('CREATE_LOCATION', data);
}
