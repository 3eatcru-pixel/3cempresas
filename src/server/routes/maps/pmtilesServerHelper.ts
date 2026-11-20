import express from 'express';
import fs from 'fs';
import path from 'path';
import { bytesToHeader, TileType } from 'pmtiles';

export interface PmtilesArchiveSummary {
  name: string;
  fileName: string;
  url: string;
  sizeBytes: number;
  updatedAt: string;
  etag: string;
  tileType: 'mvt' | 'png' | 'jpg' | 'webp' | 'avif' | 'unknown';
  minZoom: number;
  maxZoom: number;
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  centerLon: number;
  centerLat: number;
  centerZoom: number;
  clustered: boolean;
}

const SAFE_PMTILES_FILENAME_RE = /^[a-zA-Z0-9._-]+\.pmtiles$/i;

export function resolvePmtilesDirectory(explicitDir?: string): string {
  const configured =
    explicitDir ||
    process.env.EDGE_PMTILES_DIR ||
    process.env.MAPS_PMTILES_DIR ||
    path.join(process.cwd(), 'data', 'pmtiles');
  return path.resolve(configured);
}

export function sanitizePmtilesArchiveName(rawName: unknown): string | null {
  const trimmed = String(rawName || '').trim();
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
    return null;
  }
  if (!SAFE_PMTILES_FILENAME_RE.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function resolveSafePmtilesPath(dirPath: string, rawArchiveName: unknown): string | null {
  const safeName = sanitizePmtilesArchiveName(rawArchiveName);
  if (!safeName) return null;
  const resolvedDir = path.resolve(dirPath);
  const resolvedFile = path.resolve(resolvedDir, safeName);
  if (!resolvedFile.startsWith(resolvedDir + path.sep)) {
    return null;
  }
  return resolvedFile;
}

export function parseByteRangeHeader(
  rangeHeader: string | undefined,
  totalSize: number
): { start: number; end: number } | 'INVALID' | null {
  if (!rangeHeader) return null;
  const match = String(rangeHeader).trim().match(/^bytes=(\d*)-(\d*)$/i);
  if (!match) return 'INVALID';

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return 'INVALID';

  if (totalSize <= 0) return 'INVALID';

  let start: number;
  let end: number;

  if (!rawStart) {
    // Suffix byte-range: bytes=-N (last N bytes)
    const suffixLength = Number(rawEnd);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return 'INVALID';
    start = Math.max(0, totalSize - suffixLength);
    end = totalSize - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : totalSize - 1;
  }

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= totalSize
  ) {
    return 'INVALID';
  }

  end = Math.min(end, totalSize - 1);
  return { start, end };
}

function mapTileTypeLabel(tileType: TileType): PmtilesArchiveSummary['tileType'] {
  switch (tileType) {
    case TileType.Mvt:
      return 'mvt';
    case TileType.Png:
      return 'png';
    case TileType.Jpeg:
      return 'jpg';
    case TileType.Webp:
      return 'webp';
    case TileType.Avif:
      return 'avif';
    default:
      return 'unknown';
  }
}

export async function inspectPmtilesArchive(
  filePath: string,
  fileName: string,
  urlPrefix = '/api/v1/maps/pmtiles'
): Promise<PmtilesArchiveSummary | null> {
  let handle: fs.promises.FileHandle | null = null;
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile() || stat.size < 127) {
      return null;
    }

    handle = await fs.promises.open(filePath, 'r');
    const buf = Buffer.alloc(127);
    const { bytesRead } = await handle.read(buf, 0, 127, 0);
    if (bytesRead < 127) {
      return null;
    }

    const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
    const header = bytesToHeader(arrayBuf, etag);

    return {
      name: fileName.replace(/\.pmtiles$/i, ''),
      fileName,
      url: `${urlPrefix.replace(/\/+$/, '')}/${encodeURIComponent(fileName)}`,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
      etag,
      tileType: mapTileTypeLabel(header.tileType),
      minZoom: header.minZoom,
      maxZoom: header.maxZoom,
      minLon: header.minLon,
      minLat: header.minLat,
      maxLon: header.maxLon,
      maxLat: header.maxLat,
      centerLon: header.centerLon,
      centerLat: header.centerLat,
      centerZoom: header.centerZoom,
      clustered: Boolean(header.clustered),
    };
  } catch {
    return null;
  } finally {
    if (handle) {
      await handle.close().catch(() => {});
    }
  }
}

export async function listPmtilesCatalog(
  dirPath: string,
  urlPrefix = '/api/v1/maps/pmtiles'
): Promise<{ available: boolean; directory: string; archives: PmtilesArchiveSummary[] }> {
  const resolvedDir = path.resolve(dirPath);
  if (!fs.existsSync(resolvedDir)) {
    return { available: false, directory: resolvedDir, archives: [] };
  }

  let entries: string[] = [];
  try {
    entries = await fs.promises.readdir(resolvedDir);
  } catch {
    return { available: false, directory: resolvedDir, archives: [] };
  }

  const pmtilesFiles = entries.filter((name) => SAFE_PMTILES_FILENAME_RE.test(name)).sort();
  const inspected = await Promise.all(
    pmtilesFiles.map((fileName) =>
      inspectPmtilesArchive(path.join(resolvedDir, fileName), fileName, urlPrefix)
    )
  );
  const archives = inspected.filter((item): item is PmtilesArchiveSummary => item !== null);
  return {
    available: archives.length > 0,
    directory: resolvedDir,
    archives,
  };
}

export async function handlePmtilesCatalogRequest(
  _req: express.Request,
  res: express.Response,
  options: { dirPath: string; source: 'CLOUD_HUB' | 'EDGE_NODE'; urlPrefix?: string }
): Promise<void> {
  try {
    const catalog = await listPmtilesCatalog(options.dirPath, options.urlPrefix || '/api/v1/maps/pmtiles');
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json({
      source: options.source,
      available: catalog.available,
      archives: catalog.archives,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao consultar catálogo PMTiles.' });
  }
}

export async function handlePmtilesArchiveRequest(
  req: express.Request,
  res: express.Response,
  options: { dirPath: string }
): Promise<void> {
  const resolvedFile = resolveSafePmtilesPath(options.dirPath, req.params.archive);
  if (!resolvedFile) {
    res.status(400).json({ error: 'Nome de arquivo .pmtiles inválido.' });
    return;
  }

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(resolvedFile);
    if (!stat.isFile()) {
      res.status(404).json({ error: 'Arquivo PMTiles não encontrado.' });
      return;
    }
  } catch {
    res.status(404).json({ error: 'Arquivo PMTiles não encontrado.' });
    return;
  }

  const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch && String(ifNoneMatch).trim() === etag) {
    res.status(304).end();
    return;
  }

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', 'application/vnd.pmtiles');
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, ETag');

  const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;
  const parsedRange = parseByteRangeHeader(rangeHeader, stat.size);

  if (parsedRange === 'INVALID') {
    res.status(416);
    res.setHeader('Content-Range', `bytes */${stat.size}`);
    res.end();
    return;
  }

  if (parsedRange) {
    const chunkSize = parsedRange.end - parsedRange.start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${parsedRange.start}-${parsedRange.end}/${stat.size}`);
    res.setHeader('Content-Length', String(chunkSize));

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(resolvedFile, {
      start: parsedRange.start,
      end: parsedRange.end,
    });
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).end();
      else res.destroy();
    });
    req.on('close', () => stream.destroy());
    stream.pipe(res);
    return;
  }

  res.status(200);
  res.setHeader('Content-Length', String(stat.size));
  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const stream = fs.createReadStream(resolvedFile);
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).end();
    else res.destroy();
  });
  req.on('close', () => stream.destroy());
  stream.pipe(res);
}
