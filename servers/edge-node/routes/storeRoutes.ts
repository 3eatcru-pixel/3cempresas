import express from 'express';
import { EdgeRouteContext } from './types.ts';
import { registerEdgeSystemAndMenuRoutes } from './store/edgeSystemAndMenuRoutes.ts';
import { registerEdgeTablesAndReservationsRoutes } from './store/edgeTablesAndReservationsRoutes.ts';
import { registerEdgeInventoryAndFinanceRoutes } from './store/edgeInventoryAndFinanceRoutes.ts';
import { registerEdgeWaiterAndCrmRoutes } from './store/edgeWaiterAndCrmRoutes.ts';
import { registerEdgePeripheralsAndPrintRoutes } from './store/edgePeripheralsAndPrintRoutes.ts';

export type { EdgeRouteContext } from './types.ts';

export function registerEdgeStoreRoutes(app: express.Express, ctx: EdgeRouteContext): void {
  registerEdgeSystemAndMenuRoutes(app, ctx);
  registerEdgeTablesAndReservationsRoutes(app, ctx);
  registerEdgeInventoryAndFinanceRoutes(app, ctx);
  registerEdgeWaiterAndCrmRoutes(app, ctx);
  registerEdgePeripheralsAndPrintRoutes(app, ctx);
}
