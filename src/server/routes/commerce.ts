import express from 'express';
import ordersCore from './commerce/ordersCore.ts';
import orderLifecycleCore from './commerce/orderLifecycleCore.ts';
import driversCore from './commerce/driversCore.ts';
import couponsCore from './commerce/couponsCore.ts';

const router = express.Router();

router.use('/', ordersCore);
router.use('/', orderLifecycleCore);
router.use('/', driversCore);
router.use('/', couponsCore);

export default router;
