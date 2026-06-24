import { CATEGORY_LABELS, CTA_LABELS } from './config';
import { accuracyHint } from './engine';
import type { HealthReport, RcData } from './types';

function fmtDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(ts);
  }
}

export function buildHealthReportDocument(report: HealthReport, rc: RcData): string {
  const lines: string[] = [];
  const hr = '─'.repeat(52);

  lines.push('MYFNG SMART HEALTH CHECKUP REPORT');
  lines.push(hr);
  lines.push(`Vehicle: ${rc.make} ${rc.model} (${rc.regNumber})`);
  lines.push(`Fuel: ${rc.fuel} · Year: ${rc.registrationYear}`);
  lines.push(`Odometer: ${report.odometer.toLocaleString('en-IN')} km`);
  lines.push(`Generated: ${fmtDate(report.generatedAt)}`);
  lines.push('');
  lines.push(`VEHICLE RISK SCORE: ${report.composite}/100`);
  lines.push(`Status: ${report.band.label}`);
  lines.push(report.band.summary);
  lines.push('');

  lines.push('RISK DIMENSIONS');
  lines.push(hr);
  for (const d of report.dimensions) {
    lines.push(`${d.label}: ${d.score}/100 (${d.band})`);
  }
  lines.push('');

  lines.push('CATEGORY BREAKDOWN');
  lines.push(hr);
  for (const c of report.categories) {
    lines.push(`${CATEGORY_LABELS[c.category]}: ${c.score}/100 (${c.band})`);
    lines.push(`  ${c.reason}`);
  }
  lines.push('');

  const priority = report.recommendations.filter((r) => r.severity !== 'INFO' || r.category !== 'PREDICTIVE');
  if (priority.length) {
    lines.push('PRIORITY ACTIONS');
    lines.push(hr);
    for (const r of priority) {
      lines.push(`[${r.severity}] ${r.title}`);
      lines.push(`  ${r.reason}`);
      lines.push(`  CTA: ${CTA_LABELS[r.ctaType] || r.ctaType}`);
    }
    lines.push('');
  }

  const preventive = report.predictive.filter((p) => p.status === 'due_soon');
  if (preventive.length) {
    lines.push('COMING UP - PREVENTIVE');
    lines.push(hr);
    for (const p of preventive) {
      lines.push(`• ${p.item} (${p.status === 'overdue' ? 'Overdue' : 'Due soon'})`);
    }
    lines.push('Likely due based on age & km, not a detected fault.');
    lines.push('');
  }

  lines.push('REPORT ACCURACY');
  lines.push(hr);
  lines.push(`Level: ${report.accuracy}`);
  lines.push(accuracyHint(report.accuracy));
  lines.push('');
  lines.push('Book via MyFNG app for free pickup & drop.');
  lines.push(hr);

  return lines.join('\n');
}
