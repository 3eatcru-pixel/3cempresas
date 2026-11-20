import React, { ComponentType, LazyExoticComponent, lazy } from 'react';

export function isDynamicImportError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
      ? error
      : '';
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\d]+ failed|ChunkLoadError/i.test(
    message
  );
}

/**
 * Resilient wrapper around React.lazy that automatically retries transient
 * dynamic ESM import / chunk fetch failures before surfacing an error.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  baseDelayMs = 300
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await factory();
      } catch (err) {
        lastError = err;
        if (!isDynamicImportError(err) || attempt === retries) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)));
      }
    }
    throw lastError;
  });
}
