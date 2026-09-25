import { executeApiAction } from './api';

export const PIN_KEY = 'bd_erp_pin_token';

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const res = await executeApiAction('VERIFY_PIN', { pin });
    if (res.success) {
      sessionStorage.setItem(PIN_KEY, pin);
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

export async function updatePin(oldPin: string, newPin: string): Promise<boolean> {
  const res = await executeApiAction('UPDATE_PIN', { oldPin, newPin });
  return res.success;
}

export function isPinVerified(): boolean {
  return !!sessionStorage.getItem(PIN_KEY);
}

export function clearPinAuth(): void {
  sessionStorage.removeItem(PIN_KEY);
}
