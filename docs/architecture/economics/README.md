# Economia do Ecossistema — 3C Corp SaaS

Este documento define o **modelo econômico oficial do ecossistema 3C Corp SaaS**, detalhando como a plataforma (**HQ Central / DEV_OWNER**) fatura, como os **lojistas de hospitalidade e comércio (Store OS)** monetizam produtos físicos e serviços, e como operam os fluxos de comissão, mídia/destaque pago e integrações com canais externos (estilo **iFood**, **Uber Eats** e **Deliveroo**).

---

## 1. Tese Central de Separação Econômica

A sustentabilidade do ecossistema depende de uma fronteira clara entre o que cada camada vende:

| Camada / Produto | O que vende | Quem paga | Onde é governado |
| :--- | :--- | :--- | :--- |
| **HQ Central (Plataforma)** | Software (Store OS), infraestrutura, audiência do Marketplace, mídia/destaque e conectores | Lojistas / Empresas | HQ Central (`DEV_OWNER`) |
| **OS Lojista + Vitrine** | Produtos físicos, gastronomia, reservas, salão e serviços de hospitalidade | Consumidor final | Store OS do estabelecimento |
| **Marketplace (Consumidor)** | Descoberta, conveniência, recomendações, pedidos e rastreio | Consumidor (pedido + frete) / Lojista (comissão + destaque) | Governado no HQ, operado no Server Core |
| **App Motorista** | Execução logística (entrega local) | Frete pago no pedido (consumidor ou subsídio da loja) | Server Core + App Motorista |

> **Princípio fundamental:** O HQ **nunca** vende produtos físicos nem opera o caixa diário do estabelecimento. O HQ vende a **experiência e a infraestrutura da plataforma**; o lojista vende **seus produtos e serviços de hospitalidade**.

---

## 2. Como o Ecossistema (`DEV_OWNER` / HQ) Fatura

A plataforma possui **5 pilares de receita** governados centralmente no HQ Central e validados pelo Server Core:

### 2.1. Assinaturas SaaS do Store OS (MRR Previsível)
Cobrança recorrente pelo sistema operacional empresarial (PDV, KDS, mesas, comandas, estoque, financeiro, CRM, vitrine e operação offline via 3C Edge Node).

| Plano (`SubscriptionPlanTier`) | Mensal (R$) | Trimestral (R$/mês) | Anual (R$/mês) | Limite de Filiais | Limite de Terminais |
| :--- | ---: | ---: | ---: | ---: | ---: |
| `FREE` (7 dias degustação) | 0,00 | 0,00 | 0,00 | 1 | 2 |
| `PROMO` (Micro) | 49,90 | 44,91 | 37,43 | 1 | 3 |
| `BASIC` (Loja Única) | 149,00 | 134,10 | 111,75 | 1 | 5 |
| `PRO` (Multifiliais) | 299,00 | 269,10 | 224,25 | 2 | 15 |
| `ENTERPRISE` (Redes & Franquias) | 499,00 | 449,10 | 374,25 | 5 | 999 |

- Configurado em **HQ Central → Planos & Billing** (`PlatformGovernance.planPricing` e `billingConfig`).
- Suporte a PIX direto, cartão de crédito/débito, boleto, link de pagamento e webhook PSP.

### 2.2. Comissão do Marketplace (Take-Rate Transacional)
Percentual configurado pelo `DEV_OWNER` (`globalCommissionRate`, padrão configurável de `0%` a `50%`) aplicado **exclusivamente** sobre pedidos originados pela audiência do **Marketplace**.

- **Diferencial estratégico para hospitalidade:**
  - Vendas no **PDV presencial**, **balcão** e **mesas via App do Garçom** operam com **0% de comissão de marketplace**.
  - O lojista só paga take-rate quando o Marketplace entrega um novo pedido/consumidor digital.

### 2.3. Mídia & Destaque Pago no Marketplace (Sponsored Placements / Ads)
Modelo consagrado em **iFood Ads**, **Uber Eats Sponsored Listings** e **Deliveroo Marketer**, em que o lojista contrata visibilidade adicional na audiência do Marketplace:

| Formato (`MarketplacePlacementType`) | Posição na Experiência do Consumidor | Preço Base Padrão (`spotlightPricing`) | Transparência ao Consumidor |
| :--- | :--- | ---: | :--- |
| `HERO_BANNER` | Banner principal no topo do Marketplace com título, subtítulo e CTA direto para a vitrine | R$ 299,00 / mês | Selo discreto `Patrocinado` |
| `RECOMMENDED_CAROUSEL` | Posições prioritárias na faixa **"Recomendados para você"** | R$ 149,00 / mês | Selo discreto `Patrocinado` |
| `CATEGORY_TOP` | Prioridade no topo da descoberta da categoria | R$ 99,00 / mês | Selo discreto `Patrocinado` |

- Governado em **HQ Central → Gestão do Marketplace → Banners & Destaques Pagos** (`marketplaceConfig.sponsoredPlacements` e `spotlightPricing`).
- A API pública (`/api/v1/system/public-config`) **nunca** expõe ao consumidor os valores B2B (`monthlyFee`) nem termos do HQ — entrega apenas os dados editoriais e o selo público `Patrocinado`.

### 2.4. Hub de Integrações com Canais Externos (Add-on Mensal)
Para estabelecimentos de hospitalidade que também recebem pedidos fora do ecossistema, o HQ governa conectores oficiais no painel **Gestão do Marketplace → Canais Externos & Curadoria**:

| Conector (`ExternalDeliveryProviderId`) | Função no Store OS | Add-on Base Sugerido (R$/mês) |
| :--- | :--- | ---: |
| `IFOOD` | Sincronização de cardápio e injeção de pedidos no KDS/PDV | R$ 79,00 |
| `UBER_EATS` | Unificação de pedidos Uber Eats Direct & Delivery no Store OS | R$ 79,00 |
| `DELIVEROO` | Integração de pedidos e cardápio para hospitalidade | R$ 89,00 |
| `RAPPI` | Sincronização de pedidos e disponibilidade | R$ 69,00 |
| `NINETY_NINE_FOOD` | Conector de pedidos e catálogo | R$ 59,00 |

- O `DEV_OWNER` controla quais canais estão habilitados no ecossistema, o valor do add-on mensal e eventual taxa de ecossistema (`revenueSharePercent`).

### 2.5. Logística & Tarifa Dinâmica (Frota da Plataforma)
- `defaultPlatformDeliveryFee` (padrão `R$ 6,90`) + flag `dynamicSurgePricingEnabled` para picos de demanda.
- Quando o estabelecimento utiliza **frota própria** (`STORE_FLEET`), define sua própria taxa (`ownFleetCustomFee`) e fica com o repasse logístico interno.
- Quando utiliza **frota da plataforma**, a taxa de entrega remunera o entregador via **App Motorista** e eventuais regras de subsídio/margem da plataforma.

---

## 3. Como o Lojista Fatura no Setor de Hospitalidade

O **OS Lojista** atende o ciclo completo de estabelecimentos de hospitalidade e comércio — **restaurantes, bares, cafés, hamburguerias, pizzarias, hotéis/pousadas, catering e serviços sob reserva**:

1. **Salão, Mesas & Comandas (App Garçom + PDV):**
   - Pedidos lançados direto na mesa, enviados ao KDS da cozinha/bar e fechados no caixa.
   - **Comissão de Marketplace: 0%** (custo limitado à assinatura SaaS fixa).
2. **Retirada no Balcão & Autoatendimento (QR Code na Mesa):**
   - Consumidor escaneia o QR Code da mesa ou faz pedido para retirada pela vitrine do estabelecimento.
3. **Delivery pelo Marketplace 3C:**
   - Aquisição de novos clientes via busca, geolocalização, banner e recomendações.
   - Opção de contratar **Destaque Pago** nos horários/semanas estratégicas (ex.: sexta à noite, lançamentos, festivais).
4. **Reservas & Serviços de Hospitalidade:**
   - Agendamento de mesas, eventos privados, pacotes de hospedagem ou serviços especializados diretamente pela aba de reservas da vitrine.
5. **Canais Externos Agregados (iFood / Uber Eats / Deliveroo):**
   - O lojista não precisa operar 4 tablets diferentes no balcão; o hub consolida os canais em uma única fila de cozinha/KDS, estoque e caixa.

---

## 4. Simulação Comparativa (DRE Unitária de um Restaurante Parceiro)

Exemplo ilustrativo de um restaurante com **R$ 80.000/mês** de faturamento bruto total (R$ 50.000 em salão/balcão + R$ 30.000 em delivery):

| Rubrica | Operando só em Apps Terceiros (~23% delivery) | Operando no Ecossistema 3C (Plano `PRO` + Comissão 8% + Destaque) |
| :--- | ---: | ---: |
| Vendas Salão / Mesas / Balcão | R$ 50.000,00 (sem sistema integrado) | R$ 50.000,00 (**0% comissão**) |
| Vendas Delivery / Marketplace | R$ 30.000,00 | R$ 30.000,00 |
| Assinatura SaaS (`PRO`) | R$ 0,00 (paga ERP separado ~R$ 350) | **- R$ 299,00** (receita HQ) |
| Comissão sobre Delivery | - R$ 6.900,00 (23%) | **- R$ 2.400,00** (8% — receita HQ) |
| Campanha Destaque Recomendados | - R$ 400,00 (Ads externo) | **- R$ 149,00** (receita HQ) |
| Add-on Conector iFood (opcional) | — | **- R$ 79,00** (receita HQ) |
| **Custo Total de Plataforma** | **R$ 7.650,00 (9,6% do bruto)** | **R$ 2.927,00 (3,7% do bruto)** |
| **Receita do HQ com este Lojista** | — | **R$ 2.927,00 / mês** |

**Resultado ganha-ganha:**
- O **lojista** economiza mais de **R$ 4.700/mês** mantendo base própria de clientes, PDV offline-first e vitrine própria.
- O **HQ (`DEV_OWNER`)** combina receita previsível (SaaS + Add-ons + Mídia) com receita escalável (Take-Rate do Marketplace), atingindo alta margem operacional.

---

## 5. Mapeamento Técnico no Código

- **Contratos de Tipos (`packages/shared-types/src/index.ts`):**
  - `PlatformGovernance.planPricing`, `billingConfig`, `globalCommissionRate`, `defaultPlatformDeliveryFee`
  - `MarketplaceGovernanceConfig` (`spotlightPricing`, `sponsoredPlacements`, `externalChannelConnectors`, `recommendationsTitle`, `featuredStoreIds`, `hiddenStoreIds`)
- **Persistência & Validação (`src/server/routes/admin/governanceCore.ts` e `src/server/routes/store/marketplaceGrowthCore.ts`):**
  - `PUT /api/v1/admin/governance` (exclusivo `DEV_OWNER`, sanitização completa e trilha de auditoria `HQ_GOVERNANCE_UPDATE`)
  - `GET /api/v1/store/marketplace-growth`, `POST /api/v1/store/marketplace-growth/spotlight-request` e `PUT /api/v1/store/marketplace-growth/external-channels` (isolamento estrito por `tenantId`/`storeId`, preço oficial calculado no servidor)
- **Exposição Pública Isolada (`src/server/routes/system.ts`):**
  - `GET /api/v1/system/public-config` expõe banners/recomendações ativos sem vazar valores B2B (`monthlyFee = 0` e `externalChannelConnectors = []` no payload público)
- **Painel de Controle HQ (`src/modules/hq-central/HqMarketplaceTab.tsx`):**
  - Sub-aba **Experiência & Economia** (`HqMarketplaceExperienceForm`)
  - Sub-aba **Banners & Destaques Pagos** (`HqMarketplaceSponsoredPanel`, com aprovação em 1 clique das solicitações dos lojistas)
  - Sub-aba **Canais Externos & Curadoria** (`HqMarketplaceExternalChannelsPanel` + `HqMarketplaceVitrinesTable`)
- **Painel do Lojista no Store OS (`src/modules/store-os/showcase-config/ShowcaseMarketplaceGrowthPanel.tsx`):**
  - Aba **Destaque no Marketplace & Canais Externos** dentro da Vitrine Comercial (sem expor termos do HQ): solicitação de campanhas de destaque e conexão de canais externos habilitados
- **Experiência do Consumidor (`src/modules/marketplace/layout/MarketplaceSpotlightSection.tsx`):**
  - Renderiza Banner Principal patrocinado + Carrossel **"Recomendados para você"** com selo discreto `Patrocinado` / `Destaque`.
