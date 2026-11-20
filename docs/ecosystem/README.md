# Ecossistema 3C Corp SaaS

Visão consolidada do ecossistema empresarial, seus 5 produtos independentes, a camada compartilhada de infraestrutura, identidade visual, fluxos ponta a ponta e guia prático de validação local e em nuvem.

---

## 1. Estrutura do Ecossistema

O ecossistema é formado por **5 produtos voltados ao usuário** sustentados por um **backbone tecnológico compartilhado (`server-core`)**, totalizando 6 componentes arquiteturais:

1. **HQ Central (`hq`)** — Governança da plataforma (`DEV_OWNER` e `SUPER_ADMIN`).
2. **Server Core (`server-core`)** — Backbone de APIs, autenticação, persistência, tempo real (SSE) e sincronização (camada de infraestrutura, não um produto de usuário final).
3. **OS Lojista (`store-os`) + Vitrine Comercial** — Sistema operacional empresarial com 28 aplicativos modulares para operação interna e gestão da vitrine pública.
4. **Marketplace (`marketplace`)** — Experiência comercial exclusiva para o consumidor final descobrir estabelecimentos, consultar produtos/serviços e acompanhar pedidos.
5. **App do Garçom (`waiter`)** — Atendimento BYOD de salão, comandas e rodadas de cozinha integrado ao OS Lojista e ao Edge Node.
6. **App do Motorista (`driver`)** — Entregas **Dual-Fleet** (`PLATFORM_FLEET` e `STORE_FLEET`), rotas multi-parada e carteira PIX.

---

## 2. Identidade Visual e Isolamento de Marca

Cada produto mantém identidade, cor semântica, ícone e experiência de entrada próprios, sem misturar telas de login ou apresentar ferramentas internas ao público errado:

| Produto / Contexto | Identificador (`?app=`) | Cor Semântica | Favicon | Público |
| :--- | :--- | :--- | :--- | :--- |
| **Portal 3C Corp** | `portal` (padrão) | Amber `#f59e0b` | `/favicons/corp.svg` | Roteador de acesso em ambiente de desenvolvimento/homologação |
| **OS Lojista** | `store-os` | Amber `#f59e0b` | `/favicons/store-os.svg` | Lojistas, gerentes, caixas, cozinha e equipe interna |
| **Marketplace** | `marketplace` | Emerald `#10b981` | `/favicons/marketplace.svg` | Consumidores finais |
| **App do Motorista** | `driver` | Sky `#0ea5e9` | `/favicons/driver.svg` | Entregadores (frota da loja ou plataforma) |
| **App do Garçom** | `waiter` | Pink `#ec4899` | `/favicons/waiter.svg` | Garçons e atendentes de salão |
| **HQ Central** | `hq` | Indigo `#6366f1` | `/favicons/hq.svg` | `DEV_OWNER` e `SUPER_ADMIN` |
| **Server Core** | `server-core` | Cyan `#06b6d4` | `/favicons/hq.svg` | Infraestrutura e APIs (`/api/v1/*`) |

---

## 3. Fluxos Operacionais Ponta a Ponta

### Fluxo A — Onboarding e Governança (HQ -> OS Lojista)
1. O `DEV_OWNER` ou `SUPER_ADMIN` aprova ou provisiona o tenant, plano, licença e dispositivos no **HQ Central**.
2. O lojista acessa o **OS Lojista**, configura perfil, horários, métodos de pagamento, PIX, catálogo e colaboradores.
3. A **Vitrine Comercial** é publicada automaticamente no catálogo público do **Marketplace** com os dados sanitizados.

### Fluxo B — Jornada do Consumidor (Marketplace -> Server -> OS Lojista)
1. O consumidor navega livremente nas vitrines do **Marketplace**, filtra por segmento/categoria e monta o carrinho.
2. No checkout atômico (com proteção contra duplo envio e `Idempotency-Key`), o pedido é validado no **Server Core** (preços reais, estoque, modalidade e cupom).
3. O pedido entra instantaneamente no **OS Lojista** (PDV, Painel de Pedidos e KDS) via SSE isolado por `storeId`.
4. O consumidor acompanha o progresso em tempo real sem exposição de telemetria interna ou dados operacionais da loja.

### Fluxo C — Atendimento de Salão (App Garçom -> Edge/Server -> OS Lojista)
1. O garçom pareia seu smartphone no **App do Garçom** via QR Code ou PIN gerado no OS Lojista (suporte a Cloud e Edge LAN, com bloqueio após 5 tentativas inválidas).
2. Lança rodadas incrementais por mesa diretamente para o KDS e acompanha fechamento/divisão de conta.
3. O perfil `WAITER` permanece bloqueado de abrir o **OS Lojista**.

### Fluxo D — Despacho e Entrega (OS Lojista -> Server -> App Motorista)
1. O lojista despacha pedidos `DELIVERY` para sua frota própria (`STORE_FLEET`) ou solicita entrega na rede da plataforma (`PLATFORM_FLEET`).
2. O entregador aceita o lote no **App do Motorista** (com trava contra duplo aceite), segue a sequência otimizada via OSRM, faz check-in e valida o PIN de 4 dígitos na entrega.
3. O status é atualizado atomicamente no **OS Lojista** e no acompanhamento do consumidor no **Marketplace**.

---

## 4. Matriz Consolidada de Papéis (RBAC)

| Papel (`role`) | HQ Central | OS Lojista | Marketplace | App Garçom | App Motorista |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `DEV_OWNER` | Completo (governança master) | Inspeção/suporte quando autorizado | Acesso público | — | — |
| `SUPER_ADMIN` | Administrativo (sem ações exclusivas do owner) | — | Acesso público | — | — |
| `OWNER` / `MANAGER` | — | Completo na empresa (`storeId`) | Acesso público | Pareamento de equipe | Gestão de frota |
| `CASHIER` / `STAFF` / `KITCHEN` | — | Módulos liberados por RBAC e `blockedApps` | Acesso público | — | — |
| `WAITER` | — | **Bloqueado** | Acesso público | Operação de mesas e pedidos | — |
| `COURIER` / `DRIVER` | — | **Bloqueado** | Acesso público | — | Entregas (`PLATFORM_FLEET` / `STORE_FLEET`) |
| `CUSTOMER` | — | **Bloqueado** | Conta, pedidos, endereços, favoritos | — | — |

---

## 5. Estado Real de Maturidade

Transparência operacional do que está verificado versus o que depende de ambiente nativo/nuvem externo:

| Camada / Alvo | Estado Atual | Observação Real |
| :--- | :--- | :--- |
| **Web / SPA (5 produtos + Portal)** | Verificado | Build unificado e 5 builds independentes (`npm run build:apps`) verdes |
| **Server Core (Node/Express)** | Verificado | 21 suítes de testes + 20 scanners no 3C Sentinel 1.0 operacionais |
| **3C Edge Node (SQLite WAL)** | Verificado | Persistência local (`node:sqlite` / SQLite `>= 3.51.3`), HLC e `sync_outbox` validados |
| **PostgreSQL Cloud + RLS** | Implementado (pendente homologação multi-instância) | Driver `PostgresCloudDriver` com `SELECT ... FOR UPDATE` e `FORCE ROW LEVEL SECURITY` exige instância live (`DATABASE_URL` + `ENABLE_POSTGRES_CLOUD=true`) |
| **Desktop Tauri 2 (OS Lojista)** | Scaffold pronto (pendente homologação nativa) | Sidecar, USB/Serial ESC-POS e binários Windows/macOS/Linux exigem validação em máquina nativa |
| **Android Capacitor (Garçom / Motorista / Marketplace)** | Scaffold pronto (pendente build Gradle) | Empacotamento APK/AAB, câmera nativa e GPS em segundo plano exigem Android SDK/Gradle local |

---

## 6. Ambientes, URLs e Validação Local / CI

### Ambientes de Referência
- **Cloud Run (Produção/Homologação):** `https://app-3ccorp-164281225843.us-west1.run.app` · `https://app-3ccorp-2aj4z66sma-uw.a.run.app`
- **Domínios de referência:** `https://3ccorp.ai.studio` · `https://3cruempresas.cloud.run`

### Roteiro de Verificação Local (Antes de Push / Release)
```bash
# 1. Conferir versão do Node (>=22.23.0 <25.0.0)
node -v && npm -v

# 2. Tipagem e builds
npm run lint
npm run build
npm run build:apps

# 3. Auditoria completa (scanners estáticos + todas as suítes)
npm run sentinel
```

Para detalhes de configuração de variáveis de ambiente, consulte `.env.example` na raiz do repositório. Nunca commite segredos, chaves reais ou arquivos `.env` preenchidos.
