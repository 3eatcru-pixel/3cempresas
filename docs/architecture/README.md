# Arquitetura Geral e Monorepo

Especificação da arquitetura multiplataforma em 3 camadas do ecossistema **3C Corp SaaS (`v5.2.2`)**, organização do monorepo, contratos HTTP (`RFC-001`), estratégia de carregamento sob demanda e camadas de persistência.

---

## 1. Topologia em 3 Camadas

```text
+-----------------------------------------------------------------------+
| CAMADA 1 — CLIENTES MULTIPLATAFORMA (apps/* + src/modules/*)          |
|  - HQ Central (Web)                                                   |
|  - OS Lojista (Web / Desktop Tauri 2)                                 |
|  - Marketplace (Web / PWA / Android)                                  |
|  - App do Garçom (Web / PWA / Android)                                |
|  - App do Motorista (Web / PWA / Android)                             |
+------------------------------+-------------------+--------------------+
                               | HTTPS + REST/SSE  | LAN HTTP (Offline)
                               v                   v
+----------------------------------------+  +---------------------------+
| CAMADA 2 — SERVER CORE (Cloud Backbone)|  | 3C EDGE NODE (LAN Local)  |
|  - Express + APIs /api/v1/*            |  |  - servers/edge-node      |
|  - Autenticação, RBAC, Cofre, SSE      |<-|  - SqliteWalDriver        |
|  - Sync Engine (push/pull HLC)         |  |  - sync_outbox + mDNS     |
+--------------------+-------------------+  +-------------+-------------+
                     |                                    |
                     v                                    v
+----------------------------------------+  +---------------------------+
| CAMADA 3 — PERSISTÊNCIA                |  | SQLite WAL (>= 3.51.3)    |
|  - Sandbox: JsonMemoryDriver           |  |  - Ledger local + outbox  |
|  - Cloud:   PostgresCloudDriver (RLS)  |  +---------------------------+
+----------------------------------------+
```

---

## 2. Estrutura do Monorepo

O projeto utiliza **npm workspaces** combinando o servidor full-stack unificado com empacotamentos independentes por produto:

```text
/
├── server.ts                      # Entry point Express + Vite (dev) / estático (prod) na porta 3000
├── src/
│   ├── App.tsx                    # Roteador principal com lazyWithRetry e PillarErrorBoundary
│   ├── apps/                      # ProductShell para builds isolados por pilar
│   ├── components/pillars/        # Pontos de entrada dos pilares (HQ, StoreOS, Marketplace, Waiter, Driver)
│   ├── modules/                   # Módulos funcionais isolados por produto
│   │   ├── hq-central/            # Governança central
│   │   ├── store-os/              # 28 aplicativos internos do OS Lojista
│   │   ├── marketplace/           # Experiência do consumidor
│   │   ├── waiter/                # Operação de salão BYOD
│   │   └── driver/                # Logística Dual-Fleet
│   ├── context/                   # AuthContext, EcosystemContext, ConsumerContext
│   ├── hooks/                     # Hooks de domínio por capacidade
│   ├── services/                  # Clientes HTTP e contratos de API
│   ├── utils/                     # Utilitários compartilhados (ex.: lazyWithRetry.ts)
│   └── server/                    # Backbone Server Core (rotas, auth, drivers de banco, SSE, sync)
├── apps/                          # Shells independentes (marketplace, store-os, waiter, driver, hq)
├── packages/
│   ├── shared-types/              # Contratos TypeScript compartilhados (@3c/shared-types)
│   ├── permissions/               # Matriz RBAC centralizada (@3c/permissions)
│   └── ...                        # Pacotes utilitários compartilhados
├── servers/
│   └── edge-node/                 # Servidor local offline-first (@3c/edge-node)
├── scripts/
│   └── sentinel.ts                # Auditor 3C Sentinel 1.0
├── tests/                         # 20 suítes cobrindo segurança, RLS, sync HLC, UX e E2E
└── docs/                          # Documentação canônica (ecosystem, architecture, pillars)
```

---

## 3. Contratos de Comunicação (RFC-001)

Todas as requisições entre clientes e o Server Core/Edge Node seguem cabeçalhos padronizados para observabilidade, compatibilidade de contrato e isolamento de produto:

| Cabeçalho | Finalidade | Exemplo |
| :--- | :--- | :--- |
| `X-3C-App-Id` | Identifica o produto chamador | `store-os`, `marketplace`, `waiter`, `driver`, `hq` |
| `X-3C-Contract-Version` | Versão do contrato de API esperado | `1.0` |
| `X-3C-Platform` | Plataforma do cliente | `web`, `desktop`, `android`, `pwa` |
| `Idempotency-Key` | Garante deduplicação em mutações críticas (pedidos, caixa, sync) | `idm_<uuid>` |
| `Authorization` / Cookie | Sessão autenticada (`HttpOnly` cookie `3ccorp_session` ou Bearer token) | `Bearer dev-token:...` |

---

## 4. Fronteiras Estritas Entre Produtos

- **Dependência unidirecional:** Os produtos em `src/modules/*` consomem contratos de `packages/shared-types`, `packages/permissions` e `src/services/*`. Nenhum produto importa telas ou componentes privados de outro produto.
- **Isolamento de bundle e carregamento sob demanda:**
  - `src/utils/lazyWithRetry.ts` fornece carregamento assíncrono com retentativa automática (`lazyWithRetry`) e detecção de falhas de chunk (`isDynamicImportError`).
  - No **OS Lojista**, todos os **28 aplicativos da área de trabalho** (`src/modules/store-os/layout/StoreOsWindowRenderer.tsx`) são carregados sob demanda com `<Suspense>`, reduzindo drasticamente o volume de módulos carregados na inicialização (de 235 para 106 módulos estáticos iniciais).
  - `PillarErrorBoundary` identifica erros de importação dinâmica e oferece recarregamento limpo da sessão de módulo.
- **Builds isolados (`npm run build:apps`):** Permite publicar cada produto em domínio ou empacotamento dedicado sem carregar código dos demais pilares.

---

## 5. Camadas de Persistência

O Server Core abstrai o armazenamento por meio de uma interface única de repositório transacional:

1. **Ambiente Sandbox / Dev (`JsonMemoryDriver`):**
   - Persiste em `server-db.json` com escrita atômica (`writeFile` temporário + `rename`).
   - Sinaliza explicitamente `productionDatabaseReady: false` nos endpoints de diagnóstico.
   - Adequado para desenvolvimento, demonstrações e suítes automatizadas locais.
2. **Ambiente Cloud (`PostgresCloudDriver`):**
   - Ativado explicitamente via `DATABASE_URL` + `ENABLE_POSTGRES_CLOUD=true`.
   - Emprega bloqueio pessimista (`SELECT ... FOR UPDATE`) em mutações financeiras/estoque e isolamento multi-tenant no banco (`ENABLE` / `FORCE ROW LEVEL SECURITY`).
   - Status: implementado no código e coberto por testes de contrato; homologação em cluster multi-instância live permanece pendente de infraestrutura externa.
3. **Ambiente Local de Loja (`SqliteWalDriver` no Edge Node):**
   - Usa `node:sqlite` (SQLite `>= 3.51.3`) em modo **WAL** (`Write-Ahead Logging`) com ledger local e fila de saída (`sync_outbox`).
   - Detalhes completos em [Sincronização, Offline-First e Edge Node](./sync-and-edge/README.md).

---

## 6. Tempo Real e Eventos (SSE)

- O Server Core expõe canais Server-Sent Events (SSE) segregados por contexto (`storeId`, `orderId`, `driverId`, governança HQ).
- Eventos de uma empresa nunca vazam para conexões de outra empresa.
- A UI do consumidor no Marketplace recebe apenas estados amigáveis de pedido, sem exibir indicadores técnicos de SSE ou telemetria de servidor.
