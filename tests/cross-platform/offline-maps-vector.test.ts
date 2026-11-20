import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createServerCoreApp } from '../../src/server/app.ts';
import { EdgeNodeRuntime } from '../../servers/edge-node/index.ts';
import {
  buildOfflinePmtilesStyle,
  VECTOR_STYLE_URLS,
} from '../../packages/design-system/src/components/map/mapVectorAndPmtilesConfig.ts';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), '3c-pmtiles-test-'));
const cloudPmtilesDir = path.join(tempRoot, 'cloud-pmtiles');
const edgePmtilesDir = path.join(tempRoot, 'edge-pmtiles');
fs.mkdirSync(cloudPmtilesDir, { recursive: true });
fs.mkdirSync(edgePmtilesDir, { recursive: true });

if (!process.env.SERVER_DB_PATH) {
  process.env.SERVER_DB_PATH = path.join(tempRoot, 'cloud-db.json');
}
if (!process.env.SERVER_SECRET_PATH) {
  process.env.SERVER_SECRET_PATH = path.join(tempRoot, '.server-secret');
}
if (!process.env.SERVER_SECRET) {
  process.env.SERVER_SECRET = '3c_offline_maps_test_secret_2026';
}
process.env.MAPS_PMTILES_DIR = cloudPmtilesDir;

let passed = 0;
let failed = 0;

function check(cond: boolean, name: string, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

function buildMinimalPmtilesV3Archive(payloadSize = 512): Buffer {
  const header = Buffer.alloc(127 + payloadSize, 0);
  // Magic: "PMTiles" + spec version 3
  header.write('PMTiles', 0, 'ascii');
  header.writeUInt8(3, 7);
  // rootOffset (offset 8..15) = 127, rootLength = 16
  header.writeBigUInt64LE(127n, 8);
  header.writeBigUInt64LE(16n, 16);
  // clustered = 1 (offset 96), internalCompression = 2 (gzip), tileCompression = 2, tileType = 1 (MVT)
  header.writeUInt8(1, 96);
  header.writeUInt8(2, 97);
  header.writeUInt8(2, 98);
  header.writeUInt8(1, 99);
  // minZoom = 0, maxZoom = 15
  header.writeUInt8(0, 100);
  header.writeUInt8(15, 101);
  // minLon/minLat/maxLon/maxLat (e7 scaled int32) around Londrina (-23.4, -51.2)
  header.writeInt32LE(Math.round(-51.35 * 1e7), 102);
  header.writeInt32LE(Math.round(-23.52 * 1e7), 106);
  header.writeInt32LE(Math.round(-50.95 * 1e7), 110);
  header.writeInt32LE(Math.round(-23.12 * 1e7), 114);
  header.writeUInt8(13, 118); // centerZoom
  // Fill payload with deterministic marker bytes
  for (let i = 0; i < payloadSize; i++) {
    header[127 + i] = (i * 7 + 3) & 0xff;
  }
  return header;
}

async function runTests() {
  console.log('\n[Test Onda 5] Vector Cartography & Offline PMTiles Range Streaming\n');

  const archiveBytes = buildMinimalPmtilesV3Archive(512);
  fs.writeFileSync(path.join(cloudPmtilesDir, 'londrina.pmtiles'), archiveBytes);
  fs.writeFileSync(path.join(edgePmtilesDir, 'londrina-edge.pmtiles'), archiveBytes);

  // 1. Design system vector config checks
  check(
    VECTOR_STYLE_URLS.dark === 'https://tiles.openfreemap.org/styles/dark',
    'OpenFreeMap dark vector style URL configured natively'
  );
  check(
    VECTOR_STYLE_URLS.osm === 'https://tiles.openfreemap.org/styles/liberty',
    'OpenFreeMap liberty vector style URL configured'
  );

  const vectorStyle = buildOfflinePmtilesStyle(
    {
      name: 'londrina',
      fileName: 'londrina.pmtiles',
      url: '/api/v1/maps/pmtiles/londrina.pmtiles',
      sizeBytes: archiveBytes.length,
      updatedAt: new Date().toISOString(),
      etag: '"test"',
      tileType: 'mvt',
      minZoom: 0,
      maxZoom: 15,
      minLon: -51.35,
      minLat: -23.52,
      maxLon: -50.95,
      maxLat: -23.12,
      centerLon: -51.16,
      centerLat: -23.31,
      centerZoom: 13,
      clustered: true,
    },
    'dark'
  );
  check(
    vectorStyle.version === 8 &&
      vectorStyle.sources?.protomaps?.type === 'vector' &&
      String(vectorStyle.sources?.protomaps?.url).startsWith('pmtiles://') &&
      Array.isArray(vectorStyle.layers) &&
      vectorStyle.layers.length >= 8,
    'buildOfflinePmtilesStyle produces MapLibre v8 vector style with pmtiles:// source'
  );

  // 2. Cloud Hub Express PMTiles endpoint test
  const cloudApp = createServerCoreApp();
  const cloudServer = http.createServer(cloudApp);
  await new Promise<void>((resolve) => cloudServer.listen(0, '127.0.0.1', resolve));
  const cloudPort = (cloudServer.address() as { port: number }).port;
  const cloudBase = `http://127.0.0.1:${cloudPort}`;

  try {
    const catRes = await fetch(`${cloudBase}/api/v1/maps/pmtiles/catalog`);
    const catJson: any = await catRes.json();
    check(catRes.status === 200 && catJson.available === true, 'Cloud catalog returns 200 & available=true');
    check(
      catJson.source === 'CLOUD_HUB' &&
        catJson.archives?.[0]?.fileName === 'londrina.pmtiles' &&
        catJson.archives?.[0]?.tileType === 'mvt' &&
        catJson.archives?.[0]?.maxZoom === 15,
      'Cloud catalog parses PMTiles v3 header metadata cleanly'
    );

    const rangeRes = await fetch(`${cloudBase}/api/v1/maps/pmtiles/londrina.pmtiles`, {
      headers: { Range: 'bytes=0-126' },
    });
    const rangeBuf = Buffer.from(await rangeRes.arrayBuffer());
    check(
      rangeRes.status === 206 &&
        rangeRes.headers.get('accept-ranges') === 'bytes' &&
        rangeRes.headers.get('content-range') === `bytes 0-126/${archiveBytes.length}` &&
        rangeBuf.length === 127 &&
        rangeBuf.subarray(0, 7).toString('ascii') === 'PMTiles',
      'Cloud PMTiles endpoint returns HTTP 206 Partial Content for 127-byte header range'
    );

    const invalidRangeRes = await fetch(`${cloudBase}/api/v1/maps/pmtiles/londrina.pmtiles`, {
      headers: { Range: `bytes=${archiveBytes.length + 50}-${archiveBytes.length + 100}` },
    });
    check(invalidRangeRes.status === 416, 'Cloud PMTiles endpoint rejects out-of-bounds range with 416');

    const traversalRes = await fetch(`${cloudBase}/api/v1/maps/pmtiles/..%2Fsecret.pmtiles`);
    check(traversalRes.status === 400, 'Cloud PMTiles endpoint blocks path traversal with 400');

    // 3. 3C Edge Node offline PMTiles test
    const edgeRuntime = new EdgeNodeRuntime({
      storeId: 'store-maps-test',
      tenantId: 'tenant-maps-test',
      dbPath: path.join(tempRoot, 'edge.sqlite'),
      pmtilesDir: edgePmtilesDir,
      port: 0,
    });
    const edgePort = await edgeRuntime.listen(0);
    const edgeBase = `http://127.0.0.1:${edgePort}`;

    try {
      const edgeCatRes = await fetch(`${edgeBase}/api/v1/maps/pmtiles/catalog`);
      const edgeCatJson: any = await edgeCatRes.json();
      check(
        edgeCatRes.status === 200 &&
          edgeCatJson.source === 'EDGE_NODE' &&
          edgeCatJson.available === true &&
          edgeCatJson.archives?.[0]?.fileName === 'londrina-edge.pmtiles',
        '3C Edge Node catalog serves LAN offline PMTiles metadata'
      );

      const edgeRangeRes = await fetch(`${edgeBase}/api/v1/maps/pmtiles/londrina-edge.pmtiles`, {
        headers: { Range: 'bytes=127-254' },
      });
      const edgeBuf = Buffer.from(await edgeRangeRes.arrayBuffer());
      check(
        edgeRangeRes.status === 206 &&
          edgeBuf.length === 128 &&
          edgeBuf.equals(archiveBytes.subarray(127, 255)),
        '3C Edge Node streams exact byte-range chunk (206) for offline LAN maps'
      );
    } finally {
      await edgeRuntime.close();
    }
  } finally {
    await new Promise<void>((resolve) => cloudServer.close(() => resolve()));
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log(`\n[Result] Passed: ${passed}, Failed: ${failed}\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
