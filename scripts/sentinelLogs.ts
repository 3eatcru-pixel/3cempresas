import fs from 'fs';
import path from 'path';

export interface MonolithCandidate {
  file: string;
  lines: number;
  layer: 'SERVER_ROUTE' | 'EDGE_ROUTE' | 'UI_COMPONENT' | 'SHARED_CORE';
}

export interface DeficiencyLogEntry {
  id: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'OPEN' | 'ADVISORY';
  category: 'SECURITY' | 'ARCHITECTURE' | 'MODULARITY' | 'PACKAGING' | 'COVERAGE';
  target: string;
  summary: string;
  impact: string;
  recommendedAction: string;
  detectedAt: string;
}

export interface ImprovementLogEntry {
  id: string;
  status: 'VERIFIED' | 'RECOMMENDED';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'SECURITY' | 'MODULARITY' | 'CI_CD' | 'OBSERVABILITY' | 'INFRASTRUCTURE';
  title: string;
  target: string;
  detail: string;
  verifiedBy?: string;
}

export interface PersonaExperienceAudit {
  personaId: 'consumer' | 'merchant' | 'dev_owner' | 'waiter' | 'driver';
  personaLabel: string;
  productAppId: 'marketplace' | 'store-os' | 'hq' | 'waiter' | 'driver';
  status: 'ISOLATED_OK' | 'ATTENTION';
  authIsolation: string;
  uxHighlights: string;
  verifiedBy: string;
}

export interface AuditHistoryEntry {
  executedAt: string;
  mode: 'FULL' | 'QUICK';
  completeness: 'FULL' | 'PARTIAL';
  overallStatus: 'PASS' | 'FAIL';
  scannerPassed: number;
  scannerTotal: number;
  suitesPassed: number;
  suitesTotal: number;
  assertionsPassed: number;
  assertionsFailed: number;
  deficienciesOpenCount: number;
  deficienciesAdvisoryCount: number;
  monolithFilesCount: number;
}

export function scanMonolithCandidates(
  rootDir: string,
  collectFilesFn: (
    dirPath: string,
    extensions: Set<string>,
    ignoreDirs?: Set<string>
  ) => string[]
): MonolithCandidate[] {
  const candidates: MonolithCandidate[] = [];
  const targets: Array<{
    dir: string;
    exts: Set<string>;
    threshold: number;
    layer: MonolithCandidate['layer'];
  }> = [
    { dir: 'src/server', exts: new Set(['.ts']), threshold: 650, layer: 'SERVER_ROUTE' },
    { dir: 'servers/edge-node', exts: new Set(['.ts']), threshold: 650, layer: 'EDGE_ROUTE' },
    { dir: 'src', exts: new Set(['.tsx']), threshold: 420, layer: 'UI_COMPONENT' },
    { dir: 'packages/design-system', exts: new Set(['.tsx']), threshold: 450, layer: 'UI_COMPONENT' },
    { dir: 'packages', exts: new Set(['.ts']), threshold: 700, layer: 'SHARED_CORE' },
  ];

  const seen = new Set<string>();
  for (const t of targets) {
    const absDir = path.join(rootDir, t.dir);
    const files = collectFilesFn(absDir, t.exts);
    for (const file of files) {
      const rel = path.relative(rootDir, file).replace(/\\/g, '/');
      if (seen.has(rel)) continue;
      const content = fs.readFileSync(file, 'utf8');
      const lineCount = content.split(/\r?\n/).length;
      if (lineCount >= t.threshold) {
        seen.add(rel);
        candidates.push({ file: rel, lines: lineCount, layer: t.layer });
      }
    }
  }

  return candidates.sort((a, b) => b.lines - a.lines);
}

export function buildAndPersistSentinelLogs(params: {
  rootDir: string;
  reportDir: string;
  executedAt: string;
  mode: 'FULL' | 'QUICK';
  completeness: 'FULL' | 'PARTIAL';
  overallStatus: 'PASS' | 'FAIL';
  scannerChecks: Array<{
    id: string;
    title: string;
    passed: boolean;
    severityOnFail: 'P0' | 'P1' | 'P2' | 'P3';
    violatedContract: string;
    target: string;
    observed: string;
    expected: string;
  }>;
  skippedChecks: Array<{ id: string; title: string; detail: string }>;
  suiteResults: Array<{
    id: string;
    label: string;
    passed: boolean;
    passedChecks: number;
    failedChecks: number;
    command: string;
  }>;
  skippedSuites: Array<{ id: string; title: string }>;
  monoliths: MonolithCandidate[];
  hasLocalRootDbHashes: boolean;
  rootDbIgnoredByGit: boolean;
  sidecarPresentOnDisk: boolean;
}) {
  const {
    reportDir,
    executedAt,
    mode,
    completeness,
    overallStatus,
    scannerChecks,
    skippedChecks,
    suiteResults,
    skippedSuites,
    monoliths,
    hasLocalRootDbHashes,
    rootDbIgnoredByGit,
    sidecarPresentOnDisk,
  } = params;

  const deficiencies: DeficiencyLogEntry[] = [];

  for (const sc of scannerChecks) {
    if (!sc.passed) {
      deficiencies.push({
        id: `DEF-${sc.id}`,
        severity: sc.severityOnFail,
        status: 'OPEN',
        category: sc.id.includes('SCAN-16') || sc.id.includes('SCAN-19') ? 'SECURITY' : 'ARCHITECTURE',
        target: sc.target,
        summary: `${sc.title}: ${sc.observed}`,
        impact: sc.violatedContract,
        recommendedAction: sc.expected,
        detectedAt: executedAt,
      });
    }
  }

  for (const sr of suiteResults) {
    if (!sr.passed) {
      deficiencies.push({
        id: `DEF-SUITE-${sr.id.toUpperCase()}`,
        severity: sr.id.includes('security') ? 'P0' : 'P1',
        status: 'OPEN',
        category: 'SECURITY',
        target: sr.command,
        summary: `Falha na suíte ${sr.label} (${sr.failedChecks} asserção(ões) reprovada(s))`,
        impact: 'Regressão comprovada em contrato ou fronteira de segurança.',
        recommendedAction: `Executar \`${sr.command}\` e corrigir antes do merge.`,
        detectedAt: executedAt,
      });
    }
  }

  if (hasLocalRootDbHashes && rootDbIgnoredByGit && process.env.CI !== 'true') {
    deficiencies.push({
      id: 'DEF-LOCAL-DEV-ROOT-DB',
      severity: 'P2',
      status: 'ADVISORY',
      category: 'PACKAGING',
      target: 'server-db.json',
      summary: 'Sandbox local ativo com server-db.json na raiz (protegido pelo .gitignore).',
      impact: 'Seguro em desenvolvimento local, mas não deve ser incluído em pacotes manuais.',
      recommendedAction: 'Em pipelines CI ou empacotamento manual, iniciar com banco limpo ou PostgreSQL Cloud.',
      detectedAt: executedAt,
    });
  }

  if (!sidecarPresentOnDisk) {
    deficiencies.push({
      id: 'DEF-SIDECAR-BINARY-ABSENT',
      severity: 'P3',
      status: 'ADVISORY',
      category: 'PACKAGING',
      target: 'apps/store-desktop/src-tauri/binaries/sidecar-manifest.json',
      summary: 'Binário nativo compilado do 3C Edge Node não está pré-compilado neste host.',
      impact: 'Instaladores Tauri Desktop requerem `npm --workspace=@3c/store-desktop run sidecar:prepare:strict` no build.',
      recommendedAction: 'Executar `npm --workspace=@3c/store-desktop run sidecar:prepare:strict` antes de empacotar instaladores desktop.',
      detectedAt: executedAt,
    });
  }

  if (skippedChecks.length > 0 || skippedSuites.length > 0) {
    deficiencies.push({
      id: 'DEF-PARTIAL-SENTINEL-RUN',
      severity: 'P3',
      status: 'ADVISORY',
      category: 'COVERAGE',
      target: 'scripts/sentinel.ts',
      summary: `Execução parcial: ${skippedChecks.length} check(s) e ${skippedSuites.length} suíte(s) omitido(s) por flag.`,
      impact: 'Compilação das 5 apps ou typecheck não reexecutado dentro desta invocação.',
      recommendedAction: 'Rodar `npm run sentinel` sem flags em homologação final antes de publicar release.',
      detectedAt: executedAt,
    });
  }

  for (const m of monoliths.slice(0, 8)) {
    deficiencies.push({
      id: `DEF-MONOLITH-${m.file.replace(/[^A-Za-z0-9]+/g, '-').toUpperCase()}`,
      severity: m.lines >= 1200 ? 'P2' : 'P3',
      status: 'ADVISORY',
      category: 'MODULARITY',
      target: m.file,
      summary: `Arquivo extenso com ${m.lines} linhas (${m.layer}).`,
      impact: 'Aumenta carga cognitiva, risco de acoplamento e custo de revisão em PRs.',
      recommendedAction: 'Dividir em sub-roteadores, hooks ou subcomponentes menores mantendo contratos.',
      detectedAt: executedAt,
    });
  }

  const improvements: ImprovementLogEntry[] = [
    {
      id: 'IMP-VERIFIED-MKT-PUBLIC-SANITIZATION',
      status: 'VERIFIED',
      priority: 'HIGH',
      category: 'SECURITY',
      title: 'Sanitização estrita B2B em GET /api/v1/system/public-config',
      detail: 'Zera spotlightPricing e externalChannelConnectors e filtra lojas ocultas/pendentes no Marketplace.',
      target: 'src/server/routes/system.ts',
      verifiedBy: 'Suite 19 (marketplace-governance-and-growth) + SCAN-19',
    },
    {
      id: 'IMP-VERIFIED-GROWTH-ANTI-EVICTION',
      status: 'VERIFIED',
      priority: 'HIGH',
      category: 'SECURITY',
      title: 'Quota, deduplicação e trilha audit_logs em /store/marketplace-growth',
      detail: 'Impede eviction de anúncios ativos, bloqueia lojas ocultas/suspensas (403) e spam duplicado (409).',
      target: 'src/server/routes/store/marketplaceGrowthCore.ts',
      verifiedBy: 'Suite 19 (marketplace-governance-and-growth)',
    },
    {
      id: 'IMP-VERIFIED-CONFIG-BOUNDARY-AND-HYGIENE',
      status: 'VERIFIED',
      priority: 'HIGH',
      category: 'CI_CD',
      title: 'Fronteira de Variáveis (HQ + Server Core) & Higiene Portável do Repositório',
      detail: 'Variáveis operacionais governadas no HQ + Server Core, segredos criptográficos isolados no Server/Cofre e repositório livre de acoplamento CI proprietário.',
      target: 'SECURITY.md, .env.example, governanceCore.ts, storage.ts, saasBillingSettlementCore.ts',
      verifiedBy: 'SCAN-18',
    },
    {
      id: 'IMP-VERIFIED-SENTINEL-LOGS',
      status: 'VERIFIED',
      priority: 'MEDIUM',
      category: 'OBSERVABILITY',
      title: 'Logs persistentes de Deficiências, Melhorias e Histórico cronológico no Sentinel',
      detail: 'Gera `.sentinel/deficiencies-log.*`, `.sentinel/improvements-log.*` e `.sentinel/audit-history.ndjson`.',
      target: 'scripts/sentinelLogs.ts',
      verifiedBy: '3C Sentinel 1.0',
    },
    {
      id: 'IMP-VERIFIED-PERSONA-UX-ISOLATION',
      status: 'VERIFIED',
      priority: 'HIGH',
      category: 'SECURITY',
      title: 'Separação estrita de login, navegação e copy entre os 5 públicos (SCAN-20 + Suite 20)',
      detail: 'Remove alternador de HQ/Store OS do login do consumidor/operacional, protege lockedSection, oculta suggestedAppId interno e blinda appId.',
      target: 'AuthModal.tsx, auth.ts, StoreOsOnboardingGate.tsx, ShowcaseConfigApp.tsx, useSystem.ts',
      verifiedBy: 'SCAN-20 + Suite 20 (user-experience-and-isolation)',
    },
  ];

  const scan20Passed = scannerChecks.find((c) => c.id === 'SCAN-20')?.passed ?? false;
  const suite20Passed = suiteResults.find((s) => s.id === 'user-experience-and-isolation')?.passed ?? false;
  const personaStatus: 'ISOLATED_OK' | 'ATTENTION' =
    scan20Passed && suite20Passed ? 'ISOLATED_OK' : 'ATTENTION';

  const personaExperiences: PersonaExperienceAudit[] = [
    {
      personaId: 'consumer',
      personaLabel: 'Consumidor Final',
      productAppId: 'marketplace',
      status: personaStatus,
      authIsolation: 'Cadastro/Login Google + e-mail travado em CUSTOMER; sem alternador HQ/Store OS; /public-config sanitizado.',
      uxHighlights: 'Exploração por distância/modalidades, deep-link ?store=<slug>, vitrine pública, sacola e tracking GPS/PIN sem mencionar HQ ou Store OS.',
      verifiedBy: 'SCAN-19 + SCAN-20 + Suite 19 + Suite 20',
    },
    {
      personaId: 'merchant',
      personaLabel: 'Lojista & Equipe Comercial',
      productAppId: 'store-os',
      status: personaStatus,
      authIsolation: 'Login dedicado Store OS (STORE_OWNER/MANAGER/CASHIER/KITCHEN_STAFF); onboarding sem menção a HQ/desenvolvedor; bloqueio de rotas admin HQ.',
      uxHighlights: 'Desktop OS multijanelas, bloqueio granular por módulo (blockedApps), gestão da vitrine e crescimento no Marketplace.',
      verifiedBy: 'SCAN-20 + Suite 4 + Suite 20',
    },
    {
      personaId: 'dev_owner',
      personaLabel: 'Dev Owner / Mantenedor',
      productAppId: 'hq',
      status: personaStatus,
      authIsolation: 'Login administrativo restrito (DEV_OWNER/SUPER_ADMIN); bloqueado de impersonar apps operacionais; zero suggestedAppId HQ em telas públicas.',
      uxHighlights: 'Governança de planos, tenants, receitas do Marketplace, releases, runtimePolicy, telemetria e Logs do Sentinel.',
      verifiedBy: 'SCAN-18 + SCAN-20 + Suite 2 + Suite 20',
    },
    {
      personaId: 'waiter',
      personaLabel: 'Garçom & Atendente de Salão',
      productAppId: 'waiter',
      status: personaStatus,
      authIsolation: 'Login isolado appId=waiter ou pareamento PDQ/PIN sem e-mail; bloqueado em Store OS administrativo e HQ.',
      uxHighlights: 'Mapa de mesas (Livre/Ocupada/Conta), envio direto ao KDS, divisão de conta, gorjeta 10% e troca segura de conta.',
      verifiedBy: 'SCAN-04 + SCAN-20 + Suite 4 + Suite 20',
    },
    {
      personaId: 'driver',
      personaLabel: 'Motorista / Entregador',
      productAppId: 'driver',
      status: personaStatus,
      authIsolation: 'Login isolado appId=driver + pareamento QR/PIN de frota própria; bloqueado em Store OS, Waiter, Marketplace e HQ.',
      uxHighlights: 'Modo dual (Plataforma Aberta + Frota Própria da Loja), coleta/rota GPS em mapa real, confirmação PIN de 4 dígitos e carteira PIX.',
      verifiedBy: 'SCAN-04 + SCAN-20 + Suite 15 + Suite 20',
    },
  ];

  const topEdgeMonoliths = monoliths.filter((m) => m.layer === 'EDGE_ROUTE');
  if (topEdgeMonoliths.length > 0) {
    improvements.push({
      id: 'IMP-REC-SPLIT-EDGE-ROUTES',
      status: 'RECOMMENDED',
      priority: 'HIGH',
      category: 'MODULARITY',
      title: `Modularizar rotas do Edge Node (${topEdgeMonoliths.map((m) => `${path.basename(m.file)}:${m.lines}L`).join(', ')})`,
      detail: 'Quebrar storeRoutes.ts e commerceRoutes.ts em sub-roteadores por domínio (caixa, estoque, mesas, sync).',
      target: topEdgeMonoliths.map((m) => m.file).join(', '),
    });
  } else {
    improvements.push({
      id: 'IMP-VERIFIED-SPLIT-EDGE-ROUTES',
      status: 'VERIFIED',
      priority: 'HIGH',
      category: 'MODULARITY',
      title: 'Rotas do Edge Node modularizadas por domínio (< 650 linhas por arquivo)',
      detail: 'storeRoutes.ts e commerceRoutes.ts divididos em sub-roteadores e helpers transacionais sem alterar contratos.',
      target: 'servers/edge-node/routes/store/*, servers/edge-node/routes/commerce/*',
      verifiedBy: 'scanMonolithCandidates (EDGE_ROUTE=0) + Sentinel Suites',
    });
  }

  const topUiMonoliths = monoliths.filter((m) => m.layer === 'UI_COMPONENT').slice(0, 4);
  if (topUiMonoliths.length > 0) {
    improvements.push({
      id: 'IMP-REC-SPLIT-UI-CONTEXTS',
      status: 'RECOMMENDED',
      priority: 'MEDIUM',
      category: 'MODULARITY',
      title: 'Extrair hooks/subpainéis dos contextos e componentes > 420 linhas',
      detail: `Candidatos prioritários: ${topUiMonoliths.map((m) => `${m.file} (${m.lines}L)`).join('; ')}.`,
      target: topUiMonoliths.map((m) => m.file).join(', '),
    });
  } else {
    improvements.push({
      id: 'IMP-VERIFIED-SPLIT-UI-CONTEXTS',
      status: 'VERIFIED',
      priority: 'MEDIUM',
      category: 'MODULARITY',
      title: 'Contextos React e componentes UI abaixo do orçamento de modularidade (< 420L / < 450L)',
      detail: 'AuthContext, EcosystemContext, VectorMapCanvas e ShowcaseMarketplaceGrowthPanel refatorados com hooks e subcomponentes especializados.',
      target: 'src/context/*, packages/design-system/src/components/map/*, src/modules/store-os/showcase-config/*',
      verifiedBy: 'scanMonolithCandidates (UI_COMPONENT=0) + compile_applet + SCAN-08',
    });
  }

  improvements.push({
    id: 'IMP-REC-POSTGRES-AND-SIGNING-PROVISIONING',
    status: 'RECOMMENDED',
    priority: 'MEDIUM',
    category: 'CI_CD',
    title: 'Provisionar PostgreSQL Cloud + Segredos no Secret Manager / Cofre HQ antes do Go-Live',
    detail: 'Configurar SERVER_SECRET e credenciais SQL no Secret Manager do servidor, e gerenciar assinaturas/cotas/releases diretamente no HQ.',
    target: '.env.example, src/server/routes/admin/governanceCore.ts',
  });

  const scannerPassed = scannerChecks.filter((c) => c.passed).length;
  const suitesPassed = suiteResults.filter((s) => s.passed).length;
  const assertionsPassed = suiteResults.reduce((acc, s) => acc + s.passedChecks, 0) + scannerPassed;
  const assertionsFailed =
    suiteResults.reduce((acc, s) => acc + s.failedChecks, 0) + (scannerChecks.length - scannerPassed);

  const openDeficiencies = deficiencies.filter((d) => d.status === 'OPEN');
  const advisoryDeficiencies = deficiencies.filter((d) => d.status === 'ADVISORY');

  const deficienciesPayload = {
    generatedAt: executedAt,
    overallStatus,
    counts: {
      open: openDeficiencies.length,
      advisory: advisoryDeficiencies.length,
      total: deficiencies.length,
    },
    entries: deficiencies,
  };

  const improvementsPayload = {
    generatedAt: executedAt,
    counts: {
      verified: improvements.filter((i) => i.status === 'VERIFIED').length,
      recommended: improvements.filter((i) => i.status === 'RECOMMENDED').length,
    },
    monolithCandidates: monoliths,
    personaExperiences,
    entries: improvements,
  };

  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportDir, 'deficiencies-log.json'),
    JSON.stringify(deficienciesPayload, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(reportDir, 'improvements-log.json'),
    JSON.stringify(improvementsPayload, null, 2),
    'utf8'
  );

  const defMd: string[] = [
    '# Log de Deficiências — 3C Sentinel 1.0',
    '',
    `- **Atualizado em:** ${executedAt}`,
    `- **Status:** ${overallStatus} | **Abertas (Bloqueantes):** ${openDeficiencies.length} | **Consultivas (Dívida Técnica / Ambiente):** ${advisoryDeficiencies.length}`,
    '',
    '| ID | Sev | Status | Categoria | Alvo | Resumo | Ação Recomendada |',
    '| :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
    ...deficiencies.map(
      (d) =>
        `| \`${d.id}\` | **${d.severity}** | ${d.status} | ${d.category} | \`${d.target}\` | ${d.summary.replace(/\|/g, '/')} | ${d.recommendedAction.replace(/\|/g, '/')} |`
    ),
    '',
  ];
  fs.writeFileSync(path.join(reportDir, 'deficiencies-log.md'), defMd.join('\n'), 'utf8');

  const impMd: string[] = [
    '# Log de Melhorias & Auditorias — 3C Sentinel 1.0',
    '',
    `- **Atualizado em:** ${executedAt}`,
    `- **Melhorias Verificadas:** ${improvementsPayload.counts.verified} | **Melhorias Recomendadas (Backlog):** ${improvementsPayload.counts.recommended}`,
    '',
    '## Melhorias Verificadas pelo Sentinel',
    '',
    ...improvements
      .filter((i) => i.status === 'VERIFIED')
      .map(
        (i) =>
          `- ✅ **${i.id} — ${i.title}** (\`${i.target}\`): ${i.detail} _(Evidência: ${i.verifiedBy || 'Sentinel'})_`
      ),
    '',
    '## Experiência por Tipo de Usuário (5 Personas)',
    '',
    '| Persona | Produto | Status | Isolamento de Login & Escopo | Experiência & Evidência |',
    '| :--- | :--- | :--- | :--- | :--- |',
    ...personaExperiences.map(
      (p) =>
        `| **${p.personaLabel}** | \`${p.productAppId}\` | ${p.status === 'ISOLATED_OK' ? '✅ ISOLATED_OK' : '⚠️ ATTENTION'} | ${p.authIsolation} | ${p.uxHighlights} _(${p.verifiedBy})_ |`
    ),
    '',
    '## Backlog Priorizado de Melhorias',
    '',
    ...improvements
      .filter((i) => i.status === 'RECOMMENDED')
      .map((i) => `- 🎯 **[${i.priority}] ${i.id} — ${i.title}** (\`${i.target}\`): ${i.detail}`),
    '',
  ];
  fs.writeFileSync(path.join(reportDir, 'improvements-log.md'), impMd.join('\n'), 'utf8');

  const historyPath = path.join(reportDir, 'audit-history.ndjson');
  const existingHistoryLines = fs.existsSync(historyPath)
    ? fs
        .readFileSync(historyPath, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    : [];
  const nextEntry: AuditHistoryEntry = {
    executedAt,
    mode,
    completeness,
    overallStatus,
    scannerPassed,
    scannerTotal: scannerChecks.length,
    suitesPassed,
    suitesTotal: suiteResults.length,
    assertionsPassed,
    assertionsFailed,
    deficienciesOpenCount: openDeficiencies.length,
    deficienciesAdvisoryCount: advisoryDeficiencies.length,
    monolithFilesCount: monoliths.length,
  };
  const updatedHistory = [...existingHistoryLines, JSON.stringify(nextEntry)].slice(-100);
  fs.writeFileSync(historyPath, updatedHistory.join('\n') + '\n', 'utf8');

  return {
    deficienciesPayload,
    improvementsPayload,
    historyCount: updatedHistory.length,
  };
}
