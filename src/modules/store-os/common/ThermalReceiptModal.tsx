import React, { useMemo, useState } from 'react';
import { Printer, Smartphone, Copy, Check, Usb, Bluetooth, KeyRound } from 'lucide-react';
import { Store } from '../../../types';
import { ThermalPaperPreview } from './thermal/ThermalPaperPreview';
import { generateWhatsAppReceiptText } from './thermal/thermalReceiptUtils';
import { ThermalModalHeaderControls } from './thermal/ThermalModalHeaderControls';
import {
  buildEscPosReceiptBytes,
  connectWebBluetoothPrinter,
  connectWebSerialPrinter,
  getBrowserHardwareCapabilities,
  getPlatformAdapters,
} from '../../../core/platform/PlatformAdapter';
import { generateEmvCoPixPayload } from '../../../utils/pix';

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    code: string;
    customerName: string;
    customerPhone?: string;
    deliveryAddress?: string;
    items: {
      name: string;
      quantity: number;
      price: number;
      notes?: string;
      variantLabel?: string;
      serialNumber?: string;
    }[];
    subtotal: number;
    deliveryFee?: number;
    discount?: number;
    total: number;
    paymentMethod: string;
    createdAt?: string;
    notes?: string;
    tableNumber?: number;
    scheduledDeliveryDate?: string;
    scheduledDeliveryPeriod?: string;
    assemblyRequired?: boolean;
  };
  store: Store;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  isOpen,
  onClose,
  order,
  store,
}) => {
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [copied, setCopied] = useState(false);
  const [openDrawerOnPrint, setOpenDrawerOnPrint] = useState(false);
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [hwCaps, setHwCaps] = useState(() => getBrowserHardwareCapabilities());

  const pixKey =
    store.operationalSettings?.pixKey || store.phone || '00.000.000/0001-99';

  const orderDate = useMemo(
    () =>
      order.createdAt
        ? new Date(order.createdAt).toLocaleString('pt-BR')
        : new Date().toLocaleString('pt-BR'),
    [order.createdAt]
  );

  const pixBrCode = useMemo(
    () =>
      generateEmvCoPixPayload({
        pixKey,
        amount: order.total,
        merchantName: store.name,
        txid: order.code,
        description: `Pedido ${order.code}`,
      }),
    [pixKey, order.total, store.name, order.code]
  );

  if (!isOpen) return null;

  const refreshCaps = () => setHwCaps(getBrowserHardwareCapabilities());

  const handleConnectWebSerial = async () => {
    try {
      const res = await connectWebSerialPrinter(9600);
      refreshCaps();
      setPrintStatus(`Impressora USB/Serial conectada (${res.info || 'WebSerial'}).`);
    } catch (err: any) {
      setPrintStatus(err?.message || 'Conexão USB/Serial cancelada.');
    }
  };

  const handleConnectWebBluetooth = async () => {
    try {
      const res = await connectWebBluetoothPrinter();
      refreshCaps();
      setPrintStatus(`Impressora Bluetooth pareada (${res.name}).`);
    } catch (err: any) {
      setPrintStatus(err?.message || 'Pareamento Bluetooth cancelado.');
    }
  };

  const handleOpenCashDrawer = async () => {
    try {
      const printer = getPlatformAdapters().printer;
      const res = printer.openCashDrawer
        ? await printer.openCashDrawer()
        : { opened: false, mode: 'BROWSER_PRINT' as const };
      if (res.opened) {
        setPrintStatus(`Pulso RJ11 de abertura de gaveta enviado (${res.mode}).`);
      } else {
        setPrintStatus('Conecte uma impressora USB/Serial, Bluetooth ou Tauri LAN para abrir a gaveta.');
      }
    } catch {
      setPrintStatus('Falha ao enviar pulso RJ11 para gaveta.');
    }
  };

  const handlePrint = async () => {
    try {
      const textFallback = decodeURIComponent(
        generateWhatsAppReceiptText(order, store, orderDate, pixKey)
      );
      const fallbackCityState = store.city
        ? `${store.city}${store.state ? ` - ${store.state}` : ''}`
        : 'Endereço não configurado';
      const escposBytes = buildEscPosReceiptBytes({
        storeName: store.name,
        storeAddress: store.address || fallbackCityState,
        storePhone: store.phone || 'Telefone não informado',
        fiscalHeader: store.operationalSettings?.autoNfce
          ? 'DOCUMENTO AUXILIAR NFC-e'
          : 'EXTRATO NAO FISCAL DE VENDA',
        orderCode: order.code,
        orderDate,
        customerName: order.customerName,
        deliveryAddress: order.deliveryAddress,
        tableNumber: order.tableNumber,
        scheduledDeliveryDate: order.scheduledDeliveryDate,
        scheduledDeliveryPeriod: order.scheduledDeliveryPeriod,
        assemblyRequired: order.assemblyRequired,
        items: order.items,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        discount: order.discount,
        total: order.total,
        paymentMethod: order.paymentMethod,
        pixKey,
        pixBrCode,
        paperWidth,
        autoCut: true,
        openCashDrawer: openDrawerOnPrint,
      });

      const printer = getPlatformAdapters().printer;
      const res = printer.printEscPosBytes
        ? await printer.printEscPosBytes(escposBytes, textFallback)
        : await printer.printEscPosText(textFallback);

      if (res.mode === 'TAURI_ESCPOS' && res.printed) {
        setPrintStatus(`Cupom binário (${escposBytes.length}B + QR PIX) enviado via Tauri ESC/POS.`);
      } else if (res.mode === 'WEB_SERIAL_ESCPOS' && res.printed) {
        setPrintStatus(`Cupom binário (${escposBytes.length}B + QR PIX) impresso via USB/WebSerial.`);
      } else if (res.mode === 'WEB_BLUETOOTH_ESCPOS' && res.printed) {
        setPrintStatus(`Cupom binário (${escposBytes.length}B + QR PIX) impresso via WebBluetooth.`);
      } else if (res.mode === 'CAPACITOR_BT' && res.printed) {
        setPrintStatus('Cupom binário enviado para impressora Bluetooth nativa.');
      } else if (res.printed) {
        setPrintStatus('Diálogo de impressão do navegador aberto (conecte WebSerial/BLE para zero-spooler).');
      } else {
        setPrintStatus('Impressora física não detectada neste ambiente.');
      }
    } catch {
      setPrintStatus('Falha ao acionar dispositivo de impressão.');
    }
  };

  const rawPhone = (order.customerPhone || store.phone || '').replace(/\D/g, '');
  const cleanPhone = rawPhone.length === 11 ? `55${rawPhone}` : rawPhone;
  const whatsappText = generateWhatsAppReceiptText(order, store, orderDate, pixKey);
  const whatsappUrl =
    cleanPhone.length >= 10
      ? `https://wa.me/${cleanPhone}?text=${whatsappText}`
      : `https://wa.me/?text=${whatsappText}`;

  const handleCopyText = () => {
    const text = decodeURIComponent(generateWhatsAppReceiptText(order, store, orderDate, pixKey));
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white animate-fadeIn">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-slip-area, #thermal-slip-area * {
            visibility: visible;
          }
          #thermal-slip-area {
            position: absolute;
            left: 0;
            top: 0;
            width: ${paperWidth === '80mm' ? '76mm' : '54mm'};
            margin: 0;
            padding: 8px;
            color: #000;
            background: #fff;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh] no-print">
        <ThermalModalHeaderControls
          paperWidth={paperWidth}
          setPaperWidth={setPaperWidth}
          onClose={onClose}
        />

        <div className="flex-1 overflow-y-auto p-6 flex justify-center bg-slate-950/60 custom-scrollbar">
          <ThermalPaperPreview
            order={order}
            store={store}
            paperWidth={paperWidth}
            orderDate={orderDate}
            pixKey={pixKey}
          />
        </div>

        {(hwCaps.webSerialSupported || hwCaps.webBluetoothSupported) && (
          <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <div className="flex items-center gap-1.5 flex-wrap">
              {hwCaps.webSerialSupported && (
                <button
                  type="button"
                  onClick={() => void handleConnectWebSerial()}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 border cursor-pointer transition-colors ${
                    hwCaps.serialPrinterConnected
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  <Usb className="w-3 h-3" />
                  <span>{hwCaps.serialPrinterConnected ? 'USB/Serial Ativo' : 'Parear USB/Serial'}</span>
                </button>
              )}
              {hwCaps.webBluetoothSupported && (
                <button
                  type="button"
                  onClick={() => void handleConnectWebBluetooth()}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 border cursor-pointer transition-colors ${
                    hwCaps.bluetoothPrinterConnected
                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  <Bluetooth className="w-3 h-3" />
                  <span>
                    {hwCaps.bluetoothPrinterConnected
                      ? hwCaps.bluetoothPrinterName || 'Bluetooth Ativo'
                      : 'Parear Bluetooth'}
                  </span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={openDrawerOnPrint}
                  onChange={(e) => setOpenDrawerOnPrint(e.target.checked)}
                  className="accent-amber-500"
                />
                <span>Abrir gaveta</span>
              </label>
              <button
                type="button"
                onClick={() => void handleOpenCashDrawer()}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold flex items-center gap-1 cursor-pointer"
                title="Enviar pulso RJ11 imediato para abertura da gaveta"
              >
                <KeyRound className="w-3 h-3" />
                <span>Gaveta</span>
              </button>
            </div>
          </div>
        )}

        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap gap-2 justify-between items-center">
          <div className="flex gap-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow cursor-pointer"
              title="Disparar cupom completo para o WhatsApp do cliente"
            >
              <Smartphone className="w-4 h-4" />
              <span>WhatsApp</span>
            </a>
            <button
              onClick={handleCopyText}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>

          <button
            onClick={() => void handlePrint()}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Térmica ({paperWidth})</span>
          </button>
        </div>
        {printStatus && (
          <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 text-[10px] text-amber-300 font-medium text-center">
            {printStatus}
          </div>
        )}
      </div>
    </div>
  );
};
