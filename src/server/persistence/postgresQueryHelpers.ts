export interface StoreDocumentQueryFilter {
  storeId?: string;
  tenantId?: string;
  status?: string;
  sinceHlc?: string;
  limit?: number;
  offset?: number;
}

export function buildStoreDocumentsQuerySql(
  collection: string,
  filter: StoreDocumentQueryFilter
): { sql: string; params: any[] } {
  const clauses: string[] = ['collection_name = $1'];
  const params: any[] = [collection];
  let idx = 2;

  if (filter.tenantId) {
    clauses.push(`tenant_id = $${idx++}`);
    params.push(filter.tenantId);
  }
  if (filter.storeId) {
    clauses.push(`store_id = $${idx++}`);
    params.push(filter.storeId);
  }
  if (filter.status) {
    clauses.push(`(data->>'status') = $${idx++}`);
    params.push(filter.status);
  }
  if (filter.sinceHlc) {
    clauses.push(`hlc > $${idx++}`);
    params.push(filter.sinceHlc);
  }

  let sql = `SELECT data FROM store_documents WHERE ${clauses.join(' AND ')}`;
  if (filter.sinceHlc) {
    sql += ' ORDER BY hlc ASC';
  }
  if (typeof filter.limit === 'number' && Number.isFinite(filter.limit) && filter.limit > 0) {
    sql += ` LIMIT $${idx++}`;
    params.push(Math.min(5000, Math.floor(filter.limit)));
  }
  if (typeof filter.offset === 'number' && Number.isFinite(filter.offset) && filter.offset > 0) {
    sql += ` OFFSET $${idx++}`;
    params.push(Math.floor(filter.offset));
  }

  return { sql, params };
}
