import express from 'express';
import staffCore from './staffCore.ts';
import devicesCore from './devicesCore.ts';
import waiterPairingCore from './waiterPairingCore.ts';
import peripheralsCore from './peripheralsCore.ts';

const router = express.Router();

router.use('/', staffCore);
router.use('/', devicesCore);
router.use('/', waiterPairingCore);
router.use('/', peripheralsCore);

export default router;
