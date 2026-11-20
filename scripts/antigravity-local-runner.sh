#!/usr/bin/env bash
# ==============================================================================
# 3C Corp SaaS v5.2.1 — Antigravity & Local Test Suite Runner
# ==============================================================================
# Executa a auditoria completa de código, testes de concorrência, segurança,
# isolamento multi-tenant, persistência SQLite WAL e scanner determinístico Sentinel.
# ==============================================================================

set -eo pipefail

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
YELLOW="\033[33m"
CYAN="\033[36m"
RESET="\033[0m"

echo -e "${BOLD}${CYAN}=================================================================${RESET}"
echo -e "${BOLD}${CYAN}🛡️  3C CORP SAAS — ANTIGRAVITY & LOCAL TEST RUNNER (v5.2.1)${RESET}"
echo -e "${BOLD}${CYAN}=================================================================${RESET}"

# 1. Checagem de Ambiente
echo -e "\n${BOLD}[1/4] Verificando Ambiente Local & Dependências...${RESET}"
NODE_VER=$(node -v || true)
NPM_VER=$(npm -v || true)
echo -e "  ✓ Node.js: ${GREEN}${NODE_VER}${RESET}"
echo -e "  ✓ npm:     ${GREEN}${NPM_VER}${RESET}"

# 2. Typecheck (tsc --noEmit)
echo -e "\n${BOLD}[2/4] Executando Typecheck Estrito TypeScript (Zero Lint Errors)...${RESET}"
npm run lint
echo -e "  ${GREEN}✓ Typecheck aprovado com 0 erros.${RESET}"

# 3. Compilação dos Apps
echo -e "\n${BOLD}[3/4] Verificando Builds do Portal e Aplicações Web...${RESET}"
npm run build
echo -e "  ${GREEN}✓ Build do Portal Web (Vite) concluído com sucesso.${RESET}"

# 4. Execução da Bateria de Testes em Sandbox Isolado
echo -e "\n${BOLD}[4/4] Executando Suítes de Homologação, Concorrência e Segurança...${RESET}"

RUN_STEP() {
  local title="$1"
  local cmd="$2"
  echo -e "\n  ${YELLOW}▶ Executando:${RESET} ${BOLD}${title}${RESET}"
  START_TS=$(date +%s)
  eval "$cmd"
  END_TS=$(date +%s)
  DURATION=$((END_TS - START_TS))
  echo -e "  ${GREEN}✓ Concluído em ${DURATION}s:${RESET} ${title}"
}

RUN_STEP "Auditoria Sênior & Checklist 12 Pontos" "npm test"
RUN_STEP "Matriz de Segurança HTTP & Isolamento Multitenant" "npm run test:security"
RUN_STEP "Cross-Platform Edge SQLite WAL & Reconciliação WAN" "npm run test:cross-platform"
RUN_STEP "Sentinel Heavy — Concorrência Promise.all, ACID & Cotas" "npm run test:sentinel-heavy"
RUN_STEP "Persistência Fase 3 — Stock Ledger & FSM de Pedidos" "npm run test:phase3"
RUN_STEP "Interação Ponta-a-Ponta dos 4 Pilares" "npm run test:e2e"
RUN_STEP "3C Sentinel 1.0 — Scanner Determinístico" "npm run sentinel:quick"

echo -e "\n${BOLD}${GREEN}=================================================================${RESET}"
echo -e "${BOLD}${GREEN}🏆 HOMOLOGAÇÃO COMPLETA: TODOS OS TESTES PASSARAM COM SUCESSO!${RESET}"
echo -e "${BOLD}${GREEN}O repositório está 100% auditado e pronto para o Antigravity e distribuição.${RESET}"
echo -e "${BOLD}${GREEN}=================================================================${RESET}\n"
