# Pilar 4 — Marketplace (Produto para o Consumidor)

Produto comercial independente voltado exclusivamente ao consumidor final para descobrir estabelecimentos, navegar em vitrines multi-segmento, realizar pedidos e acompanhar entregas em tempo real.

- **Identificador:** `marketplace` (`?app=marketplace`)
- **Identidade visual:** Emerald `#10b981` · `/favicons/marketplace.svg`
- **Código principal:** `src/components/pillars/MarketplacePillar.tsx` · `src/modules/marketplace/*` · `src/context/ConsumerContext.tsx`
- **Rotas de API:** `/api/v1/marketplace/*`

---

## 1. Regra de Ouro de Identidade

O consumidor enxerga o **Marketplace** como um produto completo e independente:
- Possui login e cadastro próprios de consumidor (`CUSTOMER`).
- **Nunca** exibe, menciona ou redireciona para o **HQ Central** ou o **OS Lojista** em sua introdução, navegação ou telas de acompanhamento.
- **Nunca** exibe telemetria técnica interna (como status de conexão SSE, logs de servidor ou IDs internos crus) na interface do cliente.

---

## 2. Experiência do Consumidor e Funcionalidades

### Descoberta, Banner Principal e Recomendações
- Navegação livre por estabelecimentos e vitrines multi-segmento sem obrigar login prévio para explorar catálogos.
- **Banner Principal e Faixa "Recomendados para você" (`MarketplaceSpotlightSection`):** Consome campanhas ativas e destaques via `/api/v1/system/public-config`, exibindo selo transparente `Patrocinado` ou `Destaque` e CTA direto para a vitrine — sem nunca expor valores B2B ou termos internos do HQ.
- Filtros por categoria e segmento com tradução completa para português, além de aviso claro ao consumidor quando o modo somente leitura está ativo.
- **Catálogo sanitizado e preços honestos:** Exibe exclusivamente preços reais definidos pelo lojista (sem preços riscados fictícios ou imagens externas quebradas/simuladas).

### Carrinho e Checkout Atômico
- Suporte a **4 modalidades de pedido:** `DELIVERY`, `PICKUP` (retirada), `DINE_IN` (consumo no local) e `SERVICE` (agendamento/serviço).
- Métodos de pagamento sincronizados automaticamente com os habilitados na vitrine da loja (PIX, Cartão na Entrega/Online, Dinheiro com troco sincronizado nas observações).
- **Trava contra duplo envio:** Bloqueio de submissão concorrente aliado a `Idempotency-Key` no servidor.
- **Limpeza segura do carrinho:** Confirmação em 2 etapas para esvaziar o carrinho.
- Validação de cupons e recalculo integral de valores no servidor (nunca confia em totais enviados pelo cliente).

### Acompanhamento de Pedidos e Área do Consumidor
- Timeline limpa com status traduzidos de ponta a ponta (recebido, em preparo, saiu para entrega, concluído) e exibição segura do PIN de 4 dígitos para confirmação da entrega.
- Histórico de pedidos, endereços salvos e lojas favoritas protegidos por isolamento estrito anti-IDOR (cada consumidor acessa apenas seus próprios registros).

---

## 3. Integração com o Ecossistema

- **Consome da Vitrine (OS Lojista):** Produtos, disponibilidade, preços, horários, formas de pagamento e status de loja aberta/fechada.
- **Envia ao Server Core:** Pedidos validados que disparam atualização imediata no PDV/KDS do lojista e, quando `DELIVERY`, entram no fluxo do **App do Motorista**.
- **Empacotamento:** Disponível como Web/PWA (`npm run build:apps`) com scaffold Android Capacitor pronto para build Gradle local.
