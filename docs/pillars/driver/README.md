# Pilar 6 — App do Motorista (Driver Dual-Fleet)

Aplicativo operacional único para entregadores que suporta simultaneamente dois modelos de operação logística (**Dual-Fleet**): entregadores independentes da rede da plataforma (`PLATFORM_FLEET`) e entregadores vinculados à frota própria de uma loja (`STORE_FLEET`).

- **Identificador:** `driver` (`?app=driver`)
- **Identidade visual:** Sky `#0ea5e9` · `/favicons/driver.svg`
- **Código principal:** `src/components/pillars/DriverPillar.tsx` · `src/modules/driver/*` · `src/hooks/ecosystem/useLogistics.ts`
- **Rotas de API:** `/api/v1/driver/*` · `/api/v1/logistics/*` · `/api/v1/maps/*`

---

## 1. Arquitetura Dual-Fleet e Autenticação

Um único aplicativo com interface dedicada ao entregador (isolada do OS Lojista e do HQ), operando em dois modos claros:

- **`PLATFORM_FLEET` (Frota da Plataforma):** Entregador autenticado com conta própria de motorista (`COURIER` / `DRIVER`), governado pelo **HQ Central**, capaz de receber corridas disponíveis de múltiplos estabelecimentos da rede.
- **`STORE_FLEET` (Frota Própria do Lojista):** Entregador pareado diretamente a um estabelecimento específico via **QR Code / PIN** emitido no **OS Lojista**, operando exclusivamente entregas daquela loja.

---

## 2. Fluxo Operacional de Entregas

### Controle de Turno e Aceite Seguro
- **Guarda de turno offline:** O entregador controla explicitamente seu status online/offline; quando offline, não recebe nem aceita despachos acidentalmente.
- **Trava contra duplo aceite:** Proteção no cliente e no servidor (`Idempotency-Key` + verificação atômica) impede que o mesmo pedido seja aceito duas vezes ou tomado por dois motoristas simultaneamente.

### Mapa, Roteirização Multi-Parada e Confirmação
- **Sequenciamento alinhado ao OSRM:** Pedidos agrupados em lote seguem a ordem real de paradas retornada pelo roteirizador OSRM sobre mapas OpenFreeMap/PMTiles.
- **Estado isolado por parada:** Check-in de chegada e entrada do **PIN de 4 dígitos** são mantidos isolados por entrega (`orderId`), evitando vazamento de código ou confirmação cruzada entre paradas de um mesmo lote.
- **Detalhes operacionais reais:** Endereço, instruções de entrega, itens e contato direto com a loja (WhatsApp real do estabelecimento quando disponível).

### Carteira, Ganhos e Perfil do Entregador
- **Painel de ganhos e histórico:** Acompanhamento de entregas concluídas, gráfico de ganhos, repasses e chave PIX do entregador.
- **Preferências persistentes:** Configurações do aplicativo (navegação, alertas, preferências operacionais) salvas em `localStorage`.
- **Suporte operacional real:** Registro de chamados reais de ocorrência vinculados ao pedido/turno e contato direto com o suporte/estabelecimento.
- **Proteção de saída (Logout em 2 etapas):** Exige confirmação antes de encerrar a sessão e exibe aviso reforçado caso existam entregas ativas em andamento.

---

## 3. Empacotamento e Limites Atuais

- **Web / PWA (Verificado):** Todas as abas (`DriverMapTab`, `DriverOrdersTab`, `DriverEarningsTab`, `DriverProfileTab`) e fluxos logísticos validados nas suítes do servidor e no 3C Sentinel 1.0.
- **Android Capacitor (Scaffold pronto — pendente build Gradle):** GPS em segundo plano contínuo e empacotamento APK/AAB exigem compilação em ambiente Android SDK/Gradle local.
