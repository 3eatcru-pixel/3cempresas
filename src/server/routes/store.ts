import express from 'express';
import storesCore, { storePublicDetailRouter } from './store/storesCore.ts';
import catalogInventoryCore from './store/catalogInventoryCore.ts';
import tablesReservationsCore from './store/tablesReservationsCore.ts';
import crmCustomersCore from './store/crmCustomersCore.ts';
import financeCashCore from './store/financeCashCore.ts';
import staffDevicesCore from './store/staffDevicesCore.ts';
import whatsappConnectorCore from './store/whatsappConnectorCore.ts';
import marketplaceGrowthCore from './store/marketplaceGrowthCore.ts';

const router = express.Router();

router.use('/', storesCore);
router.use('/', catalogInventoryCore);
router.use('/', tablesReservationsCore);
router.use('/', crmCustomersCore);
router.use('/', financeCashCore);
router.use('/', staffDevicesCore);
router.use('/', whatsappConnectorCore);
router.use('/', marketplaceGrowthCore);

// Strictly mounted LAST so /:id never shadows /list, /menu, /tables, /inventory, /customers, /finance, /cash/*, /staff, /devices, /whatsapp/*, etc.
router.use('/', storePublicDetailRouter);

export default router;
