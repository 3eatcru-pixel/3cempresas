import { apiClient } from '../core/api/apiClient';
import { getPlatformAdapters } from '../core/platform/PlatformAdapter';

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function getActiveAuthToken(): string | undefined {
  const token = getPlatformAdapters().storage.getItem('3ccorp_auth_token');
  return token && token.trim() ? token.trim() : undefined;
}

function fallbackDescription(dishName: string, storeCategory: string): string {
  return `${dishName}: preparo artesanal na categoria ${storeCategory}, feito com ingredientes selecionados e padrão premium de qualidade.`;
}

function fallbackInventoryDepletion(
  storeName: string,
  lowStockItems: { name: string; stock: number; minAlert: number }[]
): string {
  if (!lowStockItems.length) {
    return `Estoque IA (${storeName} • Offline): nenhum item crítico encontrado no momento.`;
  }
  const lines = lowStockItems.slice(0, 4).map((item) => {
    const suggestedQty = Math.max((item.minAlert || 5) * 2 - (item.stock || 0), 5);
    return `• ${item.name}: repor ${suggestedQty} un. (atual ${item.stock} / alerta ${item.minAlert})`;
  });
  return `Sugestão de Compra Offline (${storeName}):\n${lines.join('\n')}`;
}

function fallbackBusinessPerformance(
  gmv: number,
  totalOrders: number,
  saasRevenue: number,
  topStore: string
): string {
  const avgTicket = totalOrders > 0 ? gmv / totalOrders : 0;
  return [
    `1. Volume GMV de R$ ${gmv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em ${totalOrders} pedidos (ticket médio R$ ${avgTicket.toFixed(2)}).`,
    `2. Receita SaaS acumulada de R$ ${saasRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}; explore upgrades multi-filial para ampliar MRR.`,
    `3. Loja líder "${topStore}" concentra maior tração — replique combos e cupons dela nas demais unidades.`,
  ].join('\n');
}

function fallbackPricing(costPrice: number): { suggestedPrice: number; justification: string } {
  const safeCost = Number.isFinite(costPrice) && costPrice > 0 ? costPrice : 10;
  return {
    suggestedPrice: Number((safeCost * 3.2).toFixed(2)),
    justification: 'Sugestão offline com Markup 3.2x (~68.7% de margem bruta).',
  };
}

function fallbackDiscovery(
  query: string,
  availableStores: { name: string; category: string; rating: number }[]
): string {
  const q = query.trim().toLowerCase();
  const matched =
    availableStores.find(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    ) || availableStores[0];
  if (matched) {
    return `Recomendamos "${matched.name}" (${matched.category}, ${matched.rating.toFixed(1)}★) para "${query || 'seu pedido'}"!`;
  }
  return `Encontramos ótimas opções para "${query || 'você'}" no Marketplace.`;
}

export async function generateSmartMenuDescription(dishName: string, storeCategory: string): Promise<string> {
  const token = getActiveAuthToken();
  if (isBrowserOffline() || !token) {
    return fallbackDescription(dishName, storeCategory);
  }
  try {
    const data = await apiClient.callGeminiProxy(
      `Gere uma descrição curta, irresistível e apetitosa (máximo 25 palavras) em Português do Brasil para o produto/prato "${dishName}" da categoria "${storeCategory}". Responda apenas com o texto da descrição.`,
      token
    );
    return data.text?.trim() || fallbackDescription(dishName, storeCategory);
  } catch {
    return fallbackDescription(dishName, storeCategory);
  }
}

export async function predictInventoryDepletionAI(
  storeName: string,
  lowStockItems: { name: string; stock: number; minAlert: number }[]
): Promise<string> {
  const token = getActiveAuthToken();
  if (isBrowserOffline() || !token) {
    return fallbackInventoryDepletion(storeName, lowStockItems);
  }
  try {
    const prompt = `Você é o Diretor de Suprimentos IA do ecossistema 3C Commerce OS para a loja ${storeName}.
Itens em estoque crítico: ${JSON.stringify(lowStockItems)}

Gere uma sugestão de Pedido de Compra (máximo 4 linhas) com quantidades exatas a repor para garantir o funcionamento da operação sem interrupções.`;

    const data = await apiClient.callGeminiProxy(prompt, token);
    return data.text?.trim() || fallbackInventoryDepletion(storeName, lowStockItems);
  } catch {
    return fallbackInventoryDepletion(storeName, lowStockItems);
  }
}

export async function analyzeBusinessPerformanceAI(
  gmv: number,
  totalOrders: number,
  saasRevenue: number,
  topStore: string
): Promise<string> {
  const token = getActiveAuthToken();
  if (isBrowserOffline() || !token) {
    return fallbackBusinessPerformance(gmv, totalOrders, saasRevenue, topStore);
  }
  try {
    const prompt = `Você é o Consultor Executivo de Inteligência do Ecossistema SaaS 3C Commerce / 3C Commerce OS.
Dados atuais do ecossistema:
- GMV Total: R$ ${gmv.toFixed(2)}
- Total de Pedidos: ${totalOrders}
- Receita de Assinaturas & Comissões SaaS: R$ ${saasRevenue.toFixed(2)}
- Loja com Maior Volume: ${topStore}

Forneça um relatório executivo sucinto (em 3 tópicos acionáveis com dados numéricos) sobre como otimizar a receita do Ultra Admin e a rentabilidade dos lojistas.`;

    const data = await apiClient.callGeminiProxy(prompt, token);
    return data.text?.trim() || fallbackBusinessPerformance(gmv, totalOrders, saasRevenue, topStore);
  } catch {
    return fallbackBusinessPerformance(gmv, totalOrders, saasRevenue, topStore);
  }
}

export async function suggestSmartPricingAI(
  productName: string,
  costPrice: number,
  category: string,
  storeCategory: string
): Promise<{ suggestedPrice: number; justification: string }> {
  const token = getActiveAuthToken();
  if (isBrowserOffline() || !token) {
    return fallbackPricing(costPrice);
  }
  try {
    const prompt = `Você é um Especialista em Engenharia de Menu e Precificação.
Produto: "${productName}"
Custo de Produção (CMV): R$ ${costPrice.toFixed(2)}
Categoria: "${category}"
Tipo de Loja: "${storeCategory}"

Analise o custo e sugira um Preço de Venda Final (com margem de lucro saudável entre 60% e 75% bruta). 
Responda em formato JSON: { "suggestedPrice": number, "justification": "string curta (máximo 15 palavras)" }`;

    const data = await apiClient.callGeminiProxy(prompt, token);
    const cleaned = (data.text || '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const price = Number(parsed.suggestedPrice);
    if (!Number.isFinite(price) || price <= 0) {
      return fallbackPricing(costPrice);
    }
    return {
      suggestedPrice: Number(price.toFixed(2)),
      justification: parsed.justification || 'Margem padrão de mercado aplicada.',
    };
  } catch {
    return fallbackPricing(costPrice);
  }
}

export async function smartDiscoveryWithMeta(
  query: string,
  availableStores: { name: string; category: string; rating: number }[]
): Promise<{ text: string; usedFallback: boolean }> {
  const token = getActiveAuthToken();
  if (isBrowserOffline() || !token) {
    return { text: fallbackDiscovery(query, availableStores), usedFallback: true };
  }
  try {
    const prompt = `Você é o Concierge Digital do Marketplace.
Desejo do Cliente: "${query}"
Lojas disponíveis: ${JSON.stringify(availableStores)}

Com base no desejo, sugira a melhor categoria ou loja específica (máximo 20 palavras). Seja entusiasmado e direto.`;

    const data = await apiClient.callGeminiProxy(prompt, token);
    const liveText = data.text?.trim();
    if (!liveText) {
      return { text: fallbackDiscovery(query, availableStores), usedFallback: true };
    }
    return {
      text: liveText,
      usedFallback: Boolean((data as any).isSimulatedFallback || (data as any).source === 'OFFLINE_DETERMINISTIC_FALLBACK'),
    };
  } catch {
    return { text: fallbackDiscovery(query, availableStores), usedFallback: true };
  }
}

export async function smartDiscoveryAI(
  query: string,
  availableStores: { name: string; category: string; rating: number }[]
): Promise<string> {
  const res = await smartDiscoveryWithMeta(query, availableStores);
  return res.text;
}
