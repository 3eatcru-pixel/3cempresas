import express from 'express';
import governanceCore from './admin/governanceCore.ts';
import devicesIntegrationsCore from './admin/devicesIntegrationsCore.ts';
import usersCore from './admin/usersCore.ts';
import tenantsBillingCore from './admin/tenantsBillingCore.ts';
import backupRestoreCore from './admin/backupRestoreCore.ts';
import diagnosticsCore from './admin/diagnosticsCore.ts';

const router = express.Router();

router.use('/', governanceCore);
router.use('/', devicesIntegrationsCore);
router.use('/', usersCore);
router.use('/', tenantsBillingCore);
router.use('/', backupRestoreCore);
router.use('/', diagnosticsCore);

export default router;
