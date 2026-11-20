# Pilar 1 — HQ Central (Governança do Ecossistema)

Centro administrativo e de governança da plataforma **3C Corp SaaS**, pertencente ao desenvolvedor (`DEV_OWNER`) e a administradores globais autorizados (`SUPER_ADMIN`).

- **Identificador:** `hq` (`?app=hq`)
- **Identidade visual:** Indigo `#6366f1` · `/favicons/hq.svg`
- **Código principal:** `src/components/pillars/HqCentralPillar.tsx` · `src/modules/hq-central/*`
- **Rotas de API:** `/api/v1/admin/*`

---

## 1. Fronteira de Responsabilidade

**Regra fundamental:** O HQ Central governa o ecossistema, **não** a operação diária das lojas.

### O que o HQ Central faz
- Gerencia empresas/tenants cadastrados, onboarding, aprovação, suspensão e status de licença (`ACTIVE`, `TRIAL` / `DEGUSTAÇÃO`, `SUSPENDED`).
- Administra planos comerciais, assinaturas, cobrança e métricas consistentes de receita recorrente (**MRR**).
- Controla dispositivos autorizados, terminais, Edge Nodes e revogação de sessões.
- Gerencia papéis globais (RBAC), políticas de acesso e hierarquia `DEV_OWNER` vs `SUPER_ADMIN`.
- Governa entregadores da rede da plataforma (**Dual-Fleet / `PLATFORM_FLEET`**), campanhas globais de cupons e integrações da plataforma.
- Monitora saúde operacional do ecossistema, trilha de auditoria (`aud_`) com exportação CSV e circuito de manutenção (*maintenance circuit breaker*).

### O que o HQ Central NÃO faz
- Não funciona como ERP, PDV, KDS ou controle de estoque/caixa interno de estabelecimentos individuais.
- Nunca é exibido ou mencionado ao consumidor no **Marketplace** nem apresentado como ferramenta operacional do lojista.

---

## 2. Separação de Poderes (`DEV_OWNER` vs `SUPER_ADMIN`)

- **`DEV_OWNER` (`3eatcru@gmail.com`):** Autoridade máxima de governança. Pode gerenciar administradores globais, acionar circuit breaker de manutenção, gerenciar integrações críticas e executar ações irreversíveis protegidas.
- **`SUPER_ADMIN`:** Opera a rotina de governança (tenants, suporte, planos, dispositivos, frotas e auditoria), sem permissão para alterar, rebaixar ou excluir o `DEV_OWNER` ou executar ações reservadas ao proprietário da plataforma.

---

## 3. Módulos da Interface (5 Domínios de Governança) e Proteções Operacionais

A barra lateral do HQ Central é organizada em **5 domínios claros para o `DEV_OWNER`**: **Visão Geral**, **Marketplace & Experiência**, **Rede & Receita SaaS**, **Plataforma & Distribuição** e **Segurança & Infra**:

- **Visão Executiva & Billing:** Métricas consistentes de MRR, filtros de faturamento e destaque para contas em `TRIAL` (`DEGUSTAÇÃO`).
- **Gestão do Marketplace (`HqMarketplaceTab`):** Governança completa da experiência do consumidor e monetização da audiência sem interferir no Store OS das lojas — dividido em **Experiência & Economia** (banner global, manchete editorial, título de recomendações, taxa base, comissão Marketplace, verticais e circuit breaker somente leitura), **Banners & Destaques Pagos** (tabela oficial e campanhas patrocinadas de lojistas no Banner Principal, Carrossel de Recomendações e Topo de Categoria) e **Canais Externos & Curadoria** (hub de conectores iFood, Uber Eats, Deliveroo, Rappi e 99Food com add-on mensal + curadoria/moderação de vitrines). Veja o modelo completo em [Economia do Ecossistema](../../architecture/economics/README.md).
- **Gestão de Tenants / Empresas:** Cadastro, revisão de status, suspensão e gestão de planos/licenças.
- **Dispositivos & Edge Nodes:** Visualização de terminais conectados, revogação imediata de token e remoção controlada.
- **RBAC & Equipe de Governança:** Gestão de administradores globais respeitando a hierarquia `DEV_OWNER` / `SUPER_ADMIN`.
- **Logística Global (`COURIER` / `PLATFORM_FLEET`):** Aprovação, gestão de entregadores da rede da plataforma e governança de taxas/repasses.
- **Cupons & Integrações Globais:** Cofre criptografado (`AES-256-GCM`) para chaves de plataforma (isolado por `tenantId` para `SUPER_ADMIN` e global apenas para `DEV_OWNER`), campanhas globais e Kill-Switch 1-clique dos conectores secundários opcionais **Firebase** e **Supabase** (mantendo o Server Core como autoridade única).
- **Customização & Variáveis de Runtime (`runtimePolicy`):** Governança dinâmica em `/governance` de parâmetros não secretos (limites de armazenamento, origens CORS extras, webhook URL de e-mail, override opcional de Project ID Firebase e URLs públicas do Supabase `supabaseUrl`, `supabasePublishableKey`, `supabaseJwksUrl`), mantendo segredos criptográficos (`SUPABASE_SECRET_KEY`, senhas PostgreSQL) estritamente no Server Core / Secret Manager.
- **Downloads & Releases (`3C Release Manager`):** Governança dinâmica da URL base HTTPS de instaladores em CDN/Bucket próprio (Windows `.exe`/`.msi`, Android `.apk`/`.aab`, Edge Node), canal (`stable`/`beta`/`canary`), versão mínima suportada, pausa por produto, assinaturas Ed25519 por alvo e inspeção de manifestos.
- **Auditoria & Saúde:** Logs imutáveis (`aud_`) com exportação **CSV**, diagnóstico de ambiente e controle de modo manutenção.

### Confirmação em 2 Etapas (Ações Destrutivas)
Todas as operações sensíveis no HQ exigem confirmação explícita em 2 etapas antes de disparar a mutação no servidor:
- Suspensão de tenant/empresa.
- Revogação ou exclusão de dispositivo.
- Suspensão ou exclusão de usuário/papel RBAC.
- Exclusão de cupom global ou integração.
- Ativação do circuit breaker de manutenção global.

---

## 4. Superfície de API (`/api/v1/admin/*`)

As rotas administrativas residem em `src/server/routes/admin*` e exigem sessão válida com papel `DEV_OWNER` ou `SUPER_ADMIN`, validação de `tokenVersion` e registro automático na trilha de auditoria (`aud_`):

- `/api/v1/admin/overview` — Saúde, contadores e MRR consolidado.
- `/api/v1/admin/stores` & `/api/v1/admin/tenants` — CRUD, aprovação, suspensão e planos de empresas.
- `/api/v1/admin/devices` & `/api/v1/admin/edge-nodes` — Inventário e revogação de dispositivos/Edge Nodes.
- `/api/v1/admin/users` — Gestão de contas e RBAC (preservando exclusividade do `DEV_OWNER`).
- `/api/v1/admin/couriers` — Governança de entregadores `PLATFORM_FLEET`.
- `/api/v1/admin/coupons` & `/api/v1/admin/integrations` — Campanhas globais e cofre de integrações (mutações globais restritas a `DEV_OWNER`).
- `/api/v1/admin/billing/*` — Assinaturas SaaS, solicitações de upgrade e webhook de quitação PSP.
- `/api/v1/admin/audit-logs` — Consulta e exportação de eventos de auditoria.
- `/api/v1/admin/governance` & `/api/v1/admin/diagnostics/*` — Parâmetros globais (`runtimePolicy`, `releaseConfig`, `billingConfig`), circuit breaker e telemetria (diagnóstico de tabelas internas e variáveis restrito ao `DEV_OWNER`).
