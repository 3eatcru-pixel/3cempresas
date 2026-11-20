import express from 'express';
import { SqliteWalDriver } from '../../../src/server/persistence/SqliteWalDriver.ts';
import { EdgeNodeConfig } from '../helpers.ts';
import { EdgeSyncClient } from '../syncClient.ts';

export interface EdgeRouteContext {
  nodeId: string;
  storeId: string;
  tenantId: string;
  config: EdgeNodeConfig;
  driver: SqliteWalDriver;
  syncClient: EdgeSyncClient;
  authenticateEdge: express.RequestHandler;
  requireEdgeRoles: (roles: string[]) => express.RequestHandler;
}
