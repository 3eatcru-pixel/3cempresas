import { StorageAdapter } from './adapters/StorageAdapterTypes';
import { ServerCoreRESTAdapter } from './adapters/ServerCoreRESTAdapter';
import { StandaloneStorageAdapter } from './adapters/StandaloneStorageAdapter';

export type {
  CollectionFilter,
  SubscriptionCallback,
  UnsubscribeFn,
  StorageAdapter,
} from './adapters/StorageAdapterTypes';
export { StandaloneStorageAdapter } from './adapters/StandaloneStorageAdapter';
export { ServerCoreRESTAdapter } from './adapters/ServerCoreRESTAdapter';

/**
 * Adapter Manager & Factory
 * Permite que a aplicação troque de adaptador sem reescrever módulos
 */
export class DatabaseAdapterManager {
  private static instance: StorageAdapter = new ServerCoreRESTAdapter();

  static setAdapter(adapter: StorageAdapter) {
    this.instance = adapter;
  }

  static getAdapter(): StorageAdapter {
    if (!this.instance) {
      this.instance = new ServerCoreRESTAdapter();
    }
    return this.instance;
  }
}

export const storageAdapter = DatabaseAdapterManager.getAdapter();
export { StandaloneStorageAdapter as DefaultLocalAdapter };
