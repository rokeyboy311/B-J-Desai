import { executeApiAction } from './api';

export async function createContractorCost(data: {
  locationId: string | number;
  contractorName: string;
  teamName?: string;
  amount: number;
  deductionAmount?: number;
  paymentStatus?: string;
  workDescription?: string;
  workName?: string;
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
  date?: string;
}) {
  return await executeApiAction('CREATE_CONTRACTOR_COST', data);
}

export async function fetchContractorCosts(locationId?: string | number) {
  return await executeApiAction('GET_CONTRACTOR_COSTS', { locationId });
}
