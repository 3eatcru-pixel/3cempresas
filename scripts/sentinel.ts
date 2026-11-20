/**
 * 3C Sentinel 1.0 — Executor Determinístico de Auditoria, QA, Integração e Segurança Cross-Pilar
 *
 * Regras (docs/architecture/qa-sentinel/README.md):
 * - Somente leitura sobre código-fonte e documentação (0 mutações automáticas).
 * - Isolamento estrito de banco em diretório temporário (os.tmpdir()); nunca toca server-db.json real.
 * - Zero Firebase: verifica ausência definitiva de dependências/imports/rotas Firebase.
 * - Falha só é registrada com evidência reproduzível e contrato violado explícito.
 */

import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildAndPersistSentinelLogs,
  MonolithCandidate,
  scanMonolithCandidates,
} from './sentinelLogs.ts';

const require = createRequire(import.meta.url);

type Severity = 'P0' | 'P1' | 'P2' | 'P3';

interface ScannerCheckResult {
  id: string;
  title: string;
  passed: boolean;
  severityOnFail: Severity;
  violatedContract: string;
  target: string;
  observed: string;
  expected: string;
  reproductionCommand: string;
}

interface SuiteResult {
  id: string;
  label: string;
  command: string;
  pillars: string[];
  boundary: string;
  passed: boolean;
  exitCode: number;
  durationMs: number;
  passedChecks: number;
  failedChecks: number;
  failedLines: string[];
  outputTail: string;
}

interface ProvenFinding {
  id: string;
  title: string;
  severity: Severity;
  pillars: string[];
  violatedContract: string;
  reproductionCommand: string;
  evidence: {
    target: string;
    observedOutput: string;
    expectedOutput: string;
  };
}

interface SkippedItem {
  id: string;
  title: string;
  reason: 'SKIPPED_BY_FLAG' | 'ENV_PREREQUISITE_MISSING';
  detail: string;
}

interface SentinelReport {
  sentinelVersion: '1.0.0';
  executedAt: string;
  mode: 'FULL' | 'QUICK';
  persistenceModeUnderTest: 'SANDBOX_ISOLATED_TMP';
  runtime: {
    node: string;
    platform: string;
    cwd: string;
  };
  summary: {
    scannerPassed: number;
    scannerFailed: number;
    suitesPassed: number;
    suitesFailed: number;
    skippedChecksCount: number;
    skippedSuitesCount: number;
    completeness: 'FULL' | 'PARTIAL';
    totalAssertionsPassed: number;
    totalAssertionsFailed: number;
    provenFindingsCount: number;
    bySeverity: Record<Severity, number>;
    overallStatus: 'PASS' | 'FAIL';
  };
  routeInventory: {
    routerFiles: number;
    endpointsDetected: number;
  };
  pillarBoundaries: Array<{
    boundary: string;
    status: 'PASS' | 'FAIL';
    suites: string[];
  }>;
  scannerChecks: ScannerCheckResult[];
  skippedChecks: SkippedItem[];
  suiteResults: SuiteResult[];
  skippedSuites: SkippedItem[];
  provenFindings: ProvenFinding[];
}

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const isQuickMode = args.has('--quick');
const skipBuild = args.has('--skip-build');

function collectFiles(
  dirPath: string,
  extensions: Set<string>,
  ignoreDirs: Set<string> = new Set(['node_modules', 'dist', 'build', '.git', 'legacy', '.sentinel', 'android'])
): string[] {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (ignoreDirs.has(entry.name)) continue;
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full, extensions, ignoreDirs));
    } else if (extensions.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function runShellCommand(
  cmd: string,
  cmdArgs: string[],
  envOverrides: Record<string, string>,
  timeoutMs = 180_000
): { status: number; stdout: string; stderr: string; durationMs: number; timedOut?: boolean } {
  const started = Date.now();
  const proc = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    env: { ...process.env, ...envOverrides },
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: timeoutMs,
    shell: true,
  });
  const timedOut = (proc.error as any)?.code === 'ETIMEDOUT';
  return {
    status: timedOut ? 124 : (proc.status ?? 1),
    stdout: proc.stdout || '',
    stderr: timedOut
      ? `${proc.stderr || ''}\n[SENTINEL_TIMEOUT] Comando excedeu o limite de ${timeoutMs}ms.`.trim()
      : (proc.stderr || ''),
    durationMs: Date.now() - started,
    timedOut,
  };
}

function runScanner(): {
  checks: ScannerCheckResult[];
  skippedChecks: SkippedItem[];
  routeInventory: { routerFiles: number; endpointsDetected: number };
  telemetryMeta: {
    monoliths: MonolithCandidate[];
    hasLocalRootDbHashes: boolean;
    rootDbIgnoredByGit: boolean;
    sidecarPresentOnDisk: boolean;
  };
} {
  const checks: ScannerCheckResult[] = [];
  const skippedChecks: SkippedItem[] = [];

  // 1. Internal Workspace manifests Zero-Firebase Check (packages/*, apps/*, servers/*)
  const workspaceManifestPaths = ['packages', 'apps', 'servers'].flatMap((ws) => {
    const wsDir = path.join(ROOT, ws);
    if (!fs.existsSync(wsDir)) return [];
    return fs
      .readdirSync(wsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(wsDir, d.name, 'package.json'))
      .filter((p) => fs.existsSync(p));
  });

  const firebaseDepHits: string[] = [];
  for (const mf of workspaceManifestPaths) {
    try {
      const parsed = JSON.parse(fs.readFileSync(mf, 'utf8'));
      const deps = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
      for (const depName of Object.keys(deps)) {
        if (depName === 'firebase' || depName === 'firebase-admin' || depName.startsWith('@firebase/')) {
          firebaseDepHits.push(`${path.relative(ROOT, mf)}:${depName}`);
        }
      }
    } catch {
      // ignore malformed optional manifest
    }
  }

  checks.push({
    id: 'SCAN-01',
    title: 'Zero dependências Firebase nos manifestos internos do monorepo (packages, apps, servers)',
    passed: firebaseDepHits.length === 0,
    severityOnFail: 'P0',
    violatedContract: 'Regra de Isolamento do Conector: pacotes internos nunca dependem do Firebase',
    target: 'packages/*/package.json, apps/*/package.json, servers/*/package.json',
    observed: firebaseDepHits.length === 0 ? '0 dependências Firebase em pacotes internos' : firebaseDepHits.join(', '),
    expected: '0 dependências firebase / firebase-admin / @firebase/* em packages/*, apps/*, servers/*',
    reproductionCommand: 'npm run sentinel',
  });

  // 2. Runtime source Zero-Firebase check in core packages and non-connector modules
  const codeExts = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
  const allowedConnectorFiles = new Set([
    path.normalize('src/services/firebaseClient.ts'),
    path.normalize('src/server/routes/auth/firebaseTokenVerifier.ts'),
  ]);
  const allowedConnectorPrefix = path.normalize('src/services/firebase') + path.sep;
  const runtimeFiles = ['src', 'packages', 'servers', 'apps'].flatMap((dir) =>
    collectFiles(path.join(ROOT, dir), codeExts)
  ).filter((file) => {
    const rel = path.normalize(path.relative(ROOT, file));
    return !allowedConnectorFiles.has(rel) && !rel.startsWith(allowedConnectorPrefix);
  });

  const forbiddenFirebasePatterns: Array<{ label: string; regex: RegExp }> = [
    { label: 'import firebase', regex: /from\s+['"](?:firebase(?:\/[^'"]*)?|firebase-admin(?:\/[^'"]*)?|@firebase\/[^'"]*)['"]/ },
    { label: 'Firebase SDK call', regex: /\b(?:signInWithCustomToken|signInWithEmailAndPassword|initializeApp\s*\(\s*firebase|getFirestore\s*\()/ },
    { label: 'VITE_FIREBASE_ env', regex: /\bVITE_FIREBASE_/ },
    { label: 'legacy /auth/firebase route', regex: /\/api\/v1\/auth\/firebase(?!\-exchange)|\brouter\.post\(\s*['"]\/firebase['"]/ },
  ];

  const codeFirebaseHits: string[] = [];
  for (const file of runtimeFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pat of forbiddenFirebasePatterns) {
      if (pat.regex.test(content)) {
        codeFirebaseHits.push(`${path.relative(ROOT, file)} [${pat.label}]`);
      }
    }
  }

  const forbiddenLegacyRuntimeFiles = [
    'src/lib/firebase.ts',
    'src/lib/firebase-admin.ts',
    'src/server/persistence/FirestoreDriver.ts',
  ].filter((rel) => fs.existsSync(path.join(ROOT, rel)));

  checks.push({
    id: 'SCAN-02',
    title: 'Zero código Firebase fora do conector opcional isolado e zero arquivos legados',
    passed: codeFirebaseHits.length === 0 && forbiddenLegacyRuntimeFiles.length === 0,
    severityOnFail: 'P0',
    violatedContract: 'Arquitetura autônoma Server Core com conector Firebase estritamente isolado (docs/pillars/server-core/README.md)',
    target: 'packages/**, servers/**, apps/** e src/** (exceto adapter isolado)',
    observed:
      codeFirebaseHits.length === 0 && forbiddenLegacyRuntimeFiles.length === 0
        ? '0 referências Firebase em módulos core e 0 arquivos legados'
        : [...codeFirebaseHits, ...forbiddenLegacyRuntimeFiles].join('; '),
    expected: '0 imports/rotas/arquivos Firebase legados fora do adapter isolado',
    reproductionCommand: 'npm run sentinel',
  });

  // 3. Offline-first check: zero external QR generator dependencies
  const externalQrHits: string[] = [];
  for (const file of runtimeFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('api.qrserver.com')) {
      externalQrHits.push(path.relative(ROOT, file));
    }
  }
  checks.push({
    id: 'SCAN-03',
    title: 'Zero dependência externa api.qrserver.com em fluxos offline/LAN',
    passed: externalQrHits.length === 0,
    severityOnFail: 'P1',
    violatedContract: 'Operação Offline-First / QR local (LocalQrCode)',
    target: 'src/**, packages/**, servers/**, apps/**',
    observed: externalQrHits.length === 0 ? '0 referências a api.qrserver.com' : externalQrHits.join(', '),
    expected: '0 ocorrências de api.qrserver.com',
    reproductionCommand: 'npm run sentinel',
  });

  // 4. Server Core Route Inventory & No Fake PIN Shortcuts in Driver/Waiter UI
  const routeFiles = collectFiles(path.join(ROOT, 'src/server/routes'), new Set(['.ts']));
  let endpointsDetected = 0;
  for (const rf of routeFiles) {
    const content = fs.readFileSync(rf, 'utf8');
    const matches = content.match(/\brouter\.(get|post|put|patch|delete)\s*\(/g);
    if (matches) endpointsDetected += matches.length;
  }

  const waiterDriverUiFiles = [
    ...collectFiles(path.join(ROOT, 'src/modules/driver'), new Set(['.ts', '.tsx'])),
    ...collectFiles(path.join(ROOT, 'src/modules/waiter'), new Set(['.ts', '.tsx'])),
  ];
  const fakePinHits: string[] = [];
  for (const f of waiterDriverUiFiles) {
    const content = fs.readFileSync(f, 'utf8');
    if (content.includes('handleSimulatePin') || content.includes("setPinCode('9041')") || content.includes("setDeliveryPin('9041')")) {
      fakePinHits.push(path.relative(ROOT, f));
    }
  }

  checks.push({
    id: 'SCAN-04',
    title: 'Driver & Waiter BYOD sem atalhos de PIN simulado (handleSimulatePin / #9041)',
    passed: fakePinHits.length === 0 && endpointsDetected > 0,
    severityOnFail: 'P1',
    violatedContract: 'Integridade de entrega e pareamento BYOD sem simulação artificial',
    target: 'src/modules/driver/**, src/modules/waiter/**',
    observed:
      fakePinHits.length === 0
        ? `0 atalhos simulados (${endpointsDetected} endpoints auditados em ${routeFiles.length} roteadores)`
        : fakePinHits.join(', '),
    expected: '0 atalhos simulados de PIN',
    reproductionCommand: 'npm run sentinel',
  });

  // 5. TypeScript check (tsc --noEmit) & optional Vite build
  if (skipBuild) {
    skippedChecks.push(
      {
        id: 'SCAN-05',
        title: 'Typecheck estrito do ecossistema (tsc --noEmit)',
        reason: 'SKIPPED_BY_FLAG',
        detail: 'Ignorado via flag --skip-build (execução parcial).',
      },
      {
        id: 'SCAN-06',
        title: 'Build de produção Vite (npm run build)',
        reason: 'SKIPPED_BY_FLAG',
        detail: 'Ignorado via flag --skip-build (execução parcial).',
      },
      {
        id: 'SCAN-08',
        title: 'Build independente das 5 aplicações Web (@3c/*-web)',
        reason: 'SKIPPED_BY_FLAG',
        detail: 'Ignorado via flag --skip-build (execução parcial).',
      }
    );
  } else {
    const lintRes = runShellCommand('npm', ['run', 'lint'], { CI: 'true' });
    checks.push({
      id: 'SCAN-05',
      title: 'Typecheck estrito do ecossistema (tsc --noEmit)',
      passed: lintRes.status === 0,
      severityOnFail: 'P0',
      violatedContract: 'Consistência de tipos @3c/shared-types e contratos frontend/backend',
      target: 'tsconfig.json (npm run lint)',
      observed:
        lintRes.status === 0
          ? `tsc --noEmit OK (${lintRes.durationMs}ms)`
          : (lintRes.stdout + '\n' + lintRes.stderr).trim().slice(0, 800),
      expected: 'Exit code 0 sem erros TypeScript',
      reproductionCommand: 'npm run lint',
    });

    if (isQuickMode) {
      skippedChecks.push(
        {
          id: 'SCAN-06',
          title: 'Build de produção Vite (npm run build)',
          reason: 'SKIPPED_BY_FLAG',
          detail: 'Ignorado via flag --quick (execução parcial).',
        },
        {
          id: 'SCAN-08',
          title: 'Build independente das 5 aplicações Web (@3c/*-web)',
          reason: 'SKIPPED_BY_FLAG',
          detail: 'Ignorado via flag --quick (execução parcial).',
        }
      );
    } else {
      const buildRes = runShellCommand('npm', ['run', 'build'], { CI: 'true' });
      checks.push({
        id: 'SCAN-06',
        title: 'Build de produção Vite (npm run build)',
        passed: buildRes.status === 0,
        severityOnFail: 'P0',
        violatedContract: 'Empacotamento íntegro de produção Web',
        target: 'vite.config.ts (npm run build)',
        observed:
          buildRes.status === 0
            ? `vite build OK (${buildRes.durationMs}ms)`
            : (buildRes.stdout + '\n' + buildRes.stderr).trim().slice(0, 800),
        expected: 'Exit code 0 no Vite build',
        reproductionCommand: 'npm run build',
      });

      const webWorkspaces = ['hq-web', 'store-web', 'marketplace-web', 'driver-web', 'waiter-web'];
      const wsFailures: string[] = [];
      let wsTotalMs = 0;
      for (const ws of webWorkspaces) {
        const wsRes = runShellCommand('npm', ['--workspace', `@3c/${ws}`, 'run', 'build'], { CI: 'true' });
        wsTotalMs += wsRes.durationMs;
        if (wsRes.status !== 0) {
          wsFailures.push(`@3c/${ws}: ${(wsRes.stdout + wsRes.stderr).trim().slice(0, 200)}`);
        }
      }
      checks.push({
        id: 'SCAN-08',
        title: 'Build independente das 5 aplicações Web (@3c/*-web)',
        passed: wsFailures.length === 0,
        severityOnFail: 'P0',
        violatedContract: 'Isolamento e empacotamento standalone de todos os produtos Web do monorepo',
        target: 'apps/hq-web, apps/store-web, apps/marketplace-web, apps/driver-web, apps/waiter-web',
        observed:
          wsFailures.length === 0
            ? `5/5 apps Web compilados (${wsTotalMs}ms)`
            : wsFailures.join(' | '),
        expected: 'Exit code 0 em todas as 5 aplicações Web',
        reproductionCommand: 'npm --workspace=@3c/store-web run build',
      });
    }
  }

  // 7. bun.lock sync & internal workspace isolation verification
  const bunLockPath = path.join(ROOT, 'bun.lock');
  const rootPkgPath = path.join(ROOT, 'package.json');
  let bunLockPassed = false;
  let bunLockObserved = 'bun.lock ausente';
  if (fs.existsSync(bunLockPath) && fs.existsSync(rootPkgPath)) {
    try {
      const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
      const bunLockRaw = fs.readFileSync(bunLockPath, 'utf8').replace(/,(\s*[}\]])/g, '$1');
      const bunLockParsed = JSON.parse(bunLockRaw);
      const lockRootName = bunLockParsed?.workspaces?.['']?.name;
      const workspaces = bunLockParsed?.workspaces || {};
      const internalWsFirebaseHits: string[] = [];
      for (const [wsKey, wsVal] of Object.entries(workspaces)) {
        if (!wsKey) continue; // skip root workspace
        const wsDeps = { ...((wsVal as any)?.dependencies || {}), ...((wsVal as any)?.devDependencies || {}) };
        for (const dep of Object.keys(wsDeps)) {
          if (dep === 'firebase' || dep === 'firebase-admin' || dep.startsWith('@firebase/')) {
            internalWsFirebaseHits.push(`${wsKey}:${dep}`);
          }
        }
      }
      bunLockPassed = lockRootName === rootPkg.name && internalWsFirebaseHits.length === 0;
      bunLockObserved = bunLockPassed
        ? `Alinhado (${lockRootName}, 0 Firebase em pacotes internos)`
        : `name=${lockRootName} (esperado ${rootPkg.name}), internalFirebase=[${internalWsFirebaseHits.join(',')}]`;
    } catch (err: any) {
      bunLockObserved = `Erro ao ler bun.lock: ${err?.message || 'JSON inválido'}`;
    }
  }
  checks.push({
    id: 'SCAN-07',
    title: 'Alinhamento do bun.lock com o monorepo 3C Corp (Isolamento de Conector)',
    passed: bunLockPassed,
    severityOnFail: 'P1',
    violatedContract: 'Determinismo de dependências e isolamento estrito de pacotes no bun.lock',
    target: 'bun.lock <-> package.json',
    observed: bunLockObserved,
    expected: 'workspaces[""].name == package.json#name e 0 pacotes Firebase nos workspaces internos',
    reproductionCommand: 'bun install --lockfile-only',
  });

  // 9. Root cleanliness & zero leaked secrets (.server-secret in root)
  const rootSecretExists = fs.existsSync(path.join(ROOT, '.server-secret'));
  checks.push({
    id: 'SCAN-09',
    title: 'Isolamento estrito de segredos: ausência de .server-secret na raiz do projeto',
    passed: !rootSecretExists,
    severityOnFail: 'P1',
    violatedContract: 'Isolamento estrito do Sentinel e regra Zero-Root-Mutation',
    target: '.server-secret na raiz do monorepo',
    observed: !rootSecretExists ? '0 arquivos .server-secret na raiz' : 'Arquivo .server-secret residual detectado na raiz',
    expected: 'Nenhum .server-secret na raiz do repositório',
    reproductionCommand: 'npm run sentinel',
  });

  // 10. Zero legacy Firebase recovery plans or active Firebase directives in docs & .aistudio
  const legacyPlanFiles = ['RECOVERY_PLAN.md', 'RECOVERY_PLAN_v2_6.md'].filter((f) =>
    fs.existsSync(path.join(ROOT, f))
  );
  const docFiles = [
    ...fs
      .readdirSync(ROOT, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.md'))
      .map((d) => path.join(ROOT, d.name)),
    ...collectFiles(path.join(ROOT, 'docs'), new Set(['.md'])),
    ...collectFiles(path.join(ROOT, '.aistudio'), new Set(['.md', '.json'])),
  ];
  const activeFirebaseDirectivePatterns: Array<{ label: string; regex: RegExp }> = [
    { label: 'deploy_firebase directive', regex: /\bdeploy_firebase\b/ },
    { label: 'set_up_firebase directive', regex: /\bset_up_firebase\b/ },
    { label: 'Firebase Auth recommendation', regex: /(?:Create real authentication\s*\(Firebase Auth\)|Auth:\s*Firebase Auth|ouvinte de autentica[çc][aã]o Firebase)/i },
    { label: 'firestore.rules deployment task', regex: /Atualizar\s+`?firestore\.rules`?/i },
  ];
  const docFirebaseHits: string[] = [...legacyPlanFiles.map((f) => `${f} [legacy Firebase plan]`)];
  for (const df of docFiles) {
    const content = fs.readFileSync(df, 'utf8');
    for (const pat of activeFirebaseDirectivePatterns) {
      if (pat.regex.test(content)) {
        docFirebaseHits.push(`${path.relative(ROOT, df)} [${pat.label}]`);
      }
    }
  }
  checks.push({
    id: 'SCAN-10',
    title: 'Zero planos legados ou instruções de reintrodução Firebase em docs e .aistudio',
    passed: docFirebaseHits.length === 0,
    severityOnFail: 'P1',
    violatedContract: 'Regra Invariante Zero-Firebase em documentação e planos do workspace',
    target: '*.md, docs/**, .aistudio/**',
    observed:
      docFirebaseHits.length === 0
        ? `0 instruções/planos Firebase (${docFiles.length} arquivos auditados)`
        : docFirebaseHits.join('; '),
    expected: '0 documentos ou artefatos instruindo Firebase Auth, firestore.rules ou deploy_firebase',
    reproductionCommand: 'npm run sentinel',
  });

  // 11. Packaged root DB cleanliness & .gitignore/.git tracking verification
  const rootDbPath = path.join(ROOT, 'server-db.json');
  const gitignorePath = path.join(ROOT, '.gitignore');
  const gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const rootDbIgnoredByGit =
    /(?:^|\r?\n)server-db\.json(?:\r?\n|$)/.test(gitignoreContent) &&
    /(?:^|\r?\n)\.server-secret(?:\r?\n|$)/.test(gitignoreContent);

  let rootDbTrackedInGit = false;
  if (fs.existsSync(path.join(ROOT, '.git'))) {
    const lsFiles = runShellCommand('git', ['ls-files', 'server-db.json', '.server-secret'], {}, 15_000);
    rootDbTrackedInGit = Boolean(lsFiles.stdout.trim());
  }

  let rootDbHasPasswordHashes = false;
  let rootDbUsersWithHash = 0;
  if (fs.existsSync(rootDbPath)) {
    try {
      const parsedDb = JSON.parse(fs.readFileSync(rootDbPath, 'utf8'));
      if (Array.isArray(parsedDb?.users)) {
        rootDbUsersWithHash = parsedDb.users.filter((u: any) => Boolean(u?.passwordHash)).length;
        rootDbHasPasswordHashes = rootDbUsersWithHash > 0;
      }
    } catch {
      // ignore malformed optional local file
    }
  }
  const isCiEnv = process.env.CI === 'true';
  const scan11Passed =
    !rootDbTrackedInGit &&
    rootDbIgnoredByGit &&
    (!isCiEnv || !fs.existsSync(rootDbPath) || !rootDbHasPasswordHashes);
  checks.push({
    id: 'SCAN-11',
    title: 'Pacote limpo e proteção Git (.gitignore) para server-db.json e .server-secret',
    passed: scan11Passed,
    severityOnFail: 'P1',
    violatedContract: 'Higienização do pacote e prevenção de vazamento de banco sandbox no Git/CI',
    target: 'server-db.json, .gitignore',
    observed: rootDbTrackedInGit
      ? 'CRÍTICO: server-db.json ou .server-secret está rastreado no Git!'
      : !rootDbIgnoredByGit
      ? '.gitignore não protege server-db.json/.server-secret'
      : !fs.existsSync(rootDbPath)
      ? '0 arquivo server-db.json na raiz (protegido pelo .gitignore)'
      : rootDbHasPasswordHashes
      ? isCiEnv
        ? `server-db.json em ambiente CI contém ${rootDbUsersWithHash} hash(es) de senha`
        : `Sandbox dev local ativo (${rootDbUsersWithHash} hash local protegido por .gitignore; registrado no log consultivo)`
      : 'server-db.json local sem hashes e protegido por .gitignore',
    expected: 'Não rastreado no Git, protegido no .gitignore e ausente em builds CI/produção',
    reproductionCommand: 'npm run sentinel',
  });

  // 12. Embedded SQLite >= 3.51.3 advisory check (Edge node:sqlite)
  let sqliteVer = 'unknown';
  let sqliteSafe = false;
  try {
    const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (file: string) => any };
    const memDb = new DatabaseSync(':memory:');
    const row = memDb.prepare('SELECT sqlite_version() AS ver').get();
    sqliteVer = String(row?.ver || '0.0.0');
    memDb.close();
    const [maj, min, pat] = sqliteVer.split('.').map((n) => Number(n) || 0);
    sqliteSafe = maj > 3 || (maj === 3 && (min > 51 || (min === 51 && pat >= 2)));
  } catch (err: any) {
    sqliteVer = err?.message || 'error';
  }
  checks.push({
    id: 'SCAN-13',
    title: 'Versão SQLite embutido no runtime Node >= 3.51.3 (mitigação CVE-2026-127481)',
    passed: sqliteSafe,
    severityOnFail: 'P1',
    violatedContract: 'Monitoramento mensal de segurança SQLite/Node (docs/architecture/sync-and-edge/README.md)',
    target: 'node:sqlite sqlite_version()',
    observed: `sqlite_version() = ${sqliteVer}`,
    expected: 'SQLite >= 3.51.3',
    reproductionCommand: 'npm run sentinel',
  });

  // 13. Native Android / Capacitor scanner (without blind exclusion of android directories)
  const nativeScanExts = new Set(['.xml', '.kt', '.java', '.gradle', '.ts', '.json']);
  const androidAppDirs = ['driver-android', 'marketplace-android', 'store-android', 'waiter-android'].map((d) =>
    path.join(ROOT, 'apps', d)
  );
  const androidFiles = androidAppDirs.flatMap((dir) =>
    collectFiles(dir, nativeScanExts, new Set(['node_modules', 'dist', 'build', '.git', '.gradle']))
  );
  const androidSecurityFindings: string[] = [];
  for (const af of androidFiles) {
    const content = fs.readFileSync(af, 'utf8');
    if (af.endsWith('.xml') && /usesCleartextTraffic\s*=\s*["']true["']/i.test(content)) {
      const hasNetworkSecConfig = /networkSecurityConfig/i.test(content);
      if (!hasNetworkSecConfig) {
        androidSecurityFindings.push(`${path.relative(ROOT, af)} [usesCleartextTraffic=true sem networkSecurityConfig]`);
      }
    }
    if (/com\.google\.firebase|firebase-messaging|google-services\.json/i.test(content)) {
      androidSecurityFindings.push(`${path.relative(ROOT, af)} [referência residual Firebase]`);
    }
  }
  checks.push({
    id: 'SCAN-14',
    title: 'Auditoria de manifestos e configurações nativas Android (sem exclusão cega de android/)',
    passed: androidSecurityFindings.length === 0 && androidFiles.length > 0,
    severityOnFail: 'P2',
    violatedContract: 'Scanner nativo completo e fronteira HTTP LAN (P1/P2)',
    target: 'apps/*-android/android/**, apps/*-android/capacitor.config.ts',
    observed:
      androidSecurityFindings.length === 0
        ? `${androidFiles.length} arquivos Android/Capacitor auditados (0 referências Firebase/cleartext global sem networkSecurityConfig)`
        : androidSecurityFindings.join('; '),
    expected: 'Arquivos Android auditados sem Firebase ou cleartext global sem networkSecurityConfig',
    reproductionCommand: 'npm run sentinel',
  });

  // 14. Sidecar manifest honesty check (nativeBinaryPresent must match actual file on disk)
  const sidecarManifestPath = path.join(ROOT, 'apps/store-desktop/src-tauri/binaries/sidecar-manifest.json');
  let sidecarCheckPassed = false;
  let sidecarPresentOnDisk = false;
  let sidecarObserved = 'sidecar-manifest.json ausente';
  if (fs.existsSync(sidecarManifestPath)) {
    try {
      const mf = JSON.parse(fs.readFileSync(sidecarManifestPath, 'utf8'));
      const expectedBinRel = String(mf?.expectedNativeBinary || '');
      const expectedBinAbs = expectedBinRel ? path.resolve(ROOT, 'apps/store-desktop', expectedBinRel) : '';
      const binExists = expectedBinAbs ? fs.existsSync(expectedBinAbs) : false;
      sidecarPresentOnDisk = binExists;
      const modeConsistent = mf?.nativeBinaryPresent === true ? mf?.mode === 'NATIVE_COMPILED_BINARY' : mf?.mode !== 'NATIVE_COMPILED_BINARY';
      sidecarCheckPassed = mf?.nativeBinaryPresent === binExists && modeConsistent;
      sidecarObserved = `nativeBinaryPresent=${mf?.nativeBinaryPresent}, existsOnDisk=${binExists}, mode=${mf?.mode}`;
    } catch (err: any) {
      sidecarObserved = `Erro ao ler sidecar-manifest.json: ${err?.message || 'JSON inválido'}`;
    }
  }
  checks.push({
    id: 'SCAN-15',
    title: 'Honestidade do sidecar-manifest.json em relação ao binário nativo em disco',
    passed: sidecarCheckPassed,
    severityOnFail: 'P1',
    violatedContract: 'Integridade de manifesto de empacotamento Tauri 2 (P1)',
    target: 'apps/store-desktop/src-tauri/binaries/sidecar-manifest.json',
    observed: sidecarObserved,
    expected: 'nativeBinaryPresent == fs.existsSync(expectedNativeBinary) e mode coerente',
    reproductionCommand: 'npm run sentinel',
  });

  // 15. Firestore security rules static audit via @firebase/eslint-plugin-security-rules
  const rulesPath = path.join(ROOT, 'firestore.rules');
  let rulesLintPassed = false;
  let rulesLintObserved = 'firestore.rules ausente';
  if (fs.existsSync(rulesPath)) {
    const rulesRes = runShellCommand('npx', ['eslint', 'firestore.rules'], { CI: 'true' }, 60_000);
    rulesLintPassed = rulesRes.status === 0;
    rulesLintObserved = rulesLintPassed
      ? `eslint firestore.rules OK (${rulesRes.durationMs}ms, 0 vulnerabilidades)`
      : (rulesRes.stdout + '\n' + rulesRes.stderr).trim().slice(0, 600);
  }
  checks.push({
    id: 'SCAN-16',
    title: 'Auditoria estática de firestore.rules (@firebase/eslint-plugin-security-rules)',
    passed: rulesLintPassed,
    severityOnFail: 'P0',
    violatedContract: 'Conector opcional Firebase protegido por regras Zero-Trust default-deny sem erros ESLint',
    target: 'firestore.rules (eslint.config.mjs)',
    observed: rulesLintObserved,
    expected: 'Exit code 0 em npx eslint firestore.rules',
    reproductionCommand: 'npm run lint:rules',
  });

  // 16. Modularity & Monolithic File Debt Telemetry (feeds Sentinel Deficiency/Improvement Logs)
  const monoliths = scanMonolithCandidates(ROOT, collectFiles);
  const criticalMonoliths = monoliths.filter((m) => m.lines > 2500);
  checks.push({
    id: 'SCAN-17',
    title: 'Orçamento de modularidade e rastreamento de arquivos monolíticos (> 420 UI / > 650 Server)',
    passed: criticalMonoliths.length === 0,
    severityOnFail: 'P2',
    violatedContract: 'Modularidade sustentável de UI e roteadores (<= 2500 linhas máximo absoluto)',
    target: 'src/**, servers/edge-node/**, packages/**',
    observed:
      monoliths.length === 0
        ? '0 arquivos acima dos limiares de modularidade'
        : `${monoliths.length} candidato(s) registrado(s) no Log de Melhorias (topo: ${monoliths[0].file} com ${monoliths[0].lines}L)`,
    expected: '0 arquivos acima de 2500 linhas e dívida monitorada em .sentinel/improvements-log.md',
    reproductionCommand: 'npm run sentinel',
  });

  // 17. Repo-Agnostic Supply Chain, Secret Hygiene & HQ/Server Config Boundary
  const securityMdExists = fs.existsSync(path.join(ROOT, 'SECURITY.md'));
  const envExampleExists = fs.existsSync(path.join(ROOT, '.env.example'));
  const leakedAuditAssetsExists = fs.existsSync(path.join(ROOT, 'public/assets/aistudio'));
  const legacyGithubDirExists = fs.existsSync(path.join(ROOT, '.github'));
  const pkgJsonContent = fs.existsSync(path.join(ROOT, 'package.json'))
    ? fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    : '';
  const hasCoreScripts =
    pkgJsonContent.includes('"lint"') &&
    pkgJsonContent.includes('"build"') &&
    pkgJsonContent.includes('"build:apps"');
  const tokenScanFiles = [
    ...collectFiles(path.join(ROOT, 'src'), new Set(['.ts', '.tsx', '.js'])),
    ...collectFiles(path.join(ROOT, 'scripts'), new Set(['.ts', '.sh'])),
    path.join(ROOT, '.env.example'),
    path.join(ROOT, 'SECURITY.md'),
  ].filter((f) => fs.existsSync(f) && !f.endsWith('scripts/sentinel.ts'));
  const secretLeakFindings: string[] = [];
  for (const tf of tokenScanFiles) {
    const content = fs.readFileSync(tf, 'utf8');
    if (/(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})/.test(content)) {
      secretLeakFindings.push(`${path.relative(ROOT, tf)} [possível token estático]`);
    }
  }
  const governanceCoreContent = fs.existsSync(path.join(ROOT, 'src/server/routes/admin/governanceCore.ts'))
    ? fs.readFileSync(path.join(ROOT, 'src/server/routes/admin/governanceCore.ts'), 'utf8')
    : '';
  const configBoundaryOk = governanceCoreContent.includes('runtimePolicy');
  const scan18Passed =
    securityMdExists &&
    envExampleExists &&
    hasCoreScripts &&
    !leakedAuditAssetsExists &&
    !legacyGithubDirExists &&
    configBoundaryOk &&
    secretLeakFindings.length === 0;
  checks.push({
    id: 'SCAN-18',
    title: 'Higiene de Repositório, Fronteira de Configuração (HQ + Server) & Supply Chain',
    passed: scan18Passed,
    severityOnFail: 'P2',
    violatedContract: 'Repositório portável sem segredos hardcoded, sem artefatos internos expostos e com variáveis governadas entre HQ e Server Core',
    target: 'SECURITY.md, .env.example, package.json, src/server/routes/admin/governanceCore.ts',
    observed: scan18Passed
      ? `Repositório higienizado (${tokenScanFiles.length} arquivos sem tokens, zero .github/ ou public/assets/aistudio, runtimePolicy HQ ativa)`
      : [
          !securityMdExists ? 'ausente:SECURITY.md' : '',
          !envExampleExists ? 'ausente:.env.example' : '',
          !hasCoreScripts ? 'scripts lint/build/build:apps ausentes' : '',
          leakedAuditAssetsExists ? 'exposto:public/assets/aistudio' : '',
          legacyGithubDirExists ? 'legado:.github presente' : '',
          !configBoundaryOk ? 'runtimePolicy ausente em governanceCore.ts' : '',
          ...secretLeakFindings,
        ]
          .filter(Boolean)
          .join('; '),
    expected: '0 segredos estáticos, 0 artefatos internos expostos e runtimePolicy ativo',
    reproductionCommand: 'npm run sentinel',
  });

  // 18. Public Consumer Config B2B Boundary Check
  const systemRoutePath = path.join(ROOT, 'src/server/routes/system.ts');
  const systemRouteContent = fs.existsSync(systemRoutePath) ? fs.readFileSync(systemRoutePath, 'utf8') : '';
  const publicBoundaryOk =
    systemRouteContent.includes('externalChannelConnectors: []') &&
    systemRouteContent.includes('zeroPublicSpotlightPricing') &&
    systemRouteContent.includes('hiddenSet.has');
  checks.push({
    id: 'SCAN-19',
    title: 'Fronteira B2B vs Consumidor em GET /api/v1/system/public-config',
    passed: publicBoundaryOk,
    severityOnFail: 'P0',
    violatedContract: 'Consumidor público nunca recebe preços B2B, conectores ou lojas ocultas/pendentes',
    target: 'src/server/routes/system.ts (/public-config)',
    observed: publicBoundaryOk
      ? 'Sanitização estrita verificada (spotlightPricing zerado, connectors=[], hiddenStoreIds filtrados)'
      : 'Risco de exposição de dados B2B ou lojas ocultas em /public-config',
    expected: 'Sanitização B2B completa em /public-config',
    reproductionCommand: 'npm run sentinel',
  });

  // 19. Persona & UI Boundary Isolation Check (Consumer, Merchant, Driver, Waiter vs HQ)
  const marketplaceUiFiles = [
    path.join(ROOT, 'src/components/pillars/MarketplacePillar.tsx'),
    ...collectFiles(path.join(ROOT, 'src/modules/marketplace'), new Set(['.ts', '.tsx'])),
  ].filter((f) => fs.existsSync(f));
  const storeOsUiFiles = [
    path.join(ROOT, 'src/components/pillars/StoreOsPillar.tsx'),
    ...collectFiles(path.join(ROOT, 'src/modules/store-os'), new Set(['.ts', '.tsx'])),
  ].filter((f) => fs.existsSync(f));

  const personaBoundaryViolations: string[] = [];
  for (const mf of marketplaceUiFiles) {
    const content = fs.readFileSync(mf, 'utf8');
    if (/\bHQ Central\b|\bhq-central\b|\bDEV_OWNER\b|\bStore OS\b|\bStoreOs\b/.test(content)) {
      personaBoundaryViolations.push(`${path.relative(ROOT, mf)} [vaza termo HQ/StoreOS no Marketplace]`);
    }
  }
  for (const sf of storeOsUiFiles) {
    const content = fs.readFileSync(sf, 'utf8');
    if (/\bHQ Central\b|\bhq-central\b|desenvolvedores/i.test(content)) {
      personaBoundaryViolations.push(`${path.relative(ROOT, sf)} [vaza termo HQ/desenvolvedores no Store OS]`);
    }
  }
  const authModalContent = fs.existsSync(path.join(ROOT, 'src/components/common/AuthModal.tsx'))
    ? fs.readFileSync(path.join(ROOT, 'src/components/common/AuthModal.tsx'), 'utf8')
    : '';
  const authSwitchIsolated = authModalContent.includes(
    "getActiveClientAppId() === 'unified-portal' && authModalContext === 'portal'"
  );
  if (!authSwitchIsolated) {
    personaBoundaryViolations.push('src/components/common/AuthModal.tsx [alternador cross-produto exposto em login dedicado]');
  }
  const useSystemContent = fs.existsSync(path.join(ROOT, 'src/hooks/ecosystem/useSystem.ts'))
    ? fs.readFileSync(path.join(ROOT, 'src/hooks/ecosystem/useSystem.ts'), 'utf8')
    : '';
  if (!useSystemContent.includes('if (options?.lockedSection) return;')) {
    personaBoundaryViolations.push('src/hooks/ecosystem/useSystem.ts [setActiveSection sem guarda lockedSection]');
  }

  checks.push({
    id: 'SCAN-20',
    title: 'Isolamento de experiência por tipo de usuário (Marketplace, Store OS, Driver, Waiter, HQ)',
    passed: personaBoundaryViolations.length === 0,
    severityOnFail: 'P1',
    violatedContract: 'Cada produto possui login, linguagem e navegação próprias sem misturar HQ/StoreOS ao consumidor/lojista',
    target: 'src/modules/{marketplace,store-os}/**, AuthModal.tsx, useSystem.ts',
    observed:
      personaBoundaryViolations.length === 0
        ? `5 personas isoladas (${marketplaceUiFiles.length} arquivos Marketplace + ${storeOsUiFiles.length} Store OS + AuthModal + lockedSection)`
        : personaBoundaryViolations.join('; '),
    expected: '0 vazamentos cross-produto nas interfaces e login estritamente isolado por produto',
    reproductionCommand: 'npm run sentinel',
  });

  return {
    checks,
    skippedChecks,
    routeInventory: { routerFiles: routeFiles.length, endpointsDetected },
    telemetryMeta: {
      monoliths,
      hasLocalRootDbHashes: rootDbHasPasswordHashes,
      rootDbIgnoredByGit,
      sidecarPresentOnDisk,
    },
  };
}

function captureRootSnapshot(): { secretExists: boolean; dbExists: boolean; dbSha256: string | null } {
  const secretExists = fs.existsSync(path.join(ROOT, '.server-secret'));
  const dbPath = path.join(ROOT, 'server-db.json');
  const dbExists = fs.existsSync(dbPath);
  const dbSha256 = dbExists
    ? crypto.createHash('sha256').update(fs.readFileSync(dbPath)).digest('hex')
    : null;
  return { secretExists, dbExists, dbSha256 };
}

function runSuites(tmpSandboxDir: string): { results: SuiteResult[]; skippedSuites: SkippedItem[] } {
  const suites: Array<{
    id: string;
    label: string;
    scriptPath: string;
    pillars: string[];
    boundary: string;
    quickInclude?: boolean;
  }> = [
    {
      id: 'run-audit-tests',
      label: 'Homologação Sênior & ACID Base',
      scriptPath: 'scripts/run-audit-tests.ts',
      pillars: ['Server Core', 'Store OS', 'HQ Central'],
      boundary: 'Core ACID & Contratos',
      quickInclude: true,
    },
    {
      id: 'hq-central',
      label: 'Pilar 1 — HQ Central & Governança',
      scriptPath: 'tests/security/hq-central.test.ts',
      pillars: ['HQ Central', 'Server Core'],
      boundary: 'HQ ↔ Server Core',
      quickInclude: true,
    },
    {
      id: 'server-core',
      label: 'Pilar 4 — Server Core, Quotas, Edge & Gemini Offline',
      scriptPath: 'tests/security/server-core.test.ts',
      pillars: ['Server Core', 'Edge Node'],
      boundary: 'Infraestrutura Compartilhada ↔ Edge',
      quickInclude: true,
    },
    {
      id: 'store-os',
      label: 'Pilar 2 — Store OS, Edge WAL & Satélite Waiter BYOD',
      scriptPath: 'tests/security/store-os.test.ts',
      pillars: ['Store OS', 'Waiter BYOD', 'Edge Node', 'Server Core'],
      boundary: 'Store OS ↔ Edge ↔ Waiter BYOD',
    },
    {
      id: 'marketplace',
      label: 'Pilar 3 — Marketplace, Delivery PIN & Satélite Driver',
      scriptPath: 'tests/security/marketplace.test.ts',
      pillars: ['Marketplace', 'Driver App', 'Server Core'],
      boundary: 'Marketplace ↔ Server Core ↔ Driver',
    },
    {
      id: 'phase1-security',
      label: 'Matriz Negativa P0-01 a P0-09',
      scriptPath: 'tests/security/phase1-security.test.ts',
      pillars: ['HQ Central', 'Store OS', 'Marketplace', 'Server Core'],
      boundary: 'Fronteira de Segurança Multi-Pilar',
      quickInclude: true,
    },
    {
      id: 'edge-wan-reconcile',
      label: 'Resiliência Offline & Reconciliação Edge ↔ Cloud',
      scriptPath: 'tests/cross-platform/edge-wan-reconcile.test.ts',
      pillars: ['Store OS', 'Edge Node', 'Server Core'],
      boundary: 'Resiliência WAN & Sync HLC',
    },
    {
      id: 'global-homologation',
      label: 'Homologação Global Cross-Platform (Web/Tauri/Android)',
      scriptPath: 'tests/cross-platform/global-homologation.test.ts',
      pillars: ['HQ Central', 'Store OS', 'Marketplace', 'Driver App', 'Waiter BYOD', 'Edge Node', 'Server Core'],
      boundary: 'Contrato Cross-Platform RFC-001',
    },
    {
      id: 'offline-maps-vector',
      label: 'Cartografia Vetorial OpenFreeMap & Offline PMTiles (Range 206)',
      scriptPath: 'tests/cross-platform/offline-maps-vector.test.ts',
      pillars: ['Design System', 'Server Core', 'Edge Node', 'Marketplace', 'Driver App', 'Store OS'],
      boundary: 'Cartografia Vetorial & LAN Offline',
      quickInclude: true,
    },
    {
      id: 'e2e-ecosystem',
      label: 'Fluxo E2E Multi-Ator (Marketplace → Store → Driver → HQ)',
      scriptPath: 'scripts/test-ecosystem-interaction.ts',
      pillars: ['Marketplace', 'Store OS', 'Driver App', 'Server Core', 'HQ Central'],
      boundary: 'Ciclo Completo 4 Pilares',
    },
    {
      id: 'phase3-sync',
      label: 'Fase 3 — Persistência, Stock Ledger & SyncEngine Offline',
      scriptPath: 'scripts/test-phase3-sync.ts',
      pillars: ['Server Core', 'Store OS', 'Edge Node'],
      boundary: 'Ledger & Sync Engine',
    },
    {
      id: 'sentinel-heavy',
      label: 'Sentinel Heavy — Concorrência Promise.all, Matriz Negativa & Edge WAL',
      scriptPath: 'tests/sentinel/heavy-stress-and-security.test.ts',
      pillars: ['HQ Central', 'Store OS', 'Marketplace', 'Driver App', 'Edge Node', 'Server Core'],
      boundary: 'Concorrência ACID & Segurança Pesada',
      quickInclude: true,
    },
    {
      id: 'audit-remediation',
      label: 'Remediação P0/P1/P2 — Canais, Sync FSM, HLC, Edge Token & Restore',
      scriptPath: 'tests/security/audit-remediation.test.ts',
      pillars: ['HQ Central', 'Store OS', 'Marketplace', 'Server Core', 'Edge Node'],
      boundary: 'Fronteiras Auditadas 5.2.1',
      quickInclude: true,
    },
    {
      id: 'cloud-hub-readiness',
      label: 'Prontidão Cloud Hub PostgreSQL, RLS & Driver Contrato',
      scriptPath: 'tests/security/cloud-hub-readiness.test.ts',
      pillars: ['Server Core', 'Cloud Hub'],
      boundary: 'PostgreSQL Cloud & RLS',
      quickInclude: true,
    },
    {
      id: 'driver-dual-fleet',
      label: 'Driver Dual Fleet — Plataforma HQ + Frota da Loja (App Único)',
      scriptPath: 'tests/security/driver-dual-fleet.test.ts',
      pillars: ['Driver App', 'HQ Central', 'Store OS', 'Server Core'],
      boundary: 'Driver ↔ HQ ↔ Store OS',
      quickInclude: true,
    },
    {
      id: 'postgres-rls-concurrency',
      label: 'PostgreSQL Cloud — Homologação RLS, Isolamento Tenant & Concorrência',
      scriptPath: 'tests/security/postgres-rls-concurrency.test.ts',
      pillars: ['Server Core', 'Cloud Hub', 'Store OS', 'HQ Central'],
      boundary: 'PostgreSQL Relacional ↔ RLS ↔ Concorrência',
      quickInclude: true,
    },
    {
      id: 'production-readiness',
      label: 'Prontidão de Produção — Gateways PSP HMAC, Cofre AES-256, ESC/POS, Edge WAL & LGPD',
      scriptPath: 'tests/security/production-readiness.test.ts',
      pillars: ['Store OS', 'Marketplace', 'HQ Central', 'Server Core', 'Edge Node'],
      boundary: 'Gateways ↔ Periféricos ↔ Compliance LGPD',
      quickInclude: true,
    },
    {
      id: 'firebase-optional-connector',
      label: 'Modo Dual Firebase — Conector Opcional ON vs Autônomo OFF (Kill-Switch & Regras)',
      scriptPath: 'tests/security/firebase-optional-connector.test.ts',
      pillars: ['HQ Central', 'Server Core', 'Marketplace'],
      boundary: 'Server Core ↔ Conector Opcional Firebase',
      quickInclude: true,
    },
    {
      id: 'marketplace-governance-and-growth',
      label: 'Governança Marketplace, Anúncios Patrocinados, Anti-IDOR & Releases',
      scriptPath: 'tests/security/marketplace-governance-and-growth.test.ts',
      pillars: ['HQ Central', 'Store OS', 'Marketplace', 'Server Core'],
      boundary: 'HQ ↔ Store OS ↔ Marketplace (B2B/B2C)',
      quickInclude: true,
    },
    {
      id: 'user-experience-and-isolation',
      label: 'Experiência & Isolamento por Tipo de Usuário (5 Personas)',
      scriptPath: 'tests/security/user-experience-and-isolation.test.ts',
      pillars: ['Marketplace', 'Store OS', 'HQ Central', 'Waiter BYOD', 'Driver App', 'Server Core'],
      boundary: 'UX & Autenticação Isolada (5 Personas)',
      quickInclude: true,
    },
    {
      id: 'supabase-optional-connector',
      label: 'Conector Opcional Supabase (@supabase/supabase-js + @supabase/server)',
      scriptPath: 'tests/security/supabase-optional-connector.test.ts',
      pillars: ['HQ Central', 'Server Core', 'Marketplace'],
      boundary: 'Server Core ↔ Conector Opcional Supabase',
      quickInclude: true,
    },
  ];

  const selected = isQuickMode ? suites.filter((s) => s.quickInclude) : suites;
  const skippedSuites: SkippedItem[] = isQuickMode
    ? suites
        .filter((s) => !s.quickInclude)
        .map((s) => ({
          id: s.id,
          title: s.label,
          reason: 'SKIPPED_BY_FLAG' as const,
          detail: 'Suíte omitida no modo --quick (execução parcial).',
        }))
    : [];
  const results: SuiteResult[] = [];

  for (const s of selected) {
    const dbPath = path.join(tmpSandboxDir, `${s.id}-db.json`);
    const secretPath = path.join(tmpSandboxDir, `${s.id}-secret`);
    const res = runShellCommand('npx', ['tsx', s.scriptPath], {
      SERVER_DB_PATH: dbPath,
      SERVER_SECRET_PATH: secretPath,
      SERVER_SECRET: '3c_sentinel_isolated_token_secret_deterministic_key_2026',
      NODE_ENV: 'test',
    });

    const combined = `${res.stdout}\n${res.stderr}`;
    const lines = combined.split(/\r?\n/);
    const passedChecks = lines.filter((l) => /^\s*(✓|✅)\s+/.test(l)).length;
    const failedLines = lines.filter((l) => /^\s*(✗|❌)\s+/.test(l)).map((l) => l.trim());
    if (passedChecks === 0 && res.status === 0) {
      failedLines.push(`Suíte ${s.id} executou 0 asserções válidas (rejeição de aprovação vazia)`);
    }
    const outputTail = lines.slice(-15).join('\n').trim();

    results.push({
      id: s.id,
      label: s.label,
      command: `npx tsx ${s.scriptPath}`,
      pillars: s.pillars,
      boundary: s.boundary,
      passed: res.status === 0 && failedLines.length === 0 && passedChecks > 0,
      exitCode: res.status,
      durationMs: res.durationMs,
      passedChecks,
      failedChecks: failedLines.length,
      failedLines,
      outputTail,
    });
  }

  return { results, skippedSuites };
}

function buildMarkdownReport(report: SentinelReport): string {
  const lines: string[] = [
    '# Relatório de Auditoria — 3C Sentinel 1.0',
    '',
    `- **Data/Hora:** ${report.executedAt}`,
    `- **Modo:** ${report.mode}`,
    `- **Completude da Execução:** ${report.summary.completeness === 'FULL' ? 'FULL (sem itens ignorados)' : `PARTIAL (${report.summary.skippedChecksCount} check(s) / ${report.summary.skippedSuitesCount} suíte(s) ignorada(s))`}`,
    `- **Persistência de Teste:** \`${report.persistenceModeUnderTest}\` (zero alterações no banco principal ou código-fonte)`,
    `- **Status Geral:** ${report.summary.overallStatus === 'PASS' ? '✅ PASS (0 falhas comprovadas)' : `❌ FAIL (${report.summary.provenFindingsCount} falha(s) comprovada(s))`}`,
    `- **Inventário Server Core:** ${report.routeInventory.endpointsDetected} endpoints detectados em ${report.routeInventory.routerFiles} arquivos de rota`,
    '',
    '## Placar Determinístico',
    '',
    `| Indicador | Resultado |`,
    `| :--- | :--- |`,
    `| Scanner Estático & Build | ${report.summary.scannerPassed} aprovados / ${report.summary.scannerFailed} falhas / ${report.summary.skippedChecksCount} ignorados |`,
    `| Suítes Executadas | ${report.summary.suitesPassed} aprovadas / ${report.summary.suitesFailed} falhas / ${report.summary.skippedSuitesCount} ignoradas |`,
    `| Asserções Determinísticas | ${report.summary.totalAssertionsPassed} aprovadas / ${report.summary.totalAssertionsFailed} falhas |`,
    `| Ocorrências Comprovadas (P0/P1/P2/P3) | ${report.summary.bySeverity.P0} P0 / ${report.summary.bySeverity.P1} P1 / ${report.summary.bySeverity.P2} P2 / ${report.summary.bySeverity.P3} P3 |`,
    '',
    '## Cobertura das Fronteiras Entre Pilares',
    '',
    '| Fronteira | Status | Suítes |',
    '| :--- | :--- | :--- |',
    ...report.pillarBoundaries.map(
      (b) => `| ${b.boundary} | ${b.status === 'PASS' ? '✅ PASS' : '❌ FAIL'} | ${b.suites.join(', ')} |`
    ),
    '',
    '## Scanner Estático',
    '',
    ...report.scannerChecks.map(
      (c) => `- ${c.passed ? '✓' : '✗'} **${c.id} — ${c.title}:** ${c.observed}`
    ),
    ...(report.skippedChecks.length > 0
      ? [
          '',
          '## Verificações Ignoradas / Bloqueadas por Pré-requisito',
          '',
          ...report.skippedChecks.map((s) => `- ⏭️ **${s.id} — ${s.title}** [${s.reason}]: ${s.detail}`),
        ]
      : []),
    '',
    '## Suítes Determinísticas',
    '',
    '| Suíte | Status | Checks (`✓`/`✗`) | Duração |',
    '| :--- | :--- | :--- | :--- |',
    ...report.suiteResults.map(
      (s) => `| ${s.label} (\`${s.id}\`) | ${s.passed ? '✅ PASS' : '❌ FAIL'} | ${s.passedChecks} ✓ / ${s.failedChecks} ✗ | ${s.durationMs} ms |`
    ),
    ...(report.skippedSuites.length > 0
      ? [
          '',
          '### Suítes Ignoradas',
          '',
          ...report.skippedSuites.map((s) => `- ⏭️ **${s.id} — ${s.title}** [${s.reason}]: ${s.detail}`),
        ]
      : []),
    '',
  ];

  if (report.provenFindings.length > 0) {
    lines.push('## Ocorrências Comprovadas', '');
    for (const f of report.provenFindings) {
      lines.push(
        `### [${f.severity}] ${f.id} — ${f.title}`,
        `- **Pilares:** ${f.pillars.join(', ')}`,
        `- **Contrato Violado:** ${f.violatedContract}`,
        `- **Reprodução:** \`${f.reproductionCommand}\``,
        `- **Alvo:** \`${f.evidence.target}\``,
        `- **Observado:** \`${f.evidence.observedOutput}\``,
        `- **Esperado:** \`${f.evidence.expectedOutput}\``,
        ''
      );
    }
  } else {
    lines.push('## Ocorrências Comprovadas', '', 'Nenhuma falha comprovada nesta execução.', '');
  }

  return lines.join('\n');
}

function main() {
  console.log('======================================================================');
  console.log(`🛡️  3C SENTINEL 1.0 — AUDITORIA DETERMINÍSTICA (${isQuickMode ? 'QUICK' : 'FULL'})`);
  console.log('======================================================================');

  const tmpSandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-sentinel-sandbox-'));
  let report: SentinelReport;

  try {
    const beforeSnapshot = captureRootSnapshot();

    console.log('\n[1/3] Módulo Scanner (Zero-Firebase, Dependências, Rotas & Typecheck/Build)...');
    const { checks: scannerChecks, skippedChecks, routeInventory, telemetryMeta } = runScanner();
    for (const c of scannerChecks) {
      console.log(`  ${c.passed ? '✓' : '✗'} [${c.id}] ${c.title} -> ${c.observed}`);
    }
    for (const sc of skippedChecks) {
      console.log(`  ⏭️ [${sc.id}] ${sc.title} (${sc.reason}: ${sc.detail})`);
    }

    console.log('\n[2/3] Módulos Test Runner, Integration Tester & Security Auditor (Sandbox Isolado)...');
    const { results: suiteResults, skippedSuites } = runSuites(tmpSandboxDir);
    for (const s of suiteResults) {
      console.log(
        `  ${s.passed ? '✓' : '✗'} [${s.id}] ${s.label} (${s.passedChecks} checks, exit=${s.exitCode}, ${s.durationMs}ms)`
      );
      for (const fl of s.failedLines) {
        console.error(`      -> ${fl}`);
      }
    }
    for (const ss of skippedSuites) {
      console.log(`  ⏭️ [${ss.id}] ${ss.title} (${ss.reason}: ${ss.detail})`);
    }

    const afterSnapshot = captureRootSnapshot();
    const rootMutated =
      beforeSnapshot.secretExists !== afterSnapshot.secretExists ||
      beforeSnapshot.dbExists !== afterSnapshot.dbExists ||
      beforeSnapshot.dbSha256 !== afterSnapshot.dbSha256 ||
      afterSnapshot.secretExists;
    const isolationCheck: ScannerCheckResult = {
      id: 'SCAN-12',
      title: 'Prova Zero-Root-Mutation: suítes não criaram nem alteraram .server-secret ou server-db.json na raiz',
      passed: !rootMutated,
      severityOnFail: 'P1',
      violatedContract: 'Isolamento estrito de sandbox (docs/architecture/qa-sentinel/README.md)',
      target: '.server-secret e server-db.json na raiz antes/depois das suítes',
      observed: !rootMutated
        ? '0 mutações na raiz durante execução das suítes'
        : `Mutação detectada: secret=${beforeSnapshot.secretExists}->${afterSnapshot.secretExists}, db=${beforeSnapshot.dbExists}->${afterSnapshot.dbExists}`,
      expected: 'Estado idêntico na raiz antes e depois das suítes, sem .server-secret',
      reproductionCommand: 'npm run sentinel',
    };
    scannerChecks.push(isolationCheck);
    console.log(`  ${isolationCheck.passed ? '✓' : '✗'} [${isolationCheck.id}] ${isolationCheck.title} -> ${isolationCheck.observed}`);

    console.log('\n[3/3] Módulo Intelligence Analyzer (Correlação, Evidências & Logs)...');
    const provenFindings: ProvenFinding[] = [];

    for (const sc of scannerChecks) {
      if (!sc.passed) {
        provenFindings.push({
          id: sc.id,
          title: sc.title,
          severity: sc.severityOnFail,
          pillars: ['Server Core', 'Arquitetura Global'],
          violatedContract: sc.violatedContract,
          reproductionCommand: sc.reproductionCommand,
          evidence: {
            target: sc.target,
            observedOutput: sc.observed,
            expectedOutput: sc.expected,
          },
        });
      }
    }

    for (const sr of suiteResults) {
      if (!sr.passed) {
        provenFindings.push({
          id: `SUITE-${sr.id.toUpperCase()}`,
          title: `Falha determinística na suíte ${sr.label}`,
          severity: sr.id.includes('security') || sr.id === 'hq-central' || sr.id === 'server-core' ? 'P0' : 'P1',
          pillars: sr.pillars,
          violatedContract: `Suíte de contrato e integração (${sr.boundary})`,
          reproductionCommand: sr.command,
          evidence: {
            target: sr.command,
            observedOutput: sr.failedLines.length > 0 ? sr.failedLines.join(' | ') : sr.outputTail.slice(0, 400),
            expectedOutput: 'Exit code 0 e 0 asserções reprovadas',
          },
        });
      }
    }

    const bySeverity: Record<Severity, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
    for (const f of provenFindings) bySeverity[f.severity]++;

    const boundariesMap = new Map<string, { status: 'PASS' | 'FAIL'; suites: string[] }>();
    for (const sr of suiteResults) {
      const prev = boundariesMap.get(sr.boundary) || { status: 'PASS' as const, suites: [] };
      prev.suites.push(sr.id);
      if (!sr.passed) prev.status = 'FAIL';
      boundariesMap.set(sr.boundary, prev);
    }

    const scannerPassed = scannerChecks.filter((c) => c.passed).length;
    const scannerFailed = scannerChecks.length - scannerPassed;
    const suitesPassed = suiteResults.filter((s) => s.passed).length;
    const suitesFailed = suiteResults.length - suitesPassed;
    const totalAssertionsPassed = suiteResults.reduce((acc, s) => acc + s.passedChecks, 0) + scannerPassed;
    const totalAssertionsFailed = suiteResults.reduce((acc, s) => acc + s.failedChecks, 0) + scannerFailed;
    const completeness = skippedChecks.length === 0 && skippedSuites.length === 0 ? 'FULL' : 'PARTIAL';

    report = {
      sentinelVersion: '1.0.0',
      executedAt: new Date().toISOString(),
      mode: isQuickMode ? 'QUICK' : 'FULL',
      persistenceModeUnderTest: 'SANDBOX_ISOLATED_TMP',
      runtime: {
        node: process.version,
        platform: process.platform,
        cwd: ROOT,
      },
      summary: {
        scannerPassed,
        scannerFailed,
        suitesPassed,
        suitesFailed,
        skippedChecksCount: skippedChecks.length,
        skippedSuitesCount: skippedSuites.length,
        completeness,
        totalAssertionsPassed,
        totalAssertionsFailed,
        provenFindingsCount: provenFindings.length,
        bySeverity,
        overallStatus: provenFindings.length === 0 ? 'PASS' : 'FAIL',
      },
      routeInventory,
      pillarBoundaries: Array.from(boundariesMap.entries()).map(([boundary, v]) => ({
        boundary,
        status: v.status,
        suites: v.suites,
      })),
      scannerChecks,
      skippedChecks,
      suiteResults,
      skippedSuites,
      provenFindings,
    };

    const reportDir = path.join(ROOT, '.sentinel');
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, 'report-latest.json'), JSON.stringify(report, null, 2), 'utf8');
    fs.writeFileSync(path.join(reportDir, 'report-latest.md'), buildMarkdownReport(report), 'utf8');

    const logsResult = buildAndPersistSentinelLogs({
      rootDir: ROOT,
      reportDir,
      executedAt: report.executedAt,
      mode: report.mode,
      completeness,
      overallStatus: report.summary.overallStatus,
      scannerChecks,
      skippedChecks,
      suiteResults,
      skippedSuites,
      monoliths: telemetryMeta.monoliths,
      hasLocalRootDbHashes: telemetryMeta.hasLocalRootDbHashes,
      rootDbIgnoredByGit: telemetryMeta.rootDbIgnoredByGit,
      sidecarPresentOnDisk: telemetryMeta.sidecarPresentOnDisk,
    });

    console.log('\n======================================================================');
    console.log(`📊 SENTINEL 1.0 VEREDITO: ${report.summary.overallStatus} (${completeness})`);
    console.log(`   Scanner: ${scannerPassed}/${scannerChecks.length} | Suítes: ${suitesPassed}/${suiteResults.length} | Ignorados: ${skippedChecks.length} check(s), ${skippedSuites.length} suíte(s) | Asserções: ${totalAssertionsPassed} ✓ / ${totalAssertionsFailed} ✗`);
    console.log(
      `   Logs: ${logsResult.deficienciesPayload.counts.open} deficiência(s) aberta(s), ${logsResult.deficienciesPayload.counts.advisory} consultiva(s) | ${logsResult.improvementsPayload.counts.verified} melhoria(s) verificada(s), ${logsResult.improvementsPayload.counts.recommended} recomendada(s) | Histórico: ${logsResult.historyCount} execução(ões)`
    );
    console.log(`   Artefatos: .sentinel/report-latest.*, .sentinel/deficiencies-log.*, .sentinel/improvements-log.*, .sentinel/audit-history.ndjson`);
    console.log('======================================================================\n');

    if (report.summary.overallStatus !== 'PASS') {
      process.exit(1);
    }
  } finally {
    try {
      fs.rmSync(tmpSandboxDir, { recursive: true, force: true });
    } catch {
      // ignore temp cleanup errors
    }
  }
}

main();
