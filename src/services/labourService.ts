import { executeApiAction } from './api';

export async function createLabourAttendance(data: {
  locationId: string | number;
  labourName: string;
  labourTeam?: string;
  attendanceType?: string;
  workType?: string;
  days?: number;
  dailyRate?: number;
  tcQuantity?: number;
  tcRate?: number;
  quantity?: number;
  rate?: number;
  otherEarnings?: number;
  deduction?: number;
  upad?: number;
  paymentAmount?: number;
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
  date?: string;
}) {
  return await executeApiAction('CREATE_LABOUR_ATTENDANCE', data);
}

export async function fetchLabourAttendance(locationId?: string | number) {
  return await executeApiAction('GET_LABOUR', { locationId });
}
