import React, { useMemo, useState } from 'react';
import { Bell, CheckCircle2, MessageSquare, Settings2, Users } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { apiClient } from '../../../core/api/apiClient';
import { CouponCampaign, CustomerCRM, Order } from '../../../types';
import { WhatsAppAudienceSidebar } from './layout/WhatsAppAudienceSidebar';
import { CampaignType, WhatsAppCampaignBuilder } from './layout/WhatsAppCampaignBuilder';
import { WhatsAppDispatchFooter } from './layout/WhatsAppDispatchFooter';
import { WhatsAppConnectModal } from './layout/WhatsAppConnectModal';
import { WhatsAppOrderTriggersTab } from './layout/WhatsAppOrderTriggersTab';
import { WhatsAppDispatchHistoryCard } from './layout/WhatsAppDispatchHistoryCard';
import { buildWaUrl, useWhatsAppConnector } from './hooks/useWhatsAppConnector';

const DEFAULT_CAMPAIGN_TEMPLATES: Record<CampaignType, string> = {
  RE_ENGAGEMENT:
    'Olá {{name}}, quanto tempo! Sentimos sua falta aqui no {{storeName}}. Aproveite para conferir as novidades de hoje!',
  PROMO:
    'Novidade no {{storeName}}, {{name}}! Acabamos de liberar ofertas especiais no cardápio de hoje. Faça seu pedido direto conosco!',
  LOYALTY:
    'Olá {{name}}! Obrigado por ser cliente especial do {{storeName}}. Preparamos uma condição exclusiva para o seu próximo pedido!',
};

export const WhatsAppMarketingApp: React.FC = () => {
  const { customersCrm, orders, coupons, currentStore, showNotification } = useEcosystem();
  const [activeTab, setActiveTab] = useState<'CAMPAIGNS' | 'TRIGGERS'>('CAMPAIGNS');
  const [selectedCampaignType, setSelectedCampaignType] = useState<CampaignType>('RE_ENGAGEMENT');
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatedMessage, setGeneratedMessage] = useState(DEFAULT_CAMPAIGN_TEMPLATES.RE_ENGAGEMENT);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [currentSendingIndex, setCurrentSendingIndex] = useState<number | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const {
    connectorConfig,
    orderTriggers,
    isDispatchingApi,
    dispatchHistory,
    appendDispatchLog,
    dispatchViaServerApi,
    saveConnectorConfig,
    testConnector,
    saveOrderTrigger,
  } = useWhatsAppConnector(currentStore.id, showNotification);

  const storeCustomers = useMemo(
    () => customersCrm.filter((c) => c.storeId === currentStore.id),
    [customersCrm, currentStore.id]
  );

  const activeStoreCoupons = useMemo(
    () =>
      coupons.filter(
        (cp) =>
          !cp._deleted &&
          cp.isActive &&
          cp.audience !== 'MERCHANT' &&
          cp.storeId === currentStore.id
      ),
    [coupons, currentStore.id]
  );

  const recentStoreOrders = useMemo(
    () =>
      orders
        .filter((o) => o.storeId === currentStore.id && Boolean(o.customerPhone))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8),
    [orders, currentStore.id]
  );

  const handleSelectCampaignType = (nextType: CampaignType) => {
    setSelectedCampaignType(nextType);
    setGeneratedMessage(DEFAULT_CAMPAIGN_TEMPLATES[nextType]);
  };

  const handleInsertCouponCode = (coupon: CouponCampaign) => {
    const discountDesc =
      coupon.discountType === 'PERCENT'
        ? `${coupon.discountValue}% OFF`
        : `R$ ${Number(coupon.discountValue || 0).toFixed(2)} OFF`;
    const snippet = `\nUse o cupom ${coupon.code} (${discountDesc}${
      coupon.minOrderValue > 0 ? ` em pedidos acima de R$ ${coupon.minOrderValue.toFixed(2)}` : ''
    }).`;
    setGeneratedMessage((prev) => `${prev.trim()}${snippet}`);
  };

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    const base = generatedMessage.trim() || DEFAULT_CAMPAIGN_TEMPLATES[selectedCampaignType];
    const localTemplate =
      DEFAULT_CAMPAIGN_TEMPLATES[selectedCampaignType] +
      (aiPrompt.trim() ? `\n\n${aiPrompt.trim()}` : '');

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setGeneratedMessage(localTemplate);
      showNotification('Modo offline — template local aplicado.');
      setIsGenerating(false);
      return;
    }

    const promptText = [
      `Crie uma mensagem curta de WhatsApp em português brasileiro para clientes da loja "${currentStore.name}" (${currentStore.category}).`,
      `Objetivo da campanha: ${selectedCampaignType}.`,
      `Mantenha as variáveis {{name}} e {{storeName}} exatamente como estão.`,
      aiPrompt.trim() ? `Instrução do lojista: ${aiPrompt.trim()}` : '',
      `Modelo base de referência: ${base}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await apiClient.callGeminiProxy(promptText);
      const aiText = response?.text?.trim();
      if (aiText) {
        setGeneratedMessage(aiText);
        showNotification('Mensagem refinada com sucesso.');
      } else {
        setGeneratedMessage(localTemplate);
        showNotification('Template padrão aplicado.');
      }
    } catch {
      setGeneratedMessage(localTemplate);
      showNotification('Template local aplicado.');
    } finally {
      setIsGenerating(false);
    }
  };

  const buildPersonalizedMessage = (customer: CustomerCRM) =>
    generatedMessage
      .replace(/{{name}}/g, customer.name)
      .replace(/{{storeName}}/g, currentStore.name)
      .replace(/{{days}}/g, '15')
      .replace(/{{productName}}/g, 'Novidade da Semana');

  const processCustomerAtIndex = async (idx: number) => {
    const customer = storeCustomers.find((c) => c.id === selectedCustomers[idx]);
    if (!customer) return;
    const personalized = buildPersonalizedMessage(customer);

    if (connectorConfig.mode !== 'WA_ME') {
      await dispatchViaServerApi(customer.phone, personalized, customer.name);
      return;
    }

    appendDispatchLog({
      customerName: customer.name,
      phone: customer.phone,
      mode: 'WA_ME',
      status: 'OPENED_WA_ME',
      detail: 'Link wa.me preparado',
    });
  };

  const startSendingFlow = async () => {
    if (selectedCustomers.length === 0 || !generatedMessage.trim()) return;
    setCurrentSendingIndex(0);
    await processCustomerAtIndex(0);
  };

  const nextCustomer = async () => {
    if (currentSendingIndex === null || currentSendingIndex >= selectedCustomers.length - 1) {
      setCurrentSendingIndex(null);
      showNotification('Fila de campanha concluída.');
      return;
    }
    const nextIdx = currentSendingIndex + 1;
    setCurrentSendingIndex(nextIdx);
    await processCustomerAtIndex(nextIdx);
  };

  const handleDispatchToOrder = async (order: Order, messageText: string) => {
    if (!order.customerPhone) return;
    await dispatchViaServerApi(
      order.customerPhone,
      messageText,
      order.customerName,
      order.code || order.id
    );
  };

  const toggleCustomer = (id: string) => {
    setSelectedCustomers((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const activeSendingCustomer =
    currentSendingIndex !== null
      ? storeCustomers.find((c) => c.id === selectedCustomers[currentSendingIndex]) || null
      : null;
  const activeWaHref = activeSendingCustomer
    ? buildWaUrl(activeSendingCustomer.phone, buildPersonalizedMessage(activeSendingCustomer))
    : null;
  const previewCustomer =
    storeCustomers.find((c) => c.id === selectedCustomers[0]) || storeCustomers[0];

  return (
    <div className="flex flex-col h-full bg-[#0a0e17] text-slate-300">
      <header className="p-4 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <MessageSquare size={20} />
          </div>
          <div>
            <h1 className="text-base font-black text-white leading-none">
              WhatsApp Comercial &amp; Gatilhos
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {connectorConfig.mode === 'WA_ME'
                ? 'Modo Híbrido · Links diretos wa.me (zero custo)'
                : `Modo Híbrido · ${connectorConfig.mode} conectado no Server Core`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('CAMPAIGNS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'CAMPAIGNS'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users size={13} /> Campanhas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('TRIGGERS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'TRIGGERS'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bell size={13} /> Gatilhos de Pedido
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsConnectModalOpen(true)}
            className="text-xs font-bold px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {connectorConfig.mode !== 'WA_ME' ? (
              <CheckCircle2 size={14} className="text-emerald-400" />
            ) : (
              <Settings2 size={14} className="text-amber-400" />
            )}
            Conector ({connectorConfig.mode === 'WA_ME' ? 'wa.me' : connectorConfig.mode})
          </button>
        </div>
      </header>

      {activeTab === 'CAMPAIGNS' ? (
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          <WhatsAppAudienceSidebar
            customers={storeCustomers}
            selectedCustomers={selectedCustomers}
            onToggleCustomer={toggleCustomer}
            onSelectSubset={setSelectedCustomers}
          />

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            <WhatsAppCampaignBuilder
              selectedCampaignType={selectedCampaignType}
              onSelectCampaignType={handleSelectCampaignType}
              aiPrompt={aiPrompt}
              setAiPrompt={setAiPrompt}
              isGenerating={isGenerating}
              onGenerateAI={handleGenerateAI}
              generatedMessage={generatedMessage}
              onChangeGeneratedMessage={setGeneratedMessage}
              activeStoreCoupons={activeStoreCoupons}
              onInsertCouponCode={handleInsertCouponCode}
              previewCustomerName={previewCustomer?.name}
              storeName={currentStore.name}
            />

            <WhatsAppDispatchFooter
              selectedCount={selectedCustomers.length}
              currentSendingIndex={currentSendingIndex}
              currentCustomerName={activeSendingCustomer?.name}
              currentWaHref={activeWaHref}
              connectorMode={connectorConfig.mode}
              isDispatchingApi={isDispatchingApi}
              hasGeneratedMessage={Boolean(generatedMessage.trim())}
              onNextCustomer={() => void nextCustomer()}
              onStartSending={() => void startSendingFlow()}
            />

            <WhatsAppDispatchHistoryCard dispatchHistory={dispatchHistory} />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <WhatsAppOrderTriggersTab
            currentStore={currentStore}
            triggers={orderTriggers}
            recentOrders={recentStoreOrders}
            connectorMode={connectorConfig.mode}
            onSaveTrigger={saveOrderTrigger}
            onDispatchToOrder={handleDispatchToOrder}
          />
        </div>
      )}

      <WhatsAppConnectModal
        isOpen={isConnectModalOpen}
        storeName={currentStore.name}
        currentConfig={connectorConfig}
        onClose={() => setIsConnectModalOpen(false)}
        onSaveConfig={saveConnectorConfig}
        onTestConnection={testConnector}
      />
    </div>
  );
};
