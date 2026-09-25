import { executeApiAction } from './api';

export interface MaterialStockItem {
  materialName: string;
  unit: string;
  purchasedQty: number;
  suppliedQty: number;
  currentStock: number;
  avgRate: number;
  totalValue: number;
}

export async function fetchMaterialStock(): Promise<MaterialStockItem[]> {
  return await executeApiAction<MaterialStockItem[]>('GET_MATERIAL_STOCK');
}

export async function createMaterialPurchase(data: {
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
  gst?: string;
  address?: string;
  notes?: string;
  date?: string;
}) {
  return await executeApiAction('CREATE_MATERIAL_PURCHASE', data);
}
