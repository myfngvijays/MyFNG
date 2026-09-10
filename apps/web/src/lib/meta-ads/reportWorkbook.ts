import * as XLSX from 'xlsx';
import { flattenReportSheets } from './reportView';

function cellForExport(key: string, value: unknown) {
  if (value == null || value === '') return '';
  if (key === 'ctr') return Number(Number(value).toFixed(2));
  if (
    ['spend', 'results', 'leads', 'messaging', 'clicks', 'impressions', 'reach', 'cpc', 'cpm', 'cpr', 'cpl'].includes(
      key,
    )
  ) {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  return value;
}

export function reportToXlsxArrayBuffer(report: any): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const sheet of flattenReportSheets(report)) {
    if (sheet.name === '_meta') continue;
    const aoa = [
      sheet.columns.map((c) => c.label),
      ...sheet.rows.map((row) => sheet.columns.map((c) => cellForExport(c.key, row[c.key]))),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = sheet.columns.map((c) => ({ wch: Math.min(36, Math.max(c.label.length + 2, 12)) }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}
