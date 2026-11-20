export interface EmvCoPixOptions {
  pixKey: string;
  amount?: number;
  merchantName?: string;
  merchantCity?: string;
  txid?: string;
  txId?: string;
  description?: string;
}

function formatEmvTag(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

export function crc16Ccitt(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Standard Central Bank of Brazil (BACEN) EMVCo BR Code generator.
 * Generates copy-and-paste and QR Code payload with exact TLVs and CRC16-CCITT checksum.
 */
export function generateEmvCoPixPayload(options: EmvCoPixOptions): string {
  const pixKey = (options.pixKey || '').trim();
  const rawAmount = typeof options.amount === 'number' && Number.isFinite(options.amount) ? Math.max(0, options.amount) : 0;
  const merchantName = (options.merchantName || '3C COMMERCE OS')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 25);
  const merchantCity = (options.merchantCity || 'BRASIL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 15);
  const rawTxId = options.txid || options.txId || '***';
  const txid = rawTxId
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 25) || '***';

  // Subtags for Tag 26 (Merchant Account Information)
  let sub26 = formatEmvTag('00', 'br.gov.bcb.pix') + formatEmvTag('01', pixKey);
  if (options.description) {
    const desc = options.description
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .slice(0, 25);
    sub26 += formatEmvTag('02', desc);
  }

  // Subtags for Tag 62 (Additional Data Field Template)
  const sub62 = formatEmvTag('05', txid);

  let payload = '';
  payload += formatEmvTag('00', '01'); // Payload Format Indicator
  payload += formatEmvTag('26', sub26); // Merchant Account Information
  payload += formatEmvTag('52', '0000'); // Merchant Category Code
  payload += formatEmvTag('53', '986'); // Transaction Currency (BRL)
  if (rawAmount > 0) {
    payload += formatEmvTag('54', rawAmount.toFixed(2)); // Transaction Amount
  }
  payload += formatEmvTag('58', 'BR'); // Country Code
  payload += formatEmvTag('59', merchantName); // Merchant Name
  payload += formatEmvTag('60', merchantCity); // Merchant City
  payload += formatEmvTag('62', sub62); // Additional Data

  // Tag 63 (CRC16) header
  const payloadToCrc = `${payload}6304`;
  const checksum = crc16Ccitt(payloadToCrc);

  return `${payloadToCrc}${checksum}`;
}
