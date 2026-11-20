import express from 'express';
import stripePublicAndHealthRoutes from './stripe/stripePublicAndHealthRoutes.ts';
import stripeOrderPaymentRoutes from './stripe/stripeOrderPaymentRoutes.ts';
import stripeConnectAndInvoicingRoutes from './stripe/stripeConnectAndInvoicingRoutes.ts';
import stripeBillingAndWebhookRoutes from './stripe/stripeBillingAndWebhookRoutes.ts';

const router = express.Router();

router.use('/', stripePublicAndHealthRoutes);
router.use('/', stripeOrderPaymentRoutes);
router.use('/', stripeConnectAndInvoicingRoutes);
router.use('/', stripeBillingAndWebhookRoutes);

export default router;
