import express from 'express';
import edgeRegistryCore from './sync/edgeRegistryCore.ts';
import syncPushPullCore from './sync/syncPushPullCore.ts';

const router = express.Router();

router.use('/', edgeRegistryCore);
router.use('/', syncPushPullCore);

export default router;
