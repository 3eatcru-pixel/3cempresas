import express from 'express';
import { EdgeRouteContext } from './types.ts';
import { registerEdgeOrderCreateRoutes } from './commerce/edgeOrderCreateRoutes.ts';
import { registerEdgeOrderStatusRoutes } from './commerce/edgeOrderStatusRoutes.ts';
import { registerEdgeOrderPaymentAndSyncRoutes } from './commerce/edgeOrderPaymentAndSyncRoutes.ts';
import { registerEdgeOrderCancelAndReturnRoutes } from './commerce/edgeOrderCancelAndReturnRoutes.ts';

export function registerEdgeCommerceRoutes(app: express.Express, ctx: EdgeRouteContext): void {
  registerEdgeOrderCreateRoutes(app, ctx);
  registerEdgeOrderStatusRoutes(app, ctx);
  registerEdgeOrderPaymentAndSyncRoutes(app, ctx);
  registerEdgeOrderCancelAndReturnRoutes(app, ctx);
}
