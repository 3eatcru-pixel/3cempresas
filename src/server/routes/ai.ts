import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { db, runWithSystemDbContext } from '../config.ts';
import { verifyAutonomousToken } from '../middleware/auth.ts';

const router = express.Router();

const ALLOWED_ACTIVE_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-4-argon',
  'gemini-4-carbon',
]);

function buildOfflineFallback(prompt: string): string {
  if (prompt.includes('Engenharia de Menu e Precificação')) {
    const costMatch = prompt.match(/CMV\):\s*R\$\s*([\d.,]+)/i);
    const rawCost = costMatch ? Number(costMatch[1].replace(',', '.')) : 15;
    const cost = Number.isFinite(rawCost) && rawCost > 0 ? rawCost : 15;
    const suggestedPrice = Number((cost * 3.2).toFixed(2));
    return JSON.stringify({
      suggestedPrice,
      justification: 'Markup offline de 3.2x aplicado (~68.7% de margem bruta saudável).',
    });
  }

  if (prompt.includes('descrição curta')) {
    const dishMatch = prompt.match(/prato\s+"([^"]+)"/i);
    const dish = dishMatch?.[1] || 'Especial da Casa';
    return `${dish}: preparado artesanalmente com ingredientes selecionados e toque especial da cozinha.`;
  }

  if (prompt.includes('Diretor de Suprimentos IA')) {
    const itemsMatch = prompt.match(/Itens em estoque crítico:\s*(\[[\s\S]*?\])/i);
    if (itemsMatch?.[1]) {
      try {
        const items = JSON.parse(itemsMatch[1]) as { name?: string; stock?: number; minAlert?: number }[];
        if (Array.isArray(items) && items.length > 0) {
          const lines = items.slice(0, 4).map((item) => {
            const min = Number(item.minAlert) || 5;
            const current = Number(item.stock) || 0;
            const qty = Math.max(min * 2 - current, 5);
            return `• ${item.name || 'Insumo'}: repor ${qty} un. (atual ${current} / mín. ${min})`;
          });
          return `Sugestão de Pedido de Compra (Modo Offline):\n${lines.join('\n')}`;
        }
      } catch {
        // Fallback summary below
      }
    }
    return 'Sugestão de Pedido de Compra (Modo Offline): priorize a reposição imediata dos insumos abaixo do alerta mínimo.';
  }

  if (prompt.includes('Consultor Executivo de Inteligência')) {
    return [
      '1. Receita SaaS: priorize upgrades de lojas PRO para planos multi-filial Enterprise.',
      '2. Ticket Médio: ative combos e upsell inteligente no PDV e vitrine Marketplace.',
      '3. Retenção: acompanhe lojas com queda de volume semanal com campanhas CRM automatizadas.',
    ].join('\n');
  }

  if (prompt.includes('Concierge Digital do Marketplace')) {
    const queryMatch = prompt.match(/Desejo do Cliente:\s*"([^"]+)"/i);
    const storesMatch = prompt.match(/Lojas disponíveis:\s*(\[[\s\S]*?\])/i);
    const query = queryMatch?.[1] || '';
    if (storesMatch?.[1]) {
      try {
        const stores = JSON.parse(storesMatch[1]) as { name?: string; category?: string; rating?: number }[];
        if (Array.isArray(stores) && stores.length > 0) {
          const qLower = query.toLowerCase();
          const matched =
            stores.find(
              (s) =>
                (s.name || '').toLowerCase().includes(qLower) ||
                (s.category || '').toLowerCase().includes(qLower)
            ) || stores[0];
          return `Recomendação offline: ${matched.name} (${matched.category || 'Destaque'}) — avaliação ${matched.rating ?? 4.8}★!`;
        }
      } catch {
        // Fallback text below
      }
    }
    return query
      ? `Encontramos ótimas lojas disponíveis para "${query}" no Marketplace.`
      : 'Confira as lojas abertas com entrega rápida no Marketplace!';
  }

  if (prompt.includes('mensagem curta de WhatsApp')) {
    const storeMatch = prompt.match(/loja\s+"([^"]+)"/i);
    const storeName = storeMatch?.[1] || '{{storeName}}';
    return `Olá {{name}}! Temos novidades especiais esperando por você hoje na ${storeName} ({{storeName}}). Aproveite e faça seu pedido!`;
  }

  return 'Assistente 3C Commerce operando em modo offline determinístico.';
}

router.post('/gemini', verifyAutonomousToken, async (req, res) => {
  try {
    const govData = await runWithSystemDbContext('AI_GOVERNANCE_KILL_SWITCH', async () => {
      const govSnap = await db.collection('governance').doc('governance').get();
      return govSnap.exists ? govSnap.data() : null;
    });
    if (govData?.featureFlags?.aiEngineEnabled === false) {
      return res.status(403).json({
        error: 'Motor de IA desativado globalmente pela governança da plataforma.',
      });
    }

    const { prompt, model } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || prompt.length > 10000) {
      return res.status(400).json({ error: 'Prompt inválido ou muito longo.' });
    }

    const selectedModel =
      typeof model === 'string' && ALLOWED_ACTIVE_MODELS.has(model)
        ? model
        : 'gemini-4-hydrogen';

    const apiKey = process.env.GEMINI_API_KEY;
    const hasConfiguredKey = Boolean(
      apiKey && apiKey.trim() && apiKey !== 'MY_GEMINI_API_KEY' && !apiKey.startsWith('your_')
    );

    if (hasConfiguredKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: prompt,
        });
        const liveText = response.text?.trim();
        if (liveText) {
          return res.json({
            text: liveText,
            model: selectedModel,
            source: 'GEMINI_LIVE',
            isSimulatedFallback: false,
          });
        }
      } catch (genErr: any) {
        const reason = genErr?.message ? String(genErr.message).split('\n')[0] : 'network_or_api_error';
        console.warn(`[Gemini AI] Fallback offline ativado (${reason}).`);
      }
    }

    return res.json({
      text: buildOfflineFallback(prompt),
      model: selectedModel,
      source: 'OFFLINE_DETERMINISTIC_FALLBACK',
      isSimulatedFallback: true,
    });
  } catch {
    return res.status(200).json({
      text: 'Assistente 3C Commerce disponível em modo offline.',
      source: 'OFFLINE_DETERMINISTIC_FALLBACK',
      isSimulatedFallback: true,
    });
  }
});

export default router;
