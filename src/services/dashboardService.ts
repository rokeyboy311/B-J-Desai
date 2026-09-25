import { executeApiAction } from './api';

export async function fetchDashboardData() {
  return await executeApiAction('GET_DASHBOARD');
}

export async function fetchBootstrapData() {
  return await executeApiAction('GET_BOOTSTRAP_DATA');
}
