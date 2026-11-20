import express from 'express';
import {
  handlePmtilesArchiveRequest,
  handlePmtilesCatalogRequest,
  resolvePmtilesDirectory,
} from './pmtilesServerHelper.ts';

const router = express.Router();

router.get('/pmtiles/catalog', async (req, res) => {
  await handlePmtilesCatalogRequest(req, res, {
    dirPath: resolvePmtilesDirectory(),
    source: 'CLOUD_HUB',
    urlPrefix: '/api/v1/maps/pmtiles',
  });
});

router.head('/pmtiles/:archive', async (req, res) => {
  await handlePmtilesArchiveRequest(req, res, {
    dirPath: resolvePmtilesDirectory(),
  });
});

router.get('/pmtiles/:archive', async (req, res) => {
  await handlePmtilesArchiveRequest(req, res, {
    dirPath: resolvePmtilesDirectory(),
  });
});

export default router;
