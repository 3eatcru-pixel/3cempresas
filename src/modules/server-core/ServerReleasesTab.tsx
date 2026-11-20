import React, { useEffect, useState } from 'react';
import { apiClient } from '../../core/api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useEcosystem } from '../../context/EcosystemContext';
import { Package, AlertTriangle, RefreshCw, FileCode2, ShieldCheck, Laptop } from 'lucide-react';

type FleetAdoptionMatrix = Awaited<ReturnType<typeof apiClient.getFleetAdoptionMatrix>>;

export const ServerReleasesTab: React.FC = () => {
  const { getIdToken } = useAuth();
  const { showNotification } = useEcosystem();
  const [releases, setReleases] = useState<any>(null);
  const [contracts, setContracts] = useState<any>(null);
  const [fleetMatrix, setFleetMatrix] = useState<FleetAdoptionMatrix | null>(null);
  const [loading, setLoading] = useState(true);

  const [checkAppId, setCheckAppId] = useState('store-os');
  const [checkVersion, setCheckVersion] = useState('5.2.1');
  const [checkPlatform, setCheckPlatform] = useState('desktop');
  const [checkResult, setCheckResult] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = (await getIdToken()) || undefined;
      const [rel, con, fleet] = await Promise.all([
        apiClient.getReleaseManifest(),
        apiClient.getContractsManifest(),
        token ? apiClient.getFleetAdoptionMatrix(token).catch(() => null) : Promise.resolve(null),
      ]);
      setReleases(rel);
      setContracts(con);
      if (fleet) setFleetMatrix(fleet);
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao carregar Release Manager.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleCheckCompatibility = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    try {
      const result = await apiClient.checkAppCompatibility({
        appId: checkAppId,
        version: checkVersion,
        platform: checkPlatform,
      });
      setCheckResult(result);
    } catch (err: any) {
      setCheckResult({ error: err?.message || 'Falha ao validar compatibilidade.' });
    } finally {
      setChecking(false);
    }
  };

  const productsList = releases?.products ? Object.values(releases.products) as any[] : [];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Summary */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-white uppercase tracking-tight">
              3C Release Manager, Frota &amp; Contratos (@3c/contracts)
            </h2>
            <p className="text-xs text-slate-400">
              Manifesto de versões suportadas para Web, Desktop Tauri, Android e adoção real da frota conectada.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Manifestos
        </button>
      </div>

      {/* Fleet Version Adoption Matrix */}
      {fleetMatrix && (
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Laptop className="w-4 h-4 text-cyan-400" />
              Matriz de Adoção da Frota (Terminais &amp; Edge Nodes)
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums text-slate-400">
              <span>Alvo: v{fleetMatrix.latestTargetVersion}</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400 font-bold">{fleetMatrix.counts.upToDate} atualizados</span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400 font-bold">{fleetMatrix.counts.outdated} defasados</span>
              <span aria-hidden="true">·</span>
              <span className="text-rose-400 font-bold">{fleetMatrix.counts.unsupported} incompatíveis</span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-left text-xs font-mono text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2">Origem</th>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Loja</th>
                  <th className="px-3 py-2">Versão</th>
                  <th className="px-3 py-2">Compatibilidade</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {fleetMatrix.fleet.map((node) => (
                  <tr key={`${node.kind}-${node.id}`} className="hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-slate-400">{node.kind}</td>
                    <td className="px-3 py-2 text-white font-bold">{node.name}</td>
                    <td className="px-3 py-2 text-slate-300 font-sans">{node.storeName}</td>
                    <td className="px-3 py-2 text-cyan-300 tabular-nums">v{node.appVersion}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          node.compatibility === 'UP_TO_DATE'
                            ? 'text-emerald-400 font-bold'
                            : node.compatibility === 'OUTDATED'
                            ? 'text-amber-400 font-bold'
                            : 'text-rose-400 font-bold'
                        }
                      >
                        {node.compatibility}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-400">{node.status}</td>
                  </tr>
                ))}
                {fleetMatrix.fleet.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500 font-sans">
                      Nenhum terminal ou Edge Node registrado no momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {fleetMatrix.observedHttpClients.length > 0 && (
            <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400">
              <span className="text-slate-300 font-bold">Clientes HTTP observados:</span>
              {fleetMatrix.observedHttpClients.map((c, idx) => (
                <span key={`${c.appId}-${c.platform}-${c.appVersion}`}>
                  {idx > 0 && <span className="mr-3">·</span>}
                  {c.appId}/{c.platform} v{c.appVersion} ({c.requests} reqs)
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Interactive Semver Compatibility Tester */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Validador Semver (/api/v1/system/releases/check)
          </h3>
          {contracts?.contractVersion && (
            <span className="text-[11px] font-mono text-amber-400">
              Contract v{contracts.contractVersion}
            </span>
          )}
        </div>

        <form onSubmit={handleCheckCompatibility} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select
            value={checkAppId}
            onChange={(e) => setCheckAppId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
          >
            {(contracts?.clientApps || ['hq', 'store-os', 'marketplace', 'driver', 'waiter']).map((app: string) => (
              <option key={app} value={app}>{app}</option>
            ))}
          </select>
          <input
            type="text"
            value={checkVersion}
            onChange={(e) => setCheckVersion(e.target.value)}
            placeholder="Versão (ex: 5.2.1)"
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono tabular-nums focus:outline-none"
          />
          <select
            value={checkPlatform}
            onChange={(e) => setCheckPlatform(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
          >
            <option value="web">web</option>
            <option value="desktop">desktop (Tauri)</option>
            <option value="android">android (Capacitor)</option>
          </select>
          <button
            type="submit"
            disabled={checking}
            className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            {checking ? 'Validando...' : 'Testar Compatibilidade'}
          </button>
        </form>

        {checkResult && (
          <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-emerald-300 overflow-x-auto">
            {JSON.stringify(checkResult, null, 2)}
          </pre>
        )}
      </div>

      {/* Product Manifests */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {productsList.map((prod) => (
          <div key={prod.appId} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-black text-white">{prod.displayName || prod.appId}</div>
                <div className="text-[11px] font-mono text-slate-500">{prod.appId}</div>
              </div>
              <span className="text-emerald-400 font-mono tabular-nums text-xs font-bold">
                v{prod.latestVersion}
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">{prod.releaseNotes}</p>

            <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px] font-mono tabular-nums">
              <div className="flex justify-between text-slate-400">
                <span>Mínima Suportada:</span>
                <span className="text-amber-400 font-bold">v{prod.minSupportedVersion}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Plataformas:</span>
                <span className="text-slate-200">
                  {Array.isArray(prod.platforms)
                    ? prod.platforms.join(', ')
                    : Array.isArray(prod.artifacts) && prod.artifacts.length > 0
                    ? Array.from(new Set(prod.artifacts.map((a: any) => a.platform).filter(Boolean))).join(', ')
                    : '--'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Artefatos:</span>
                <span className="text-cyan-400">{prod.artifacts?.length || 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Contracts Snapshot */}
      {contracts && (
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-amber-400" />
              Contrato de Domínio &amp; Máquina de Estados (/api/v1/system/contracts)
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              API Prefix: {contracts.apiPrefix || '/api/v1'}
            </span>
          </div>
          <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64">
            {JSON.stringify(contracts, null, 2)}
          </pre>
        </div>
      )}

      {!loading && productsList.length === 0 && (
        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Não foi possível carregar os manifestos de release.
        </div>
      )}
    </div>
  );
};
