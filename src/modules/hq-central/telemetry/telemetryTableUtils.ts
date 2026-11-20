import { apiClient } from '../../../core/api/apiClient';
import { getPlatformAdapters } from '../../../core/platform/PlatformAdapter';

export type TableCategory = 'ALL' | 'GOVERNANCE' | 'COMMERCE' | 'FINANCE_STOCK' | 'HARDWARE_SYNC';

export type InspectorResponse = Awaited<ReturnType<typeof apiClient.inspectEcosystemTables>>;
export type IntegrityReportResponse = Awaited<ReturnType<typeof apiClient.runIntegrityAudit>>;

export const CATEGORY_LABELS: Record<TableCategory, string> = {
  ALL: 'Todas as Tabelas',
  GOVERNANCE: 'Governança & Contas',
  COMMERCE: 'Comércio & Loja',
  FINANCE_STOCK: 'Estoque & Finanças',
  HARDWARE_SYNC: 'Hardware, Edge & Sync',
};

export function summarizeRowRecord(tableName: string, row: Record<string, any>): {
  primaryLabel: string;
  secondaryLabel: string;
  statusBadge: string;
  scopeLabel: string;
  timestampLabel: string;
} {
  const id = String(row.id || row.uid || row.nodeId || row.code || '--');
  const primaryLabel = String(
    row.name ||
      row.title ||
      row.email ||
      row.code ||
      row.action ||
      row.type ||
      row.entity ||
      row.hostname ||
      id
  );
  const secondaryLabel = String(
    row.description ||
      row.category ||
      row.role ||
      row.channel ||
      row.paymentMethod ||
      row.payload ||
      row.reason ||
      row.provider ||
      row.slug ||
      tableName
  );
  const statusBadge = String(
    row.status ||
      row.tenantStatus ||
      row.saasPaymentStatus ||
      row.paymentStatus ||
      row.result ||
      (row.isOpen !== undefined ? (row.isOpen ? 'OPEN' : 'CLOSED') : '') ||
      (row.isActive !== undefined ? (row.isActive ? 'ACTIVE' : 'INACTIVE') : '') ||
      (row.paired !== undefined ? (row.paired ? 'PAIRED' : 'UNPAIRED') : 'OK')
  ).toUpperCase();

  const tenantPart = row.tenantId ? `T: ${row.tenantId}` : '';
  const storePart = row.storeId ? `S: ${row.storeId}` : '';
  const scopeLabel = [tenantPart, storePart].filter(Boolean).join(' • ') || 'Global / HQ';

  const rawTs =
    row.updatedAt ||
    row.createdAt ||
    row.timestamp ||
    row.detectedAt ||
    row.lastHeartbeatAt ||
    row.lastSync ||
    '';
  let timestampLabel = '--';
  if (rawTs) {
    const parsed = Date.parse(String(rawTs));
    timestampLabel = Number.isFinite(parsed)
      ? new Date(parsed).toLocaleString('pt-BR')
      : String(rawTs).slice(0, 19);
  }

  return {
    primaryLabel,
    secondaryLabel,
    statusBadge,
    scopeLabel,
    timestampLabel,
  };
}

export function exportInspectorTableJson(
  inspectorData: InspectorResponse,
  showNotification: (msg: string) => void
): void {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  getPlatformAdapters().links.downloadTextFile(
    `3C_TBL_${inspectorData.selectedTable.toUpperCase()}_${dateStr}.json`,
    JSON.stringify(
      {
        exportedAt: inspectorData.inspectedAt,
        table: inspectorData.selectedTable,
        totalRows: inspectorData.totalRows,
        rows: inspectorData.rows,
      },
      null,
      2
    ),
    'application/json;charset=utf-8'
  );
  showNotification(`Tabela "${inspectorData.selectedTable}" exportada em JSON!`);
}

export function exportInspectorTableCsv(
  inspectorData: InspectorResponse | null,
  showNotification: (msg: string) => void
): void {
  if (!inspectorData || inspectorData.rows.length === 0) {
    showNotification('Nenhum registro para exportar em CSV.');
    return;
  }
  const allKeys = Array.from(
    new Set(inspectorData.rows.flatMap((r) => Object.keys(r || {})).slice(0, 18))
  );
  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };
  const header = allKeys.join(',');
  const lines = inspectorData.rows.map((r) => allKeys.map((k) => escapeCsv(r[k])).join(','));
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  getPlatformAdapters().links.downloadTextFile(
    `3C_TBL_${inspectorData.selectedTable.toUpperCase()}_${dateStr}.csv`,
    [header, ...lines].join('\n'),
    'text/csv;charset=utf-8'
  );
  showNotification(`Tabela "${inspectorData.selectedTable}" exportada em CSV!`);
}
