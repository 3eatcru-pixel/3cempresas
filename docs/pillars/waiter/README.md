# Pilar 5 — App do Garçom (Waiter BYOD)

Aplicativo operacional leve, otimizado para smartphones em modelo **BYOD** (*Bring Your Own Device*), dedicado ao atendimento de salão, lançamento rápido de comandas e comunicação direta com a cozinha (KDS) e o caixa do **OS Lojista**.

- **Identificador:** `waiter` (`?app=waiter`)
- **Identidade visual:** Pink `#ec4899` · `/favicons/waiter.svg`
- **Código principal:** `src/components/pillars/WaiterPillar.tsx` · `src/modules/waiter/*`
- **Rotas de API:** `/api/v1/waiter/*`

---

## 1. Separação de Identidade e Segurança

- **Acesso exclusivo ao atendimento:** O perfil `WAITER` possui fluxo próprio de entrada e permanece estritamente bloqueado de acessar o **OS Lojista**, o financeiro da empresa ou o **HQ Central**.
- **Pareamento seguro (QR Code / PIN):**
  - O gerente/proprietário gera um código de pareamento no **OS Lojista**.
  - O garçom conecta o aparelho via QR Code ou PIN tanto em modo **Cloud (Server Core)** quanto em **LAN Offline (3C Edge Node)**.
  - **Proteção contra força bruta:** Bloqueio automático após **5 tentativas inválidas** consecutivas de PIN.
- **Revogação imediata:** O desligamento de um dispositivo no OS Lojista invalida o token (`tokenVersion` / `edg-tok:`) na hora.

---

## 2. Fluxo Operacional de Salão

1. **Mapa de Mesas em Tempo Real:** Visualização clara de mesas livres, ocupadas, aguardando preparo ou em fechamento, sincronizadas com o OS Lojista.
2. **Consulta Rápida de Cardápio:** Busca ágil por produtos, adicionais, observações de preparo e disponibilidade real da loja.
3. **Rodadas Incrementais para o KDS:** Cada novo pedido adicionado à mesa é enviado como rodada incremental diretamente para a cozinha (KDS), evitando duplicação de itens já enviados e permitindo que múltiplos garçons atendam a mesma mesa sem conflito.
4. **Conferência e Divisão de Conta (*Split-Ticket*):** Permite revisar itens consumidos, calcular divisão por pessoas/itens e sinalizar fechamento ao caixa do OS Lojista.

---

## 3. Resiliência Offline (LAN / Edge Node)

Quando a loja opera com o **3C Edge Node** na rede Wi-Fi local, o App do Garçom continua abrindo mesas e enviando rodadas ao KDS mesmo sem internet externa. As mutações são gravadas em SQLite WAL e reconciliadas com o Server Core via `sync_outbox` assim que a conexão é restabelecida.
