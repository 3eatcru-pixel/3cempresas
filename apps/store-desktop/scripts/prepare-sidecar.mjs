#!/usr/bin/env node
import { execFileSync, spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopRoot, '../..');
const binariesDir = path.join(desktopRoot, 'src-tauri', 'binaries');
const edgeEntry = path.join(repoRoot, 'servers', 'edge-node', 'index.ts');
const sqliteDriverPath = path.join(repoRoot, 'src', 'server', 'persistence', 'SqliteWalDriver.ts');

const args = process.argv.slice(2);
const requireNative = args.includes('--require-native');
const targetArg = args.find((a) => a.startsWith('--target='));

function resolveTargetTriple() {
  if (targetArg) return targetArg.split('=')[1].trim();
  if (process.platform === 'win32') return 'x86_64-pc-windows-msvc';
  if (process.platform === 'darwin') {
    return process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
  }
  return process.arch === 'arm64' ? 'aarch64-unknown-linux-gnu' : 'x86_64-unknown-linux-gnu';
}

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function main() {
  if (!fs.existsSync(edgeEntry)) {
    console.error(`[sidecar:prepare] Entrypoint ausente: ${edgeEntry}`);
    process.exit(1);
  }
  if (!fs.existsSync(sqliteDriverPath)) {
    console.error(`[sidecar:prepare] SqliteWalDriver ausente: ${sqliteDriverPath}`);
    process.exit(1);
  }

  const targetTriple = resolveTargetTriple();
  const isWindows = targetTriple.includes('windows');
  const ext = isWindows ? '.exe' : '';
  const outputBinary = path.join(binariesDir, `3c-edge-node-${targetTriple}${ext}`);
  fs.mkdirSync(binariesDir, { recursive: true });

  const bunCheck = spawnSync('bun', ['--version'], { stdio: 'pipe', encoding: 'utf8' });
  const hasBun = bunCheck.status === 0;

  let mode = 'STAGED_LAUNCHER_WRAPPER';
  if (hasBun) {
    console.log(`[sidecar:prepare] Compilando binário nativo com Bun (${bunCheck.stdout.trim()}) para ${targetTriple}...`);
    execFileSync('bun', ['build', '--compile', edgeEntry, '--outfile', outputBinary], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    mode = 'NATIVE_COMPILED_BINARY';
  } else {
    if (requireNative) {
      console.error(
        `[sidecar:prepare] FALHA (--require-native): 'bun' não encontrado no PATH para compilar ${outputBinary}.`
      );
      process.exit(1);
    }

    const wrapperPath = path.join(binariesDir, `3c-edge-node-${targetTriple}${isWindows ? '.cmd' : '.sh'}`);
    const wrapperBody = isWindows
      ? `@echo off\r\nnpx --yes tsx "${edgeEntry}" %*\r\n`
      : `#!/usr/bin/env bash\nset -euo pipefail\nexec npx --yes tsx "${edgeEntry}" "$@"\n`;
    fs.writeFileSync(wrapperPath, wrapperBody, 'utf8');
    if (!isWindows) {
      fs.chmodSync(wrapperPath, 0o755);
    }
    console.warn(
      `[sidecar:prepare] AVISO: 'bun' ausente neste host. Wrapper de desenvolvimento criado em ${wrapperPath} (não substitui o binário nativo compilado '${path.basename(outputBinary)}' exigido pelo empacotador Tauri em produção).`
    );
  }

  const nativeBinaryPresent = fs.existsSync(outputBinary);
  if (mode === 'NATIVE_COMPILED_BINARY' && !nativeBinaryPresent) {
    mode = 'SOURCE_ONLY_REQUIRES_BUILD';
  }

  const manifest = {
    name: '3c-edge-node',
    version: '5.2.1',
    targetTriple,
    mode,
    nativeBinaryPresent,
    expectedNativeBinary: path.relative(desktopRoot, outputBinary),
    buildCommand: 'npm --workspace=@3c/store-desktop run sidecar:prepare:strict',
    sources: {
      edgeEntrySha256: sha256File(edgeEntry),
      sqliteDriverSha256: sha256File(sqliteDriverPath),
    },
    generatedAt: new Date().toISOString(),
  };

  const manifestPath = path.join(binariesDir, 'sidecar-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`[sidecar:prepare] Manifesto atualizado em ${manifestPath} (mode=${mode}, nativeBinaryPresent=${nativeBinaryPresent})`);
}

main();
