import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Terminal as TerminalIcon, ChevronRight, Cpu, HardDrive, Wifi, WifiOff, ShieldCheck, Zap, Monitor } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { useAuth } from '../../../context/AuthContext';
import { useSyncStatus } from '../../../hooks/useSyncStatus';
import { apiClient } from '../../../core/api/apiClient';
import { getPlatformAdapters, detectLocalTerminalInfo } from '../../../core/platform/PlatformAdapter';

interface TerminalAppProps {
  onClose?: () => void;
}

export const TerminalApp: React.FC<TerminalAppProps> = ({ onClose }) => {
  const { currentStore, orders, menuItems } = useEcosystem();
  const { profile, user } = useAuth();
  const syncStatus = useSyncStatus();
  const localTerminal = useMemo(
    () =>
      detectLocalTerminalInfo({
        activeTransport: syncStatus.activeTransport,
        edgeBaseUrl: syncStatus.pairedEdge?.edgeBaseUrl,
      }),
    [syncStatus.activeTransport, syncStatus.pairedEdge?.edgeBaseUrl]
  );
  const [healthInfo, setHealthInfo] = useState<{
    status?: string;
    dbEngine?: string;
    uptimeSec?: number;
    latencyMs?: number;
  } | null>(null);
  const [history, setHistory] = useState<string[]>([
    '3C Commerce OS — Diagnostic Shell',
    `Loja ativa: ${currentStore.name} (${currentStore.id})`,
    'Kernel: CommerceEngine + API Corporativa 3C',
    '',
    'Digite "help" para ver os comandos disponíveis.',
    ''
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshHealth = async () => {
    const start = Date.now();
    try {
      const h = await apiClient.getHealth();
      const latencyMs = Date.now() - start;
      const next = {
        status: h?.status || 'ok',
        dbEngine: h?.persistenceDriver || h?.persistenceMode || h?.dbEngine || h?.database || 'Cloud API 3C',
        uptimeSec: typeof h?.uptimeSeconds === 'number' ? Math.round(h.uptimeSeconds) : typeof h?.uptime === 'number' ? Math.round(h.uptime) : undefined,
        latencyMs,
      };
      setHealthInfo(next);
      return next;
    } catch {
      setHealthInfo({ status: 'offline', latencyMs: undefined });
      return null;
    }
  };

  useEffect(() => {
    void refreshHealth();
  }, [currentStore.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const apiBase = getPlatformAdapters().network.getApiBaseUrl();
  const storeOrders = orders.filter(o => o.storeId === currentStore.id);
  const storeItems = menuItems.filter(i => i.storeId === currentStore.id);

  const commands: Record<string, (args: string[]) => void> = {
    help: () => {
      setHistory(prev => [...prev, 
        'Comandos disponíveis:',
        '  help       - Mostra esta ajuda',
        '  clear      - Limpa o terminal',
        '  status     - Consulta /api/v1/health e fila offline real',
        '  whoami     - Usuário autenticado, papel e tenant',
        '  ls         - Lista módulos e coleção da loja ativa',
        '  orders     - Resumo de pedidos reais da loja',
        '  stock      - Lista itens com estoque crítico',
        '  netstat    - Endpoints ativos (Cloud API / Edge LAN)',
        '  date       - Mostra data e hora local',
        '  exit       - Fecha o terminal'
      ]);
    },
    clear: () => setHistory([]),
    status: () => {
      void refreshHealth().then((h) => {
        setHistory(prev => [...prev, 
          'ESTADO REAL DO SISTEMA:',
          `  STORE: ${currentStore.name} (${currentStore.id})`,
          `  TENANT: ${currentStore.tenantId || 'tenant-1'} | PLAN: ${currentStore.subscriptionPlan || 'FREE'}`,
          `  TRANSPORT: ${syncStatus.activeTransport} (Fila pendente: ${syncStatus.totalPendingCount})`,
          `  CORE_HEALTH: ${h ? `${h.status} (${h.latencyMs}ms)` : 'OFFLINE / INACESSÍVEL'}`,
          `  ENGINE: ${h?.dbEngine || 'Local IndexedDB Outbox'}`,
          `  AUTH: ${user ? `AUTHENTICATED (${profile?.role || 'USER'})` : 'UNAUTHENTICATED'}`,
        ]);
      });
    },
    whoami: () => {
      setHistory(prev => [
        ...prev,
        `User: ${profile?.name || profile?.email || 'Sessão anônima'} (${profile?.role || 'GUEST'}) | Tenant: ${profile?.tenantId || currentStore.tenantId || 'N/A'}`
      ]);
    },
    ls: () => {
      setHistory(prev => [
        ...prev,
        `Módulos habilitados (${(currentStore.enabledModules || []).length}): ${(currentStore.enabledModules || []).join(', ') || 'padrão'}`,
        `Dados em memória: ${storeItems.length} itens de catálogo, ${storeOrders.length} pedidos`
      ]);
    },
    orders: () => {
      const active = storeOrders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');
      setHistory(prev => [
        ...prev, 
        `Resumo de Pedidos para ${currentStore.name}:`,
        `  Total em memória: ${storeOrders.length}`,
        `  Em andamento: ${active.length}`,
        ...active.slice(0, 5).map(o => `  - [${o.code}] ${o.customerName} - R$ ${o.total.toFixed(2)} (${o.status})`)
      ]);
    },
    stock: () => {
      const low = storeItems.filter(i => i.stock <= i.minStockAlert);
      setHistory(prev => [
        ...prev, 
        'Alertas de Estoque Crítico:',
        ...(low.length > 0 
          ? low.map(i => `  - ALERT: ${i.name} [Qtd: ${i.stock} | Min: ${i.minStockAlert}]`)
          : ['  OK: Todo o estoque acima do mínimo configurado.'])
      ]);
    },
    netstat: () => {
      setHistory(prev => [...prev, 
        'Channel        Endpoint                              State',
        `rest-api       ${apiBase.padEnd(36)}  ${healthInfo?.status === 'offline' ? 'UNREACHABLE' : 'CONNECTED'}`,
        `edge-lan       ${(syncStatus.pairedEdge?.edgeBaseUrl || 'Não pareado').padEnd(36)}  ${syncStatus.pairedEdge ? 'PAIRED' : 'IDLE'}`,
        `outbox-queue   ${String(syncStatus.totalPendingCount + ' pendentes').padEnd(36)}  ${syncStatus.activeTransport}`
      ]);
    },
    date: () => {
      setHistory(prev => [...prev, new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })]);
    },
    echo: (args) => {
      setHistory(prev => [...prev, args.join(' ')]);
    },
    exit: () => {
      if (onClose) onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const [cmd, ...args] = input.trim().toLowerCase().split(' ');
    setHistory(prev => [...prev, `> ${input}`]);

    if (commands[cmd]) {
      commands[cmd](args);
    } else {
      setHistory(prev => [...prev, `Comando não reconhecido: ${cmd}. Digite "help" para auxílio.`]);
    }

    setInput('');
  };

  const isOffline = syncStatus.activeTransport === 'OFFLINE' || healthInfo?.status === 'offline';

  return (
    <div className="flex flex-col h-full bg-slate-950 text-emerald-400 font-mono text-[11px] selection:bg-emerald-500/30">
      {/* Terminal Toolbar */}
      <div className="bg-slate-900 px-4 py-1.5 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">3C Shell (Diagnóstico Real)</span>
          {localTerminal.isLocalTerminal && (
            <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[9px] font-bold uppercase flex items-center gap-1">
              <Monitor className="w-3 h-3" /> {localTerminal.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-slate-500 text-[9px]">
          <span className="flex items-center gap-1">
            {isOffline ? <WifiOff className="w-3 h-3 text-rose-400" /> : <Wifi className="w-3 h-3 text-emerald-500" />}
            {syncStatus.activeTransport}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500" />
            {healthInfo?.latencyMs !== undefined ? `${healthInfo.latencyMs}ms` : 'N/A'}
          </span>
        </div>
      </div>

      {/* Terminal Output */}
      <div 
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-0.5"
      >
        {history.map((line, i) => (
          <div key={i} className={line.startsWith('>') ? 'text-white' : ''}>
            {line}
          </div>
        ))}
        
        {/* Input Line */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-1">
          <ChevronRight className="w-4 h-4 text-emerald-500 shrink-0" />
          <input
            autoFocus
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-emerald-400 font-mono text-[11px]"
            spellCheck={false}
          />
        </form>
      </div>

      {/* Bottom Status Bar */}
      <div className="bg-slate-900/50 px-4 py-1 border-t border-slate-800 flex items-center gap-6 text-[9px] text-slate-500 shrink-0">
        {localTerminal.isLocalTerminal && (
          <div className="flex items-center gap-1.5 text-cyan-400"><Monitor className="w-3 h-3" /> {localTerminal.label.toUpperCase()}</div>
        )}
        <div className="flex items-center gap-1.5"><Cpu className="w-3 h-3" /> OUTBOX: {syncStatus.totalPendingCount} PEND.</div>
        <div className="flex items-center gap-1.5"><HardDrive className="w-3 h-3" /> ENGINE: {healthInfo?.dbEngine || 'LOCAL'}</div>
        <div className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-emerald-600" /> ROLE: {profile?.role || 'GUEST'}</div>
      </div>
    </div>
  );
};
