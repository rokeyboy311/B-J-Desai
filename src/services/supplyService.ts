import { executeApiAction } from './api';

export async function createCustomerSupply(data: {
  locationId: string | number;
  partyName: string;
  materialName: string;
  quantity: number;
  unit?: string;
  rate: number;
  transportCost?: number;
  discount?: number;
  taxPercentage?: number;
  paidAmount?: number;
  paymentMethod?: string;
  referenceNumber?: string;
  invoiceNumber?: string;
  address?: string;
  notes?: string;
  date?: string;
}) {
  return await executeApiAction('CREATE_CUSTOMER_SUPPLY', data);
}

export async function createSiteSupply(data: {
  locationId: string | number;
  teamId?: string | number;
  teamName?: string;
  materialName: string;
  quantity: number;
  unit?: string;
  rate: number;
  responsiblePerson?: string;
  workDescription?: string;
  referenceNumber?: string;
  notes?: string;
  date?: string;
}) {
  return await executeApiAction('CREATE_SITE_SUPPLY', data);
}
