# Política de Segurança — 3C Corp SaaS

## Versões Suportadas

| Versão | Suporte de Segurança |
| :--- | :--- |
| `5.2.x` | Ativo |
| `< 5.2.0` | Não suportado (atualize para a versão mais recente) |

## Como Reportar uma Vulnerabilidade

**Não publique detalhes em canais abertos** sobre falhas de segurança, vazamento de dados multi-tenant, bypass de RBAC ou credenciais expostas.

1. Reporte diretamente ao mantenedor oficial da plataforma pelo canal privado de segurança (`suporte@3ccorp.com.br` ou painel restrito de governança do **HQ Central**).
2. Inclua o pilar afetado (`HQ Central`, `Server Core`, `OS Lojista`, `Marketplace`, `App Garçom`, `App Motorista`), passos mínimos de reprodução e impacto estimado.
3. Todas as correções de segurança passam por validação automática na matriz negativa do **3C Sentinel 1.0**, checagem de regras Firestore (`npm run lint:rules`) e verificação estrita TypeScript (`npm run lint`).
