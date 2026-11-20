# Pilar 2 — Server Core (Backbone e Infraestrutura)

Camada tecnológica central que sustenta todos os produtos do ecossistema **3C Corp SaaS**, provendo APIs versionadas (`/api/v1/*`), autenticação, transações atômicas, tempo real (SSE), mapas, sincronização offline-first e integração segura com serviços externos.

- **Identificador:** `server-core`
- **Identidade visual:** Cyan `#06b6d4` · `/favicons/hq.svg`
- **Entry point:** `server.ts` (Express na porta `3000`, montando `vite.middlewares` em desenvolvimento e arquivos estáticos em produção)
- **Código principal:** `src/server/*` · `packages/permissions/*` · `packages/shared-types/*`

---

## 1. Fronteira de Responsabilidade

O **Server Core** executa e disponibiliza os serviços que fazem o ecossistema funcionar; ele **não** deve ser confundido com o **HQ Central** (que apenas governa a plataforma via painel administrativo).

Responsabilidades centrais:
- Autenticação, emissão/revogação de sessões (`HttpOnly` + `HMAC-SHA256`) e autorização centralizada (`@3c/permissions`).
- Isolamento rigoroso multi-tenant (`storeId`) e proteção anti-IDOR.
- Transações ACID para checkout, estoque, caixa, entregas e fechamento financeiro.
- Tempo real via **Server-Sent Events (SSE)** segregado por contexto.
- Motor de sincronização bidirecional (Push/Pull HLC) com o **3C Edge Node**.
- Cofre criptografado (`AES-256-GCM`) e proxies server-side para integrações externas (WhatsApp Connector, OSRM, OpenFreeMap/PMTiles e proxy opcional de IA).

---

## 2. Mapa de Roteadores (`/api/v1/*`)

| Prefixo de Rota | Módulo | Responsabilidade |
| :--- | :--- | :--- |
| `/api/v1/auth/*` | Autenticação | Login por produto, registro, cookie `3ccorp_session`, refresh, logout e revogação |
| `/api/v1/admin/*` | HQ Central | Governança global (`DEV_OWNER` / `SUPER_ADMIN`), tenants, planos, auditoria e manutenção |
| `/api/v1/store/*` | OS Lojista | Catálogo, PDV, pedidos, KDS, mesas, reservas, estoque BOM FIFO, financeiro, equipe, periféricos, WhatsApp e vitrine |
| `/api/v1/marketplace/*` | Marketplace | Vitrines públicas sanitizadas, busca, carrinho/checkout atômico, área do consumidor e rastreamento |
| `/api/v1/waiter/*` | App Garçom | Pareamento QR/PIN (lockout após 5 falhas), mapa de mesas, rodadas KDS e divisão de conta |
| `/api/v1/driver/*` / `logistics/*` | App Motorista | Pareamento Dual-Fleet, turno, aceite com trava, rotas OSRM, check-in/PIN de entrega e carteira |
| `/api/v1/sync/*` | Edge & Sync | Push de `sync_outbox`, pull paginado (`PARTIAL_PENDING` em 50 páginas), cursores (`cur_`) e HLC |
| `/api/v1/events/*` | Tempo Real (SSE) | Streams segregados por `storeId`, `orderId`, `driverId` e governança |
| `/api/v1/maps/*` | Mapas e Rotas | Integração OpenFreeMap / PMTiles e roteamento multi-parada OSRM |
| `/api/v1/system/*` | Sistema & Releases | Configuração pública sanitizada, saúde (`status`), manifestos de releases (`/releases/manifest`) e artefatos (`/releases/artifacts`) |
| `/api/v1/storage/*` | Armazenamento | Upload/leitura de mídia em `LOCAL_VOLUME` com cotas governadas por `runtimePolicy` + env |
| `/api/v1/supabase/*` | Conector Supabase | Probe de saúde JWKS/Secret (`@supabase/server`) e diagnóstico administrativo |
| `/api/v1/ai/*` | Concierge IA | Proxy server-side opcional com fallback determinístico honesto quando indisponível |
| `/api/v1/health` | Saúde | Diagnóstico de runtime, driver de persistência (`productionDatabaseReady`) e status de manutenção |

---

## 3. Consistência, Transações e Concorrência

- **Deduplicação (`Idempotency-Key`):** Mutações críticas (pedidos, baixas de estoque, pagamentos, aceite de entrega, eventos de sync) validam `idm_` para evitar processamento duplicado em retentativas de rede.
- **Integridade transacional:**
  - No `PostgresCloudDriver`: utiliza transações explícitas com `SELECT ... FOR UPDATE` e `ENABLE/FORCE ROW LEVEL SECURITY`.
  - No `JsonMemoryDriver` (sandbox): utiliza fila serializada em memória com gravação atômica em `server-db.json`.
- **Autorização unificada (`@3c/permissions`):** Regras de acesso a módulos, papéis bloqueados (`BRANCH_LOCKED_ROLES`) e `blockedApps` por colaborador são avaliadas no servidor antes de qualquer leitura ou escrita.

---

## 4. Integrações e Serviços Compartilhados

- **WhatsApp Híbrido (`src/server/routes/store/whatsappConnectorCore.ts`):** Suporta tanto links diretos `wa.me` quanto conector opcional via API para gatilhos de pedido e campanhas, armazenando credenciais no cofre `AES-256-GCM`.
- **Mapas e Logística:** Tiles leves via OpenFreeMap/PMTiles e cálculo de sequência/rota multi-parada via OSRM com fallback gracioso.
- **Separação Config vs Segredos:** Variáveis operacionais não secretas (limites de upload, origens CORS extras, webhook URL de e-mail, URL de releases, URLs Supabase e preços de planos) são resolvidas dinamicamente da governança do **HQ Central** (`runtimePolicy` / `releaseConfig` / `planPricing`) com fallback para `process.env`. Nenhuma chave de API externa ou segredo (`SERVER_SECRET`, `DATABASE_URL`, `SQL_PASSWORD`, `SUPABASE_SECRET_KEY`, `*_WEBHOOK_SECRET`, `GEMINI_API_KEY`) é exposta ao frontend nem solicitada por UI — segredos residem exclusivamente no **Server Core** / Secret Manager ou no cofre criptografado `AES-256-GCM` (`integrations`).
