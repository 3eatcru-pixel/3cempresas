import React, { useEffect, useMemo, useState } from 'react';
import { QrCode, ShieldCheck, Send } from 'lucide-react';
import { Store } from '../../../types';
import { useEcosystem } from '../../../context/EcosystemContext';
import { getPlatformAdapters } from '../../../core/platform/PlatformAdapter';
import { AutoServiceTableSelector } from './autoservice/AutoServiceTableSelector';
import { AutoServiceOpenBillPanel } from './autoservice/AutoServiceOpenBillPanel';
import { AutoServiceActionsPanel } from './autoservice/AutoServiceActionsPanel';

interface StoreShowcaseAutoServiceProps {
  store: Store;
  currentTable: number;
  onTableChange: (n: number) => void;
  onTabChange: (tab: any) => void;
  onOpenCheckout: () => void;
  showNotification: (msg: string) => void;
  isLightMode: boolean;
}

export const StoreShowcaseAutoService: React.FC<StoreShowcaseAutoServiceProps> = ({
  store,
  currentTable,
  onTableChange,
  onTabChange,
  onOpenCheckout,
  showNotification,
  isLightMode,
}) => {
  const { tables, orders, cart, requestTableBill, logSystemEvent } = useEcosystem();

  const [waiterCallCooldown, setWaiterCallCooldown] = useState(false);
  const [includeServiceFee, setIncludeServiceFee] = useState(true);
  const [splitCount, setSplitCount] = useState(1);
  const [billRequestedLocal, setBillRequestedLocal] = useState<{
    storeId: string;
    tableNumber: number;
  } | null>(null);

  const [qrNonce] = useState(() => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(2);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    }
    return String(Math.floor(1000 + Math.random() * 9000));
  });

  const sessionToken = useMemo(() => {
    const storeTag = String(store.id || 'ST').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'ST';
    return `SES-${storeTag}-M${String(currentTable).padStart(2, '0')}-${qrNonce}`;
  }, [store.id, currentTable, qrNonce]);

  useEffect(() => {
    setBillRequestedLocal(prev =>
      prev && prev.storeId === store.id && prev.tableNumber === currentTable ? prev : null
    );
  }, [store.id, currentTable]);

  const activeTableData = tables.find(
    t => t.tableNumber === currentTable && (!t.storeId || t.storeId === store.id)
  );
  const isBillRequested =
    activeTableData?.status === 'BILL_REQUESTED' ||
    (billRequestedLocal?.storeId === store.id && billRequestedLocal?.tableNumber === currentTable);

  const currentTableOrders = orders.filter(
    o =>
      o.storeId === store.id &&
      o.status !== 'DELIVERED' &&
      o.status !== 'CANCELLED' &&
      (o.tableNumber === currentTable ||
        o.customerName === `Mesa ${currentTable}` ||
        o.code?.includes(`TBL-${currentTable}`))
  );

  const storeCartItems = cart.filter(c => c.menuItem.storeId === store.id);
  const storeCartCount = storeCartItems.reduce((sum, c) => sum + c.quantity, 0);
  const storeCartTotal = storeCartItems.reduce((sum, c) => sum + c.menuItem.price * c.quantity, 0);

  const openBillSubtotal = currentTableOrders
    .filter(o => o.paymentMethod === 'TABLE_BILL' || !o.paymentMethod)
    .reduce((sum, o) => sum + o.total, 0);
  const tableTotalConsumed = currentTableOrders.reduce((sum, o) => sum + o.total, 0);
  const unpaidSubtotal = openBillSubtotal > 0 ? openBillSubtotal : 0;
  const serviceFeeAmount = includeServiceFee ? Math.round(unpaidSubtotal * 0.1 * 100) / 100 : 0;
  const finalBillTotal = Math.round((unpaidSubtotal + serviceFeeAmount) * 100) / 100;
  const perPersonAmount = splitCount > 1 ? finalBillTotal / splitCount : finalBillTotal;

  const [publicPixKey, setPublicPixKey] = useState<string>('');

  useEffect(() => {
    if (!store?.id) return;
    let active = true;
    const baseUrl = getPlatformAdapters().network.getApiBaseUrl();
    fetch(`${baseUrl}/store/payment-public-info/${encodeURIComponent(store.id)}`)
      .then(res => (res.ok ? res.json() : null))
      .then(info => {
        if (active && info?.pixKey) {
          setPublicPixKey(String(info.pixKey));
        } else if (active) {
          setPublicPixKey('');
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [store?.id]);

  const pixKey = publicPixKey || store.operationalSettings?.pixKey || store.phone || '';

  const handleCallWaiter = async () => {
    if (waiterCallCooldown) {
      showNotification('Chamada de garçom já efetuada. Aguarde o atendimento.');
      return;
    }

    setWaiterCallCooldown(true);
    await logSystemEvent(
      'WAITER_CALLED',
      `Chamada de garçom para Mesa ${currentTable} (Sessão: ${sessionToken})`,
      'service/waiter'
    );
    showNotification(`Garçom acionado para a Mesa ${String(currentTable).padStart(2, '0')}!`);

    setTimeout(() => {
      setWaiterCallCooldown(false);
    }, 30000);
  };

  const handleRequestBill = async () => {
    if (currentTableOrders.length === 0 && storeCartTotal > 0) {
      showNotification('Envie primeiro os itens pendentes da bandeja para a comanda da mesa.');
      onOpenCheckout();
      return;
    }

    const ok = await requestTableBill(
      store.id,
      currentTable,
      includeServiceFee,
      splitCount,
      finalBillTotal
    );
    if (ok) {
      setBillRequestedLocal({ storeId: store.id, tableNumber: currentTable });
    }
  };

  const handleCopyPix = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(pixKey).catch(() => {});
    }
    showNotification(`Chave PIX copiada: ${pixKey}`);
  };

  return (
    <div
      className={`p-6 sm:p-8 rounded-3xl border space-y-6 shadow-xl max-w-3xl mx-auto animate-fadeIn ${
        isLightMode ? 'bg-white border-stone-200 text-stone-900' : 'bg-slate-900 border-slate-800 text-white'
      }`}
    >
      {/* Header Info */}
      <div className="text-center space-y-2 max-w-md mx-auto">
        <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20 shadow-inner">
          <QrCode className="w-8 h-8" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <h3 className={`text-xl font-black uppercase tracking-tight ${isLightMode ? 'text-stone-900' : 'text-white'}`}>
            Comanda Digital na Mesa
          </h3>
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
        </div>
        <p className={`text-xs leading-relaxed ${isLightMode ? 'text-stone-600' : 'text-slate-400'}`}>
          Sessão vinculada à mesa sem taxa de entrega. Envie rodadas direto para a cozinha de{' '}
          <strong className={isLightMode ? 'text-stone-900' : 'text-white'}>{store.name}</strong> e feche a conta no final.
        </p>
      </div>

      {/* Pending Cart Items Notice */}
      {storeCartTotal > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-black uppercase text-amber-400">
              {storeCartCount} {storeCartCount === 1 ? 'item aguardando envio' : 'itens aguardando envio'} para a Mesa {String(currentTable).padStart(2, '0')}
            </div>
            <p className="text-[11px] text-slate-300">
              Subtotal na bandeja: <strong className="font-mono text-white">R$ {storeCartTotal.toFixed(2)}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCheckout}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-xl tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar Rodada p/ Cozinha</span>
          </button>
        </div>
      )}

      <AutoServiceTableSelector
        storeId={store.id}
        tables={tables}
        currentTable={currentTable}
        sessionToken={sessionToken}
        isLightMode={isLightMode}
        onSelectTable={n => {
          onTableChange(n);
          showNotification(`Sessão ativada na Mesa ${String(n).padStart(2, '0')}`);
        }}
      />

      <AutoServiceOpenBillPanel
        currentTable={currentTable}
        currentTableOrders={currentTableOrders}
        tableTotalConsumed={tableTotalConsumed}
        unpaidSubtotal={unpaidSubtotal}
        includeServiceFee={includeServiceFee}
        setIncludeServiceFee={setIncludeServiceFee}
        serviceFeeAmount={serviceFeeAmount}
        finalBillTotal={finalBillTotal}
        splitCount={splitCount}
        setSplitCount={setSplitCount}
        perPersonAmount={perPersonAmount}
        isBillRequested={isBillRequested}
        pixKey={pixKey}
        onCopyPix={handleCopyPix}
      />

      <AutoServiceActionsPanel
        storeSlug={store.slug}
        currentTable={currentTable}
        sessionToken={sessionToken}
        isLightMode={isLightMode}
        waiterCallCooldown={waiterCallCooldown}
        isBillRequested={isBillRequested}
        onGoToMenu={() => {
          onTabChange('CARDAPIO');
          showNotification(`Cardápio da Mesa ${String(currentTable).padStart(2, '0')} pronto para pedir!`);
        }}
        onCallWaiter={handleCallWaiter}
        onRequestBill={handleRequestBill}
      />
    </div>
  );
};
