/**
 * Transport-Agnostic Binary ESC/POS Encoder (CP850 Portuguese + GS ( k QR Code + RJ11 Drawer + Partial Cut).
 * Works identically across Node, Browser (WebSerial/WebBluetooth), Tauri 2 Rust IPC, and Edge LAN TCP 9100.
 */

export const ESC = 0x1b;
export const GS = 0x1d;
export const LF = 0x0a;

export type EscPosAlign = 'left' | 'center' | 'right';
export type EscPosPaperWidth = '80mm' | '58mm';

export interface EscPosReceiptItem {
  name: string;
  quantity: number;
  price: number;
  notes?: string;
  variantLabel?: string;
  serialNumber?: string;
}

export interface BuildEscPosReceiptOptions {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  fiscalHeader?: string;
  orderCode: string;
  orderDate: string;
  customerName: string;
  deliveryAddress?: string;
  tableNumber?: number;
  scheduledDeliveryDate?: string;
  scheduledDeliveryPeriod?: string;
  assemblyRequired?: boolean;
  items: EscPosReceiptItem[];
  subtotal: number;
  deliveryFee?: number;
  discount?: number;
  total: number;
  paymentMethod: string;
  pixKey?: string;
  pixBrCode?: string;
  paperWidth?: EscPosPaperWidth;
  autoCut?: boolean;
  openCashDrawer?: boolean;
  footerMessage?: string;
}

// Portuguese & Multilingual Code Page 850 (ESC t 2) mapping
const CP850_CHAR_MAP: Record<string, number> = {
  'Ç': 0x80,
  'ü': 0x81,
  'é': 0x82,
  'â': 0x83,
  'ä': 0x84,
  'à': 0x85,
  'å': 0x86,
  'ç': 0x87,
  'ê': 0x88,
  'ë': 0x89,
  'è': 0x8a,
  'ï': 0x8b,
  'î': 0x8c,
  'ì': 0x8d,
  'Ä': 0x8e,
  'Å': 0x8f,
  'É': 0x90,
  'ô': 0x93,
  'ö': 0x94,
  'ò': 0x95,
  'û': 0x96,
  'ù': 0x97,
  'Ö': 0x99,
  'Ü': 0x9a,
  'á': 0xa0,
  'í': 0xa1,
  'ó': 0xa2,
  'ú': 0xa3,
  'ñ': 0xa4,
  'Ñ': 0xa5,
  'ª': 0xa6,
  'º': 0xa7,
  '¿': 0xa8,
  'Á': 0xb5,
  'Â': 0xb6,
  'À': 0xb7,
  'ã': 0xc6,
  'Ã': 0xc7,
  'Í': 0xd6,
  'Î': 0xd7,
  'Ì': 0xde,
  'Ó': 0xe0,
  'Ô': 0xe2,
  'Ò': 0xe3,
  'õ': 0xe4,
  'Õ': 0xe5,
  'Ú': 0xe9,
  'Û': 0xea,
  'Ù': 0xeb,
  '°': 0xf8,
  '•': 0x2a,
  '–': 0x2d,
  '—': 0x2d,
};

export function encodeCp850(text: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const mapped = CP850_CHAR_MAP[ch];
    if (mapped !== undefined) {
      bytes.push(mapped);
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code >= 0x20 && code <= 0x7e) {
      bytes.push(code);
    } else if (code === 0x0a || code === 0x0d || code === 0x09) {
      bytes.push(code);
    } else {
      const stripped = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const fallback = stripped ? stripped.charCodeAt(0) : 0x3f;
      bytes.push(fallback >= 0x20 && fallback <= 0x7e ? fallback : 0x3f);
    }
  }
  return Uint8Array.from(bytes);
}

/**
 * Generates RJ11 cash drawer kick pulse bytes (ESC p m t1 t2).
 * Pin 2 (m=0) is standard across Epson/Bematech/Elgin/Daruma thermal printers.
 */
export function buildCashDrawerPulseBytes(pin: 2 | 5 = 2): Uint8Array {
  const m = pin === 5 ? 0x01 : 0x00;
  return Uint8Array.from([ESC, 0x70, m, 0x19, 0xfa]);
}

/**
 * Generates native ESC/POS Model 2 QR Code print sequence (GS ( k).
 */
export function buildEscPosQrCodeBytes(payload: string, moduleSize = 5): Uint8Array {
  const cleanPayload = (payload || '').trim();
  if (!cleanPayload) return new Uint8Array(0);

  const dataBytes = Array.from(encodeCp850(cleanPayload));
  const storeLen = dataBytes.length + 3;
  const pL = storeLen & 0xff;
  const pH = (storeLen >> 8) & 0xff;
  const safeSize = Math.max(3, Math.min(8, Math.round(moduleSize)));

  return Uint8Array.from([
    // 1. Select QR Code Model 2
    GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,
    // 2. Module Size (3..8)
    GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, safeSize,
    // 3. Error Correction Level M (49 = '1')
    GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31,
    // 4. Store payload in symbol storage
    GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30,
    ...dataBytes,
    // 5. Print stored symbol
    GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,
  ]);
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function alignCommand(align: EscPosAlign): Uint8Array {
  const code = align === 'center' ? 1 : align === 'right' ? 2 : 0;
  return Uint8Array.from([ESC, 0x61, code]);
}

function boldCommand(enabled: boolean): Uint8Array {
  return Uint8Array.from([ESC, 0x45, enabled ? 1 : 0]);
}

function sizeCommand(doubleWidth: boolean, doubleHeight: boolean): Uint8Array {
  const val = (doubleWidth ? 0x10 : 0) | (doubleHeight ? 0x01 : 0);
  return Uint8Array.from([GS, 0x21, val]);
}

function formatLeftRightLine(left: string, right: string, cols: number): string {
  const cleanLeft = left.trim();
  const cleanRight = right.trim();
  const maxLeft = Math.max(4, cols - cleanRight.length - 1);
  const clippedLeft = cleanLeft.length > maxLeft ? cleanLeft.slice(0, maxLeft) : cleanLeft;
  const spaces = Math.max(1, cols - clippedLeft.length - cleanRight.length);
  return `${clippedLeft}${' '.repeat(spaces)}${cleanRight}`;
}

export function buildEscPosPlainTextBytes(
  content: string,
  options?: { autoCut?: boolean; openCashDrawer?: boolean }
): Uint8Array {
  const chunks: Uint8Array[] = [
    Uint8Array.from([ESC, 0x40]), // Initialize
    Uint8Array.from([ESC, 0x74, 0x02]), // Code Page 850
    encodeCp850(content.endsWith('\n') ? content : `${content}\n`),
    Uint8Array.from([ESC, 0x64, 0x04]), // Feed 4 lines
  ];
  if (options?.openCashDrawer) {
    chunks.push(buildCashDrawerPulseBytes(2));
  }
  if (options?.autoCut !== false) {
    chunks.push(Uint8Array.from([GS, 0x56, 0x42, 0x00])); // Partial cut
  }
  return concatUint8Arrays(chunks);
}

export function buildEscPosReceiptBytes(options: BuildEscPosReceiptOptions): Uint8Array {
  const cols = options.paperWidth === '58mm' ? 32 : 48;
  const divider = '-'.repeat(cols);
  const chunks: Uint8Array[] = [];

  const pushLine = (text = '') => {
    chunks.push(encodeCp850(`${text}\n`));
  };

  // Initialize printer & select CP850
  chunks.push(Uint8Array.from([ESC, 0x40]));
  chunks.push(Uint8Array.from([ESC, 0x74, 0x02]));

  // Header
  chunks.push(alignCommand('center'));
  chunks.push(boldCommand(true));
  chunks.push(sizeCommand(false, true));
  pushLine(options.storeName.toUpperCase().slice(0, cols));
  chunks.push(sizeCommand(false, false));
  chunks.push(boldCommand(false));

  if (options.storeAddress) pushLine(options.storeAddress.slice(0, cols));
  if (options.storePhone) pushLine(`Tel: ${options.storePhone}`.slice(0, cols));
  if (options.fiscalHeader) pushLine(options.fiscalHeader.toUpperCase().slice(0, cols));
  pushLine(divider);

  // Order metadata
  chunks.push(alignCommand('left'));
  chunks.push(boldCommand(true));
  pushLine(formatLeftRightLine(`PEDIDO: ${options.orderCode}`, options.orderDate.split(' ')[1] || '', cols));
  chunks.push(boldCommand(false));
  pushLine(`DATA: ${options.orderDate}`);
  pushLine(`CLIENTE: ${options.customerName.slice(0, cols - 9)}`);
  if (options.tableNumber) {
    chunks.push(boldCommand(true));
    pushLine(`MESA: #${options.tableNumber}`);
    chunks.push(boldCommand(false));
  } else if (options.deliveryAddress) {
    pushLine(`ENTREGA: ${options.deliveryAddress}`);
  } else {
    pushLine('ATENDIMENTO: BALCAO');
  }
  if (options.scheduledDeliveryDate) {
    pushLine(
      `AGENDADO: ${options.scheduledDeliveryDate} (${options.scheduledDeliveryPeriod || 'TARDE'})${
        options.assemblyRequired ? ' + MONTAGEM' : ''
      }`
    );
  }
  pushLine(divider);

  // Items
  chunks.push(boldCommand(true));
  pushLine(formatLeftRightLine('QTD ITEM', 'TOTAL', cols));
  chunks.push(boldCommand(false));
  for (const item of options.items) {
    const lineTotal = `R$ ${(item.price * item.quantity).toFixed(2)}`;
    pushLine(formatLeftRightLine(`${item.quantity}x ${item.name}`, lineTotal, cols));
    if (item.variantLabel) pushLine(`   Var: ${item.variantLabel}`.slice(0, cols));
    if (item.serialNumber) pushLine(`   S/N: ${item.serialNumber}`.slice(0, cols));
    if (item.notes) pushLine(`   Obs: ${item.notes}`.slice(0, cols));
  }
  pushLine(divider);

  // Totals
  pushLine(formatLeftRightLine('Subtotal:', `R$ ${options.subtotal.toFixed(2)}`, cols));
  if (options.deliveryFee) {
    pushLine(formatLeftRightLine('Taxa Entrega:', `R$ ${options.deliveryFee.toFixed(2)}`, cols));
  }
  if (options.discount) {
    pushLine(formatLeftRightLine('Desconto:', `-R$ ${options.discount.toFixed(2)}`, cols));
  }
  chunks.push(boldCommand(true));
  chunks.push(sizeCommand(false, true));
  pushLine(formatLeftRightLine('TOTAL A PAGAR:', `R$ ${options.total.toFixed(2)}`, cols));
  chunks.push(sizeCommand(false, false));
  chunks.push(boldCommand(false));
  pushLine(divider);

  // Payment & PIX QR Code (GS ( k)
  pushLine(formatLeftRightLine('FORMA PGTO:', options.paymentMethod.toUpperCase(), cols));
  if (options.pixKey) {
    pushLine(`CHAVE PIX: ${options.pixKey}`.slice(0, cols));
  }
  if (options.pixBrCode) {
    chunks.push(alignCommand('center'));
    pushLine('');
    chunks.push(boldCommand(true));
    pushLine('PAGUE COM PIX QR CODE');
    chunks.push(boldCommand(false));
    chunks.push(buildEscPosQrCodeBytes(options.pixBrCode, options.paperWidth === '58mm' ? 4 : 5));
    pushLine('');
  }

  // Footer
  chunks.push(alignCommand('center'));
  pushLine(options.footerMessage || 'Obrigado pela preferencia!');
  pushLine('3C Corp Ecosystem');

  // Feed + Optional Cash Drawer + Partial Cut
  chunks.push(Uint8Array.from([ESC, 0x64, 0x04]));
  if (options.openCashDrawer) {
    chunks.push(buildCashDrawerPulseBytes(2));
  }
  if (options.autoCut !== false) {
    chunks.push(Uint8Array.from([GS, 0x56, 0x42, 0x00]));
  }

  return concatUint8Arrays(chunks);
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

export function uint8ArrayToLatin1String(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}
