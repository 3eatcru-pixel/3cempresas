# Pilar 3 — OS Lojista e Vitrine Comercial

Sistema operacional empresarial modular destinado a estabelecimentos comerciais. Vai muito além de um PDV: unifica vendas, salão, cozinha, estoque técnico, financeiro, equipe, periféricos, CRM e a gestão da **Vitrine Comercial** publicada no Marketplace.

- **Identificador:** `store-os` (`?app=store-os`)
- **Identidade visual:** Amber `#f59e0b` · `/favicons/store-os.svg`
- **Código principal:** `src/components/pillars/StoreOsPillar.tsx` · `src/modules/store-os/*`
- **Rotas de API:** `/api/v1/store/*`

---

## 1. OS Lojista vs Vitrine Comercial

- **OS Lojista (ambiente privado):** Área de trabalho em janelas para gestão diária da empresa por proprietários, gerentes, caixas, cozinha e equipe interna. Nunca apresenta o HQ Central ao lojista.
- **Vitrine Comercial (face pública):** Representação pública do estabelecimento consumida pelo **Marketplace**. Espelha automaticamente produtos ativos, preços reais, horários, modalidades aceitas e métodos de pagamento configurados pela loja.

---

## 2. Arquitetura de Janelas e Carregamento Sob Demanda

Todos os **28 aplicativos internos** da área de trabalho (`src/modules/store-os/layout/StoreOsWindowRenderer.tsx` e `storeOsAppsList.ts`) utilizam carregamento assíncrono sob demanda com `lazyWithRetry` + `<Suspense>`:
- O lojista carrega apenas o shell inicial e baixa os módulos conforme abre cada janela (redução de 235 para 106 módulos estáticos iniciais).
- Em caso de falha transitória de chunk, `lazyWithRetry` realiza retentativa automática e o `PillarErrorBoundary` permite recarga limpa.

### Mapa dos 28 Aplicativos e Capacidades Principais

| Categoria | Aplicativos / Módulos | Destaques Implementados |
| :--- | :--- | :--- |
| **Vendas & Atendimento** | PDV Polimórfico (Balcão, Varejo, Serviços), Gestão de Pedidos, Kiosk / Autoatendimento, Mesas & Comandas, Reservas | 3 modos de PDV adaptáveis ao segmento, controle de mesas, fila de pedidos via SSE e integração com App do Garçom |
| **Produção & Cozinha** | KDS (Kitchen Display System) | Recebimento em tempo real de pedidos do PDV, Marketplace e rodadas incrementais do Garçom |
| **Catálogo & Suprimentos** | Produtos & Serviços, Categorias/Vitrine, Estoque (BOM & FIFO), Fornecedores | Ficha técnica (BOM), custo médio/FIFO, cálculo de CMV e ledger delta-based compatível com Edge Node |
| **Financeiro & Fiscal** | Financeiro, Caixa (Abertura/Sangria/Fechamento), Relatórios & DRE, Exportação SPED, PIX | Fechamento de caixa auditável (`FinanceCashCloseModal`), novos lançamentos (`FinanceNewRecordModal`), conciliação e chave PIX da loja |
| **Clientes & Marketing** | CRM / Clientes, WhatsApp Marketing & Gatilhos, Cupons da Loja | WhatsApp Híbrido (`wa.me` + conector opcional via API), construtor de campanhas, segmentação de audiência e gatilhos automáticos de status de pedido |
| **Equipe & Segurança** | Funcionários & RBAC, Dispositivos & Pareamento | Controle granular por papel (`OWNER`, `MANAGER`, `CASHIER`, `STAFF`, `KITCHEN`) + bloqueio individual por aplicativo (`blockedApps`) + emissão de QR/PIN para Garçom e Motorista |
| **Logística & Infra** | Frota & Entregadores, Periféricos & Impressoras (ESC-POS), Edge Sync & Offline, Configurações da Loja, Plano & Assinatura | Despacho para frota própria (`STORE_FLEET`) ou rede da plataforma (`PLATFORM_FLEET`), fila de impressão (`StorePrintJobsQueue`), gestão de Edge Node e perfil/PIX |

---

## 3. Matriz de Acesso Interno (RBAC + `blockedApps`)

- **`OWNER` / `MANAGER`:** Acesso amplo aos módulos habilitados no plano da empresa, gestão de equipe, financeiro, configurações e pareamento de dispositivos.
- **`CASHIER`:** PDV, pedidos, caixa e atendimento de balcão (sem acesso a configurações destrutivas ou governança financeira restrita).
- **`KITCHEN`:** Foco operacional no KDS e visualização de produção.
- **`STAFF`:** Módulos operacionais atribuídos pelo gerente.
- **`blockedApps`:** Qualquer aplicativo específico pode ser revogado individualmente para um colaborador sem alterar o papel global, com validação aplicada tanto na UI quanto no Server Core.
- **Exclusão estrita:** Perfis `WAITER`, `COURIER` e `CUSTOMER` não têm acesso ao OS Lojista.

---

## 4. Operação Offline (Edge) e Empacotamento Nativo

- **Web + 3C Edge Node (Verificado):** PDV, Mesas, KDS e Caixa operam contra o Edge Node local (`SqliteWalDriver`) durante quedas de internet e sincronizam automaticamente via `sync_outbox`.
- **Desktop Tauri 2 (Scaffold pronto — pendente homologação nativa):** A integração com sidecar local e impressão direta USB/Serial ESC-POS depende de build e testes em máquina desktop nativa (Windows/macOS/Linux).
