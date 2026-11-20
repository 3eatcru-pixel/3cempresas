import type express from 'express';

export const RESERVED_PAGINATION_QUERY_KEYS = new Set([
  'limit',
  'offset',
  'cursor',
  'sortBy',
  'sortDir',
  'envelope',
]);

const FORBIDDEN_SORT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export interface ParsedPaginationParams {
  limit?: number;
  offset: number;
  cursor?: string;
  sortBy?: string;
  sortDir: 'asc' | 'desc';
  envelope: boolean;
  isPaginatedRequest: boolean;
}

export interface PaginatedSliceResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export function parsePaginationParams(
  query: Record<string, any>,
  options?: { maxLimit?: number }
): ParsedPaginationParams {
  const maxLimit = options?.maxLimit ?? 1000;

  let limit: number | undefined;
  if (query.limit !== undefined && query.limit !== '') {
    const parsed = Number.parseInt(String(query.limit), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(maxLimit, parsed);
    }
  }

  let offset = 0;
  if (query.offset !== undefined && query.offset !== '') {
    const parsed = Number.parseInt(String(query.offset), 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      offset = parsed;
    }
  }

  const rawCursor = typeof query.cursor === 'string' ? query.cursor.trim() : '';
  const cursor = rawCursor.length > 0 ? rawCursor : undefined;

  const rawSortBy = typeof query.sortBy === 'string' ? query.sortBy.trim() : '';
  const sortBy = rawSortBy && !FORBIDDEN_SORT_KEYS.has(rawSortBy) ? rawSortBy : undefined;
  const sortDir: 'asc' | 'desc' = String(query.sortDir || '').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const envelope = query.envelope === 'true' || query.envelope === '1';

  return {
    limit,
    offset,
    cursor,
    sortBy,
    sortDir,
    envelope,
    isPaginatedRequest: limit !== undefined || offset > 0 || cursor !== undefined || envelope,
  };
}

export function applyPaginationAndHeaders<T extends Record<string, any>>(
  res: express.Response,
  items: T[],
  params: ParsedPaginationParams,
  getId: (item: T) => string
): PaginatedSliceResult<T> {
  let working = items;

  if (params.sortBy) {
    const field = params.sortBy;
    const dir = params.sortDir === 'asc' ? 1 : -1;
    working = [...items].sort((a, b) => {
      const av = a?.[field];
      const bv = b?.[field];
      if (av === bv) return getId(a).localeCompare(getId(b)) * dir;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  const total = working.length;
  let startIndex = params.offset;

  if (params.cursor) {
    const cursorIdx = working.findIndex((item) => getId(item) === params.cursor);
    startIndex = cursorIdx >= 0 ? cursorIdx + 1 : total;
  }

  const endIndex = params.limit !== undefined ? Math.min(total, startIndex + params.limit) : total;
  const pageItems = startIndex < total ? working.slice(startIndex, endIndex) : [];
  const hasMore = endIndex < total;
  const nextCursor = hasMore && pageItems.length > 0 ? getId(pageItems[pageItems.length - 1]) : null;

  res.setHeader('X-Total-Count', String(total));
  res.setHeader('X-Has-More', hasMore ? 'true' : 'false');
  if (params.limit !== undefined) {
    res.setHeader('X-Limit', String(params.limit));
  }
  if (startIndex > 0) {
    res.setHeader('X-Offset', String(startIndex));
  }
  if (nextCursor) {
    res.setHeader('X-Next-Cursor', nextCursor);
  }

  return {
    items: pageItems,
    total,
    limit: params.limit ?? total,
    offset: startIndex,
    hasMore,
    nextCursor,
  };
}
