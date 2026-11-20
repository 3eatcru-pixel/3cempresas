import express from 'express';
import {
  handlePmtilesArchiveRequest,
  handlePmtilesCatalogRequest,
  resolvePmtilesDirectory,
} from '../../../src/server/routes/maps/pmtilesServerHelper.ts';
import { EdgeRouteContext } from './storeRoutes.ts';

export function registerEdgePmtilesRoutes(app: express.Express, ctx: EdgeRouteContext): void {
  const resolveDir = () => resolvePmtilesDirectory(ctx.config.pmtilesDir);

  app.get('/api/v1/maps/pmtiles/catalog', async (req, res) => {
    await handlePmtilesCatalogRequest(req, res, {
      dirPath: resolveDir(),
      source: 'EDGE_NODE',
      urlPrefix: '/api/v1/maps/pmtiles',
    });
  });

  app.head('/api/v1/maps/pmtiles/:archive', async (req, res) => {
    await handlePmtilesArchiveRequest(req, res, {
      dirPath: resolveDir(),
    });
  });

  app.get('/api/v1/maps/pmtiles/:archive', async (req, res) => {
    await handlePmtilesArchiveRequest(req, res, {
      dirPath: resolveDir(),
    });
  });
}
