# Segurança, Identidade e Padrão de IDs

Referência oficial de autenticação, autorização (RBAC), criptografia, gestão de sessões, inventário de credenciais de ambiente e padronização de identificadores do ecossistema **3C Corp SaaS**.

---

## 1. Princípios de Segurança Inegociáveis

1. **ID não é autorização:** Um identificador prefixado (`str_`, `ord_`, `usr_`, etc.) serve exclusivamente para tipagem semântica e rastreabilidade. Toda rota valida sessão autenticada, papel (`role`), escopo de produto e posse do recurso (`storeId` / `userId` / `driverId`) no servidor.
2. **Fail-Closed por padrão:** Perfis restritos (`BRANCH_LOCKED_ROLES`), escopos inválidos, assinaturas corrompidas ou cabeçalhos ausentes resultam em negação (`401`/`403`), nunca em fallback permissivo.
3. **Separação de identidades por produto:** Um usuário autenticado no Marketplace (`CUSTOMER`) não tem acesso ao OS Lojista nem ao HQ; um `WAITER` ou `COURIER` não abre o OS Lojista; um lojista (`OWNER`/`MANAGER`) não acessa rotas de governança do HQ.
4. **Segregação de ambientes:** Contas `[DEMO]` existem apenas para sandbox/homologação e nunca devem ser usadas como credenciais de produção.

---

## 2. Criptografia, Sessões e Cofre de Integrações

| Mecanismo | Implementação no Server Core |
| :--- | :--- |
| **Hash de senhas** | `PBKDF2-HMAC-SHA512` com `100.000` iterações, salt aleatório de 16 bytes e validação de limites (`10.000..500.000`) |
| **Comparação segura** | `crypto.timingSafeEqual` para validação de digests e tokens contra timing attacks |
| **Tokens de sessão** | Assinatura `HMAC-SHA256` (`dev-token:` no Server Core e `edg-tok:` no Edge Node) |
| **Transporte no navegador** | Cookie `HttpOnly` (`3ccorp_session`), `SameSite`, compatível com iframe/preview e envio seguro em produção |
| **Revogação imediata** | Controle por `tokenVersion` e `tokenRevokedAtSec` em cada usuário/sessão |
| **Cofre de segredos** | Criptografia autenticada `AES-256-GCM` para chaves de integrações (WhatsApp, gateways, webhooks) |
| **Pareamento BYOD (Garçom / Motorista)** | QR Code + PIN de curta duração com bloqueio automático após **5 tentativas inválidas** |
| **Idempotência** | Cabeçalho `Idempotency-Key` (`idm_`) persistido para impedir duplicação de pedidos, pagamentos e eventos de sync |

---

## 3. Inventário de Credenciais (Desenvolvimento e Sandbox)

### Conta Master de Governança (`DEV_OWNER`)
- **Identificador:** `3eatcru@gmail.com` (criador da plataforma `3eatcru`)
- **Senha:** Definida via variável de ambiente `INITIAL_DEV_PASSWORD`. Caso não informada em bootstrap limpo, uma senha segura CSPRNG é gerada no servidor — nunca há senha fraca hardcoded em produção.

### Contas `[DEMO]` para Testes Locais (Sandbox)
Disponíveis apenas no banco sandbox de desenvolvimento para validar cada persona e barreira RBAC:

| Persona | E-mail `[DEMO]` | Papel (`role`) | Produto Alvo |
| :--- | :--- | :--- | :--- |
| Admin de Governança (Demo) | `dev@3c-os.com` | `SUPER_ADMIN` | HQ Central |
| Lojista / Proprietário | `burgerlab@3c-os.com` | `OWNER` | OS Lojista |
| Operador de Caixa | `caixa01@3c-os.com` | `CASHIER` | OS Lojista (PDV / Caixa) |
| Operador de Cozinha | `cozinha@3c-os.com` | `KITCHEN` | OS Lojista (KDS) |
| Garçom de Salão | `garcom03@3c-os.com` | `WAITER` | App do Garçom |
| Entregador / Motorista | `carlos.driver@3c-os.com` | `COURIER` | App do Motorista |

> **Atenção:** Nunca expor credenciais demo em interfaces de produção e nunca incluir senhas reais em documentação ou commits.

---

## 4. Isolamento Multi-Tenant e Proteção Anti-IDOR

- **Escopo de empresa (`storeId` / `tenantId`):** Toda operação de catálogo, estoque, caixa, equipe, mesas, pedidos ou integrações no OS Lojista vincula o `storeId` diretamente do token de sessão (nunca confia cegamente no corpo da requisição).
- **Escopo do consumidor:** Pedidos, endereços, favoritos e avaliações no Marketplace validam a titularidade do consumidor autenticado (`customerId` / `userId`), impedindo enumeração ou leitura de pedidos de terceiros (anti-IDOR).
- **Escopo de entrega:** Entregadores só conseguem confirmar check-in/PIN ou ler detalhes sensíveis de entregas formalmente atribuídas a si (`driverId`).
- **Ações destrutivas no HQ:** Exigem papel apropriado (`DEV_OWNER` vs `SUPER_ADMIN`), confirmação em 2 etapas na UI e trilha de auditoria imutável (`aud_`).

---

## 5. Padrão Oficial de Identificadores (Prefixos)

Todos os recursos persistidos adotam prefixos canônicos curtos para facilitar diagnóstico, logs estruturados e rastreabilidade sem ambiguidade:

| Domínio | Prefixos Oficiais |
| :--- | :--- |
| **Plataforma e Governança** | `plat_` (plataforma), `tnt_` (tenant), `str_` (loja/estabelecimento), `pln_` (plano), `lic_` (licença), `sub_` (assinatura) |
| **Identidade e Acesso** | `usr_` (usuário), `rol_` (papel/RBAC), `ses_` (sessão), `dvc_` (dispositivo), `trm_` (terminal) |
| **Catálogo e Operação** | `prd_` (produto/serviço), `cat_` (categoria), `stk_` (movimento de estoque), `tbl_` (mesa), `res_` (reserva) |
| **Comercial e Financeiro** | `cst_` (cliente), `sup_` (fornecedor), `ord_` (pedido), `sal_` (venda), `pay_` (pagamento), `cpn_` (cupom) |
| **Logística** | `dlv_` (entrega), `drv_` (motorista/entregador) |
| **Infraestrutura e Sync** | `itg_` (integração), `evt_` (evento), `aud_` (auditoria), `ntf_` (notificação), `req_` (requisição), `idm_` (idempotência), `edg_` (edge node), `cur_` (cursor de sync), `out_` (item de outbox) |

**Regra permanente:** Prefixos organizam dados e depuração, mas **nunca substituem checagens de autorização no servidor**.
