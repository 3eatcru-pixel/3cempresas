import crypto from 'crypto';

export const PAIRING_ADMIN_ROLES = [
  'DEV_OWNER',
  'SUPER_ADMIN',
  'REGIONAL_MANAGER',
  'STORE_OWNER',
  'STORE_MANAGER',
  'CASHIER',
];
export const PAIRING_PIN_MAX_ATTEMPTS = 5;
export const PAIRING_PIN_LOCKOUT_MS = 15 * 60 * 1000;

export function generatePairingPin(): string {
  const digits = String(crypto.randomInt(100000, 999999));
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}`;
}

export function normalizePairingPin(raw: unknown): string {
  return String(raw || '').replace(/[^0-9]/g, '');
}
