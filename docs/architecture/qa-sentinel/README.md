# QA, Auditoria e 3C Sentinel 1.0

Especificação do motor de auditoria contínua **3C Sentinel 1.0** (`scripts/sentinel.ts`), seus módulos de verificação estática e dinâmica, política *fail-closed* e mapa completo das suítes de testes do ecossistema.

---

## 1. Propósito do 3C Sentinel 1.0

O **3C Sentinel 1.0** impede regressões silenciosas de arquitetura, segurança, isolamento entre pilares e contratos de sincronização. Ele audita tanto o código-fonte e a documentação quanto o comportamento real do servidor e do Edge Node.

### Execução
```bash
npm run sentinel
```

---

## 2. Os 5 Módulos do Sentinel

1. **Integridade de Repositório e Documentação:**
   - Verifica ausência de documentos obsoletos de planos de recuperação antigos e garante que a documentação canônica respeite os invariantes arquiteturais da plataforma (sem diretivas de stacks externos removidos).
2. **Qualidade de Código e Tipagem:**
   - Valida integridade sintática, imports e contratos entre workspaces (`packages/shared-types`, `packages/permissions`, `src/`, `servers/edge-node`).
3. **Scanners de Segurança Estática (`SCAN-*`):**
   - Detecta vazamento de segredos, usos inseguros, falta de validação de papel/tenant, quebra de fronteiras entre produtos e padrões proibidos de autenticação.
4. **Execução das Suítes Automatizadas (21 suítes):**
   - Roda testes funcionais, de segurança, multi-tenant, anti-IDOR, governança do Marketplace/crescimento B2B, isolamento de experiência por persona (5 públicos), Edge Node/SQLite WAL, HLC, SSE, modo dual dos conectores opcionais (Firebase & Supabase OAuth/JWKS) e fluxos E2E entre os 5 produtos.
5. **Relatório Consolidado, Logs Vivos & Guardrail Fail-Closed:**
   - Gera `.sentinel/report-latest.*`, `.sentinel/deficiencies-log.*` (deficiências abertas P0/P1 e consultivas P2/P3), `.sentinel/improvements-log.*` (melhorias verificadas, matriz de experiência das 5 personas e rastreamento modular `SCAN-17` com zero monolitos acima do limiar) e `.sentinel/audit-history.ndjson` (histórico cronológico das últimas 100 execuções), também visíveis no **HQ Central → Auditoria & Compliance**.
   - Qualquer falha crítica ou violação de contrato (`SCAN-01..20` ou falha em qualquer das 21 suítes) encerra com status diferente de zero, bloqueando aprovação de release até correção.

---

## 3. Critério de Prova de Falha (5 Evidências)

Para evitar falsos positivos ou relatórios vagos, todo achado classificado como problema confirmado deve registrar:

1. **Arquivo e localização exata** (caminho e linha/símbolo).
2. **Evidência reproduzível** (trecho de código, retorno HTTP ou erro de teste).
3. **Causa raiz técnica** (por que viola segurança, contrato ou fronteira de produto).
4. **Impacto real no ecossistema** (qual produto/persona é afetado).
5. **Critério objetivo de validação** (teste ou comando que comprova a correção).

---

## 4. Mapa de Suítes e Comandos de Verificação

| Comando | Cobertura |
| :--- | :--- |
| `npm run lint` | Checagem estrita de TypeScript (`tsc --noEmit`) |
| `npm run lint:rules` | Auditoria estática das regras de segurança (`SCAN-16`) |
| `npm run build` | Compilação de produção do bundle principal (`dist/`) |
| `npm run build:apps` | Compilação dos 5 bundles Web independentes (`marketplace`, `store-os`, `waiter`, `driver`, `hq`) |
| `npm test` | Suíte base de regras de negócio e endpoints principais |
| `npm run test:security` | PBKDF2, HMAC, cookies `HttpOnly`, revogação, cofre AES-256-GCM, RBAC, anti-IDOR, Kill-Switch e Governança/Crescimento Marketplace |
| `npm run test:cross-platform` | Cabeçalhos RFC-001, Edge Node SQLite WAL, HLC, `sync_outbox` e `PARTIAL_PENDING` |
| `npm run test:sentinel-heavy` | Concorrência, idempotência, estoque delta e isolamento rigoroso entre tenants |
| `npm run test:phase3` | Paridade multiplataforma, contratos de empacotamento e fluxos avançados |
| `npm run test:e2e` | Fluxos completos: HQ -> OS Lojista -> Marketplace -> Garçom -> Motorista |
| `npm run sentinel` | Execução integral dos scanners (`SCAN-01..20`) + 21 suítes (`supabase-optional-connector` inclusa) + Logs de Deficiências, Melhorias e Matriz das 5 Personas |

---

## 5. Notas Operacionais de Execução

- **Banco local `server-db.json`:** Em desenvolvimento ativo, o arquivo `server-db.json` na raiz mantém o estado do servidor sandbox (incluindo hashes de usuários locais), protegido pelo `.gitignore`. Ele **não deve ser deletado localmente nem rastreado no Git**; em ambientes CI (`CI=true`), sua presença falha no `SCAN-11`.
- **Execução sequencial:** Em ambientes com limite de concorrência, execute `npm run build` + `npm run lint` primeiro e `npm run sentinel -- --skip-build` na sequência para evitar contenção de porta/recursos.
