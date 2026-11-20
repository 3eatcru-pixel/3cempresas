# Sincronização, Offline-First e 3C Edge Node

Especificação da arquitetura de operação resiliente a quedas de internet no estabelecimento (**3C Edge Node**), persistência local em SQLite WAL, fila de sincronização (`sync_outbox`), relógios lógicos híbridos (**HLC**) e reconciliação determinística com o **Server Core**.

---

## 1. Objetivo Operacional

Estabelecimentos comerciais não podem parar de vender, emitir pedidos de salão ou enviar comandas para a cozinha (KDS) quando a conexão com a internet oscila.

O **3C Edge Node** (`servers/edge-node`, pacote `@3c/edge-node`) atua como servidor local na rede da loja (**LAN**):
- Mantém o **OS Lojista** (PDV, KDS, Mesas, Caixa) e o **App do Garçom** operando normalmente offline.
- Garante persistência imediata em disco via **SQLite WAL**.
- Enfileira mutações de forma idempotente e sincroniza automaticamente com o **Server Core** assim que a conectividade retorna.

---

## 2. Persistência Local (`SqliteWalDriver`)

- **Motor:** Módulo nativo `node:sqlite` (exige SQLite `>= 3.51.3`, incluso no Node `>= 22.23.0`).
- **Modo de journaling:** `WAL` (`Write-Ahead Logging`), garantindo leituras concorrentes rápidas e escrita segura contra queda de energia.
- **Autenticação local:** Emite e valida tokens assinados com prefixo `edg-tok:` compatíveis com o pareamento de dispositivos em LAN (incluindo QR/PIN do App do Garçom).
- **Descoberta e rede local:** Suporte a configuração de origem em LAN (CORS restrito à rede local e anúncio/descoberta mDNS para terminais).

### Comando para executar localmente
```bash
npm --workspace=@3c/edge-node run start
```

---

## 3. Protocolo de Sincronização (Push / Pull)

A comunicação entre Edge Node e Server Core utiliza um protocolo bidirecional idempotente baseado em **cursor (`cur_`)**, **outbox (`out_`)** e **HLC**:

### A. Fila de Saída (`sync_outbox`)
- Toda operação de escrita local (criação de pedido, mudança de status de mesa/KDS, movimentação de estoque, fechamento de caixa) grava na mesma transação SQLite o estado local e um evento na tabela `sync_outbox`.
- Cada item carrega um `Idempotency-Key` (`idm_`) único, evitando duplicidade caso uma resposta de rede seja perdida no meio do envio.

### B. Relógio Lógico Híbrido (HLC)
- Formato canônico: `<wall_ms>:<counter>:<node_id>`
- Garante ordenação causal consistente entre múltiplos nós mesmo quando relógios físicos sofrem pequeno desvio (*clock skew*).

### C. Paginação Limitada (`PARTIAL_PENDING`)
- Para evitar sobrecarga de memória ou timeouts após longos períodos offline, o ciclo de pull processa lotes paginados com teto de **50 páginas** por ciclo.
- Caso ainda existam eventos remotos pendentes ao atingir o limite, o servidor retorna o estado `PARTIAL_PENDING` com o último cursor (`cur_`), e o Edge Node agenda imediatamente a continuação do sincronismo sem travar a operação local.

---

## 4. Reconciliação Determinística de Conflitos

Conflitos não são resolvidos por sobrescrita cega. Cada agregado segue uma regra determinística baseada na natureza do dado:

| Domínio / Agregado | Estratégia de Reconciliação | Motivo |
| :--- | :--- | :--- |
| **Estoque (`stock_ledger`)** | **Delta-based / Append-only** (soma algébrica de entradas/saídas) | Evita perda de baixas simultâneas entre PDV offline e pedidos online do Marketplace |
| **Pedidos (`ord_`)** | **Máquina de estados monotônica + idempotência** | Impede regressão de status (ex.: pedido já entregue não volta para preparo) |
| **Caixa e Financeiro (`pay_` / `sal_`)** | **Append-only com `Idempotency-Key`** | Garante integridade contábil e impede cobrança ou lançamento duplicado |
| **Catálogo e Configurações (`prd_` / `str_`)** | **Autoridade Cloud + HLC (LWW causal)** | Alterações administrativas no perfil/catálogo convergem para a versão mais recente |
| **Mesas e Rodadas de Salão (`tbl_`)** | **Merge de itens incrementais por rodada** | Garçons diferentes na mesma mesa não apagam os pedidos uns dos outros |

---

## 5. Garantias e Limites Atuais

- **Verificado hoje:** `SqliteWalDriver`, emissão de tokens `edg-tok:`, fila `sync_outbox`, ordenação HLC, delta de `stock_ledger`, paginação `PARTIAL_PENDING` e suítes automatizadas (`npm run test:cross-platform` e `npm run test:phase3`).
- **Pendência conhecida fora do sandbox:** Testes de campo com múltiplos terminais físicos simultâneos, impressoras USB/Serial acopladas ao wrapper Tauri 2 e reconexão em redes LAN reais com perda de pacotes intermitente.
