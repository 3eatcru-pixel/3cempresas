# 3C Corp SaaS — Ecossistema Empresarial Multi-Tenant

Plataforma empresarial integrada composta por produtos independentes conectados por um backbone compartilhado (**Server Core**) e governados centralmente pelo **HQ Central**.

- **Versão da plataforma:** `v5.2.2` (contrato `X-3C-Contract-Version: 5.2`)
- **Runtime suportado:** Node.js `>=22.23.0 <25.0.0` · `npm@10.9.2`
- **Públicos isolados:** Governança (`HQ Central`), Infraestrutura (`Server Core`), Operação Empresarial (`OS Lojista` + `Vitrine`), Consumidor (`Marketplace`), Atendimento (`App Garçom`) e Logística (`App Motorista`).

---

## Mapa da Documentação

A documentação do repositório é organizada em **13 arquivos canônicos** (1 geral, 1 do ecossistema, 5 de arquitetura e 6 de pilares/produtos):

### Visão Geral e Ecossistema
| Documento | Escopo |
| :--- | :--- |
| [Visão Geral do Ecossistema](./docs/ecosystem/README.md) | Produtos, identidade visual por pilar, fluxos ponta a ponta, matriz RBAC, maturidade real e guia de testes locais/CI |

### Arquitetura e Engenharia
| Documento | Escopo |
| :--- | :--- |
| [Arquitetura Geral e Monorepo](./docs/architecture/README.md) | Topologia em 3 camadas, estrutura `apps/` · `packages/` · `servers/`, contratos HTTP, carregamento sob demanda e persistência |
| [Economia do Ecossistema](./docs/architecture/economics/README.md) | Modelo de faturamento do HQ (SaaS, comissão Marketplace, mídia/destaques pagos, conectores iFood/Uber Eats/Deliveroo) e DRE do lojista de hospitalidade |
| [Segurança, Identidade e Padrão de IDs](./docs/architecture/security/README.md) | Inventário de credenciais (`DEV_OWNER` vs `[DEMO]`), prefixos oficiais de IDs, criptografia, sessões, cofre e isolamento multi-tenant |
| [Sincronização, Offline-First e Edge Node](./docs/architecture/sync-and-edge/README.md) | 3C Edge Node (SQLite WAL), `sync_outbox`, idempotência, HLC, reconciliação de conflitos e operação em LAN |
| [QA, Auditoria e 3C Sentinel 1.0](./docs/architecture/qa-sentinel/README.md) | Especificação do 3C Sentinel 1.0, scanners estáticos, guardrails fail-closed e suítes automatizadas |

### Pilares e Produtos
| Pilar / Produto | Público | Documento |
| :--- | :--- | :--- |
| **HQ Central** | Desenvolvedor (`DEV_OWNER`) e administradores da plataforma | [docs/pillars/hq-central/README.md](./docs/pillars/hq-central/README.md) |
| **Server Core** | Backbone tecnológico e APIs compartilhadas | [docs/pillars/server-core/README.md](./docs/pillars/server-core/README.md) |
| **OS Lojista (+ Vitrine)** | Empresas, gestores, caixas e equipe interna | [docs/pillars/store-os/README.md](./docs/pillars/store-os/README.md) |
| **Marketplace** | Consumidor final | [docs/pillars/marketplace/README.md](./docs/pillars/marketplace/README.md) |
| **App do Garçom (Waiter BYOD)** | Garçons e atendentes de salão | [docs/pillars/waiter/README.md](./docs/pillars/waiter/README.md) |
| **App do Motorista (Driver Dual-Fleet)** | Entregadores de frota própria e frota da plataforma | [docs/pillars/driver/README.md](./docs/pillars/driver/README.md) |

---

## Início Rápido

```bash
# 1. Instalar dependências
npm install

# 2. Subir o ambiente full-stack local (Express + Vite na porta 3000)
npm run dev

# 3. Subir o 3C Edge Node local (SQLite WAL para LAN / Offline-First)
npm --workspace=@3c/edge-node run start
```

### Acesso direto por produto em desenvolvimento
Use o parâmetro `?app=` na URL local (`http://localhost:3000`) ou no domínio de homologação:

- **Portal de Entrada:** `http://localhost:3000/`
- **Marketplace (Consumidor):** `http://localhost:3000/?app=marketplace`
- **OS Lojista:** `http://localhost:3000/?app=store-os`
- **App do Garçom:** `http://localhost:3000/?app=waiter`
- **App do Motorista:** `http://localhost:3000/?app=driver`
- **HQ Central:** `http://localhost:3000/?app=hq`

---

## Comandos Principais

| Comando | Finalidade |
| :--- | :--- |
| `npm run dev` | Inicia o servidor Express + Vite (porta `3000`) |
| `npm run lint` | Verifica tipagem TypeScript (`tsc --noEmit`) |
| `npm run build` | Compila o portal unificado (`dist/`) |
| `npm run build:apps` | Compila os 5 bundles Web independentes (`marketplace`, `store-os`, `waiter`, `driver`, `hq`) |
| `npm test` | Executa a suíte funcional base |
| `npm run test:security` | Valida RBAC, anti-IDOR, isolamento multi-tenant, cookies e cofre |
| `npm run test:cross-platform` | Valida contratos HTTP, Edge Node, HLC e sincronização |
| `npm run test:sentinel-heavy` | Testes pesados de segurança, concorrência e integridade |
| `npm run test:phase3` | Testes de fase 3 (Desktop, Android, Edge e paridade) |
| `npm run test:e2e` | Fluxos ponta a ponta entre produtos |
| `npm run sentinel` | Executa o auditor completo **3C Sentinel 1.0** (20 scanners + 21 suítes) |
| `npm run audit` / `npm run test:all` | Executa validação completa de build, lint e testes |
| `npm run clean` | Limpa artefatos temporários de build |

---

## Regra de Ouro da Arquitetura

1. **HQ Central** governa o ecossistema (tenants, planos, licenças, dispositivos, políticas globais) — nunca opera o dia a dia das lojas.
2. **Server Core** sustenta comunicação, autenticação, persistência, SSE, filas e sincronização — não é o painel de governança.
3. **OS Lojista** é o sistema operacional privado do estabelecimento; a **Vitrine** é sua face pública no Marketplace.
4. **Marketplace** é um produto independente para o consumidor — nunca expõe HQ ou OS Lojista.
5. **App do Garçom** e **App do Motorista** possuem autenticação, pareamento, escopo e interface dedicados à operação em campo.
