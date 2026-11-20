/**
 * WebSerial & WebBluetooth Browser Hardware Transports for 3C Store OS / Waiter / Driver PWA.
 * Enables direct ESC/POS thermal printing & serial scale readings from Chrome/Edge/Android without native wrappers.
 */

export interface BrowserHardwareCapabilities {
  webSerialSupported: boolean;
  webBluetoothSupported: boolean;
  serialPrinterConnected: boolean;
  bluetoothPrinterConnected: boolean;
  serialScaleConnected: boolean;
  bluetoothPrinterName: string | null;
}

let activeSerialPrinterPort: any | null = null;
let activeSerialScalePort: any | null = null;
let activeBluetoothPrinterDevice: any | null = null;
let activeBluetoothTxChar: any | null = null;

// Common BLE GATT thermal printer service & characteristic UUIDs (Epson/Elgin/Xprinter/Sunmi/Generic)
const THERMAL_BLE_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

const THERMAL_BLE_WRITE_CHARS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
];

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof (navigator as any).serial?.requestPort === 'function';
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof (navigator as any).bluetooth?.requestDevice === 'function';
}

export function hasConnectedWebSerialPrinter(): boolean {
  return Boolean(activeSerialPrinterPort?.writable);
}

export function hasConnectedWebBluetoothPrinter(): boolean {
  return Boolean(activeBluetoothPrinterDevice?.gatt?.connected && activeBluetoothTxChar);
}

export function hasConnectedWebSerialScale(): boolean {
  return Boolean(activeSerialScalePort?.readable);
}

export function getBrowserHardwareCapabilities(): BrowserHardwareCapabilities {
  return {
    webSerialSupported: isWebSerialSupported(),
    webBluetoothSupported: isWebBluetoothSupported(),
    serialPrinterConnected: hasConnectedWebSerialPrinter(),
    bluetoothPrinterConnected: hasConnectedWebBluetoothPrinter(),
    serialScaleConnected: hasConnectedWebSerialScale(),
    bluetoothPrinterName: activeBluetoothPrinterDevice?.name || null,
  };
}

export async function connectWebSerialPrinter(baudRate = 9600): Promise<{ connected: boolean; info?: string }> {
  if (!isWebSerialSupported()) {
    throw new Error('WebSerial não suportado neste navegador (use Chrome/Edge desktop).');
  }
  const port = await (navigator as any).serial.requestPort();
  if (!port.readable || !port.writable) {
    await port.open({ baudRate });
  }
  activeSerialPrinterPort = port;
  const info = typeof port.getInfo === 'function' ? port.getInfo() : {};
  const vidPid =
    info?.usbVendorId && info?.usbProductId
      ? `USB ${info.usbVendorId.toString(16)}:${info.usbProductId.toString(16)}`
      : `Serial ${baudRate}bps`;
  return { connected: true, info: vidPid };
}

export async function disconnectWebSerialPrinter(): Promise<void> {
  if (activeSerialPrinterPort) {
    try {
      await activeSerialPrinterPort.close();
    } catch {
      // ignore already closed
    }
    activeSerialPrinterPort = null;
  }
}

export async function writeBytesWebSerialPrinter(bytes: Uint8Array): Promise<boolean> {
  if (!activeSerialPrinterPort?.writable) return false;
  const writer = activeSerialPrinterPort.writable.getWriter();
  try {
    await writer.write(bytes);
    return true;
  } finally {
    writer.releaseLock();
  }
}

export async function connectWebBluetoothPrinter(): Promise<{ connected: boolean; name: string }> {
  if (!isWebBluetoothSupported()) {
    throw new Error('WebBluetooth não suportado neste navegador.');
  }
  const device = await (navigator as any).bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: THERMAL_BLE_SERVICES,
  });
  const server = await device.gatt.connect();

  let foundChar: any = null;
  for (const svcUuid of THERMAL_BLE_SERVICES) {
    try {
      const service = await server.getPrimaryService(svcUuid);
      for (const charUuid of THERMAL_BLE_WRITE_CHARS) {
        try {
          const ch = await service.getCharacteristic(charUuid);
          if (ch?.properties?.write || ch?.properties?.writeWithoutResponse) {
            foundChar = ch;
            break;
          }
        } catch {
          // try next char
        }
      }
      if (!foundChar && typeof service.getCharacteristics === 'function') {
        const chars = await service.getCharacteristics();
        foundChar = chars.find((c: any) => c?.properties?.write || c?.properties?.writeWithoutResponse) || null;
      }
      if (foundChar) break;
    } catch {
      // try next service
    }
  }

  if (!foundChar) {
    await server.disconnect();
    throw new Error('Serviço GATT de impressão térmica ESC/POS não encontrado no dispositivo Bluetooth.');
  }

  activeBluetoothPrinterDevice = device;
  activeBluetoothTxChar = foundChar;
  device.addEventListener?.('gattserverdisconnected', () => {
    activeBluetoothTxChar = null;
  });

  return { connected: true, name: String(device.name || 'Impressora BLE') };
}

export async function disconnectWebBluetoothPrinter(): Promise<void> {
  try {
    activeBluetoothPrinterDevice?.gatt?.disconnect?.();
  } catch {
    // ignore
  }
  activeBluetoothPrinterDevice = null;
  activeBluetoothTxChar = null;
}

export async function writeBytesWebBluetoothPrinter(bytes: Uint8Array): Promise<boolean> {
  if (!activeBluetoothPrinterDevice?.gatt?.connected || !activeBluetoothTxChar) {
    return false;
  }
  // Chunk writes into 120-byte packets to prevent BLE UART buffer overflows on 58mm printers
  const CHUNK_SIZE = 120;
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const slice = bytes.slice(offset, offset + CHUNK_SIZE);
    if (typeof activeBluetoothTxChar.writeValueWithoutResponse === 'function' && activeBluetoothTxChar.properties?.writeWithoutResponse) {
      await activeBluetoothTxChar.writeValueWithoutResponse(slice);
    } else {
      await activeBluetoothTxChar.writeValue(slice);
    }
    if (offset + CHUNK_SIZE < bytes.length) {
      await new Promise((r) => setTimeout(r, 15));
    }
  }
  return true;
}

export async function connectWebSerialScale(baudRate = 9600): Promise<{ connected: boolean }> {
  if (!isWebSerialSupported()) {
    throw new Error('WebSerial não suportado neste navegador.');
  }
  const port = await (navigator as any).serial.requestPort();
  if (!port.readable) {
    await port.open({ baudRate });
  }
  activeSerialScalePort = port;
  return { connected: true };
}

/**
 * Reads a single weight frame from connected Toledo/Filizola serial scale via WebSerial.
 * Parses standard STX/CR formats (e.g. `\x0201250\r` -> 1.250 kg or `ST,GS,+ 1.250kg`).
 */
export async function readWeightFromWebSerialScale(timeoutMs = 1500): Promise<{
  weightKg: number;
  stable: boolean;
  connected: boolean;
  protocol: string;
} | null> {
  if (!activeSerialScalePort?.readable) return null;

  // Some Toledo/Filizola scales expect ENQ (0x05) poll byte before replying
  if (activeSerialScalePort.writable) {
    const writer = activeSerialScalePort.writable.getWriter();
    try {
      await writer.write(Uint8Array.from([0x05]));
    } finally {
      writer.releaseLock();
    }
  }

  const reader = activeSerialScalePort.readable.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const deadline = Date.now() + timeoutMs;

  try {
    while (Date.now() < deadline) {
      const readPromise = reader.read();
      const timeoutPromise = new Promise<{ value?: Uint8Array; done: boolean }>((resolve) =>
        setTimeout(() => resolve({ done: true }), Math.max(50, deadline - Date.now()))
      );
      const { value, done } = await Promise.race([readPromise, timeoutPromise]);
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        // Toledo format: STX (5 digits grams or formatted float) CR
        const decimalMatch = buffer.match(/(\d+[.,]\d{2,3})/);
        if (decimalMatch) {
          const val = parseFloat(decimalMatch[1].replace(',', '.'));
          if (Number.isFinite(val)) {
            return { weightKg: val, stable: !buffer.includes('US'), connected: true, protocol: 'WEB_SERIAL_TOLEDO' };
          }
        }
        const rawGramsMatch = buffer.match(/\x02(\d{5})\r?/);
        if (rawGramsMatch) {
          return {
            weightKg: parseInt(rawGramsMatch[1], 10) / 1000,
            stable: true,
            connected: true,
            protocol: 'WEB_SERIAL_PRIX_5D',
          };
        }
      }
      if (done) break;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
    reader.releaseLock();
  }

  return { weightKg: 0, stable: false, connected: true, protocol: 'WEB_SERIAL_TIMEOUT' };
}
