import express from 'express';
import orderStatusRoutes from './orderStatusRoutes.ts';
import orderRefundRoutes from './orderRefundRoutes.ts';

const router = express.Router();

router.use('/', orderStatusRoutes);
router.use('/', orderRefundRoutes);

export default router;
