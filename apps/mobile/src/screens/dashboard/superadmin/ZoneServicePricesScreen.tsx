import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Image, Alert, Share, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';
import { ENV } from '../../../config/environment';

type ZoneInfo = { id: string; name: string; key: string };
type CategoryInfo = { name: string; icon: string };
type ZonePrice = { price: number; varies: boolean };
type ServiceRow = { id: string; name: string; category?: string; prices: Record<string, Record<string, ZonePrice>> };
type PlanRow = { label: string; semi?: ZonePrice; full?: ZonePrice; other?: ZonePrice };
type PriceSection = { name: string; periodic: boolean; plans: PlanRow[] };
const SHOW_ALL = '__all__';
type CarHit = { id: string; make: string; model: string; variant: string | null; vehicleClass: string | null };

function shortCategory(name: string) {
  return name.replace(/^car\s+/i, '').replace(/\s+service$/i, '').trim() || name;
}

function zoneLabel(zone: ZoneInfo) {
  return zone.key === 'prime' ? 'Prime zone' : 'Urban zone';
}

function iconUrl(path: string) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(ENV.API_URL || '').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function money(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function matchClassName(value: string | null, choices: string[]) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const exact = choices.find((name) => name.toLowerCase() === raw);
  if (exact) return exact;
  if (raw === 'sedan' || raw === 'sedans') return choices.find((name) => name.toUpperCase() === 'SEDANS') || '';
  return choices.find((name) => name.toLowerCase().includes(raw) || raw.includes(name.toLowerCase())) || '';
}

function classMeta(name: string): { label: string; image: string } {
  const key = name.toUpperCase();
  if (key.includes('LUXURY')) return { label: 'Luxury', image: '/media/car-classes/luxury.png' };
  if (key.includes('COMPACT')) return { label: 'Compact SUV', image: '/media/car-classes/compact-suv.png' };
  if (key.includes('HATCH') && key.includes('PREMIUM')) return { label: 'Premium Hatchback', image: '/media/car-classes/premium-hatchback.png' };
  if (key.includes('HATCH')) return { label: 'Hatchback', image: '/media/car-classes/hatchback.png' };
  if (key.includes('SUV') || key.includes('MUV')) {
    return {
      label: key.includes('PREMIUM') ? 'Premium SUV' : 'SUV / MUV',
      image: key.includes('PREMIUM') ? '/media/car-classes/premium-suv.png' : '/media/car-classes/suv-muv.png',
    };
  }
  if (key.includes('SEDAN')) return { label: 'Sedan', image: '/media/car-classes/sedan.png' };
  return { label: name === 'DEFAULT' ? 'All classes' : name, image: '/media/car-classes/sedan.png' };
}

function planRank(label: string) {
  const key = label.toLowerCase();
  if (key.startsWith('basic')) return 0;
  if (key.startsWith('standard')) return 1;
  if (key.startsWith('general')) return 2;
  if (key.startsWith('premium')) return 3;
  return 4;
}

function splitPlan(name: string) {
  const semi = /semi\s*synthetic/i.test(name);
  const full = /fully\s*synthetic/i.test(name);
  const label = name.replace(/\s*\((semi|fully)\s*synthetic\)/i, '').trim() || name;
  return { group: semi ? 'semi' as const : full ? 'full' as const : 'other' as const, label };
}

function PriceText({ cell, style }: { cell?: ZonePrice; style: any }) {
  if (!cell) return <Text style={style}>—</Text>;
  return <Text style={[style, cell.varies && styles.priceVaries]} numberOfLines={1}>{money(cell.price)}</Text>;
}

type ExportLine = {
  zone: string;
  zoneKey: string;
  carClass: string;
  category: string;
  service: string;
  semi?: ZonePrice;
  full?: ZonePrice;
  other?: ZonePrice;
};

const EXPORT_HEADERS = ['Zone', 'Car class', 'Category', 'Service', 'Semi Synthetic (INR)', 'Fully Synthetic (INR)', 'Price (INR)', 'Note'];

function exportAmount(cell?: ZonePrice) {
  return cell ? Math.round(cell.price) : '';
}

function exportNote(line: ExportLine) {
  const parts: string[] = [];
  if (line.semi?.varies) parts.push('Semi: workshops differ');
  if (line.full?.varies) parts.push('Fully: workshops differ');
  if (line.other?.varies) parts.push('workshops differ');
  return parts.join('; ');
}

function exportCells(line: ExportLine): Array<string | number> {
  return [line.zone, line.carClass, line.category, line.service, exportAmount(line.semi), exportAmount(line.full), exportAmount(line.other), exportNote(line)];
}

function csvEscape(value: string | number) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function xmlEscape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function excelXml(rows: Array<Array<string | number>>) {
  const cells = rows.map((row) => `<Row>${row.map((value) => (
    typeof value === 'number'
      ? `<Cell><Data ss:Type="Number">${value}</Data></Cell>`
      : `<Cell><Data ss:Type="String">${xmlEscape(String(value))}</Data></Cell>`
  )).join('')}</Row>`).join('');
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Zone prices"><Table>${cells}</Table></Worksheet>
</Workbook>`;
}

function asciiBase64(text: string) {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i) & 0xff;
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return globalThis.btoa(binary);
}

function buildPdf(title: string, lines: string[]) {
  const pageWidth = 842;
  const pageHeight = 595;
  const fontSize = 8;
  const leading = 11;
  const margin = 28;
  const capacity = Math.max(8, Math.floor((pageHeight - margin * 2) / leading));
  const pages: string[][] = [];
  const all = [title, ''].concat(lines);
  for (let i = 0; i < all.length; i += capacity) pages.push(all.slice(i, i + capacity));
  if (!pages.length) pages.push(['No rows']);
  const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, ' ');
  const streams = pages.map((pageLines) => pageLines.map((line, index) => {
    const y = pageHeight - margin - index * leading;
    return `BT /F1 ${fontSize} Tf ${margin} ${y} Td (${escape(line)}) Tj ET`;
  }).join('\n'));
  const fontId = 3 + pages.length * 2;
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  streams.forEach((stream, index) => {
    const pageId = 3 + index * 2;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${pageId + 1} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`;
    objects[pageId + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id <= fontId; id += 1) {
    offsets[id] = body.length;
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = body.length;
  body += `xref\n0 ${fontId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= fontId; id += 1) body += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${fontId + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return body;
}

async function shareExportFile(filename: string, contents: string, encoding: 'utf8' | 'base64') {
  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!dir) {
    await Share.share({ message: contents.slice(0, 90000), title: filename });
    return;
  }
  const path = `${dir}${filename}`;
  if (encoding === 'base64') {
    await FileSystem.writeAsStringAsync(path, contents, { encoding: FileSystem.EncodingType.Base64 });
  } else {
    await FileSystem.writeAsStringAsync(path, contents);
  }
  let url = path;
  if (Platform.OS === 'android' && typeof (FileSystem as any).getContentUriAsync === 'function') {
    url = await (FileSystem as any).getContentUriAsync(path);
  }
  await Share.share({ url, title: filename, message: filename });
}

export default function ZoneServicePricesScreen({ navigation }: any) {
  const [zones, setZones] = useState<ZoneInfo[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [carClass, setCarClass] = useState('');
  const [category, setCategory] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  const [modelHits, setModelHits] = useState<CarHit[]>([]);
  const [exporting, setExporting] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiFetch<any>('/api/super_admin/inventory/zone-prices');
      const nextZones: ZoneInfo[] = json?.zones || [];
      setZones(nextZones);
      setClasses(json?.classes || []);
      setCategories(json?.categories || []);
      setServices(json?.services || []);
      setZoneId((current) => (
        current && nextZones.some((zone) => zone.id === current)
          ? current
          : nextZones.find((zone) => zone.key === 'prime')?.id || nextZones[0]?.id || ''
      ));
      setNote(nextZones.length ? '' : `Zones on file: ${(json?.available_zones || []).join(', ') || 'none'}`);
    } catch (error: any) {
      setNote(error?.message || 'Could not load zone prices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const classChoices = useMemo(() => classes.filter((name) => name !== 'DEFAULT'), [classes]);

  useEffect(() => {
    const q = modelQuery.trim();
    if (q.length < 2) {
      setModelHits([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${String(ENV.API_URL || '').replace(/\/$/, '')}/api/car-models/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (cancelled) return;
        const models = Array.isArray(json?.models) ? json.models : [];
        setModelHits(models.map((car: any) => ({
          id: String(car.id),
          make: String(car.make || ''),
          model: String(car.model || ''),
          variant: car.variant ? String(car.variant) : null,
          vehicleClass: car.vehicleClass ?? car.class ?? null,
        })));
      } catch {
        if (!cancelled) setModelHits([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [modelQuery]);

  const pickModel = (car: CarHit) => {
    setModelQuery([car.make, car.model].filter(Boolean).join(' '));
    setModelHits([]);
    const matched = matchClassName(car.vehicleClass, classChoices);
    if (matched) setCarClass(matched);
    else setNote(car.vehicleClass ? `No price class for ${car.vehicleClass}` : 'This car has no class');
  };

  useEffect(() => {
    if (!classChoices.length) return;
    setCarClass((current) => (
      current && classChoices.includes(current)
        ? current
        : classChoices.find((name) => name === 'HATCHBACK') || classChoices[0]
    ));
  }, [classChoices]);

  const activeZone = zones.find((zone) => zone.id === zoneId) || zones[0];

  const visibleCategories = useMemo(() => {
    if (!activeZone || !carClass) return categories;
    return categories.filter((item) => services.some((service) => (
      (service.category || 'Other') === item.name && service.prices?.[activeZone.id]?.[carClass]
    )));
  }, [categories, services, activeZone, carClass]);

  useEffect(() => {
    if (!visibleCategories.length) return;
    setCategory((current) => (
      current === SHOW_ALL || (current && visibleCategories.some((item) => item.name === current))
        ? current
        : visibleCategories.find((item) => /periodic/i.test(item.name))?.name || visibleCategories[0].name
    ));
  }, [visibleCategories]);

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!activeZone || !carClass) return [] as PriceSection[];
    const names = category === SHOW_ALL
      ? visibleCategories.map((item) => item.name)
      : category ? [category] : [];
    const next: PriceSection[] = [];
    for (const name of names) {
      const map = new Map<string, PlanRow>();
      for (const service of services) {
        if ((service.category || 'Other') !== name) continue;
        if (needle && !service.name.toLowerCase().includes(needle) && !(service.category || '').toLowerCase().includes(needle)) continue;
        const cell = service.prices?.[activeZone.id]?.[carClass];
        if (!cell) continue;
        const split = splitPlan(service.name);
        const row = map.get(split.label) || { label: split.label };
        row[split.group] = cell;
        map.set(split.label, row);
      }
      const plans = [...map.values()].sort((a, b) => planRank(a.label) - planRank(b.label) || a.label.localeCompare(b.label));
      if (!plans.length) continue;
      next.push({
        name,
        periodic: /periodic/i.test(name) && plans.some((row) => row.semi || row.full),
        plans,
      });
    }
    return next;
  }, [services, activeZone, carClass, category, query, visibleCategories]);

  const showAll = category === SHOW_ALL;
  const categoryLabel = showAll ? 'All services' : shortCategory(category || 'Service');
  const selectedClass = classMeta(carClass || 'HATCHBACK');

  const buildExportLines = (scope: 'selection' | 'all') => {
    const zoneList = scope === 'all' ? zones : activeZone ? [activeZone] : [];
    const classList = (scope === 'all' ? classChoices : carClass ? [carClass] : []).filter((name) => name !== 'DEFAULT');
    const categoryName = scope === 'selection' && category && category !== SHOW_ALL ? category : '';
    const needle = scope === 'selection' ? query.trim().toLowerCase() : '';
    const map = new Map<string, ExportLine>();
    for (const service of services) {
      const serviceCategory = service.category || 'Other';
      if (categoryName && serviceCategory !== categoryName) continue;
      if (needle && !service.name.toLowerCase().includes(needle) && !serviceCategory.toLowerCase().includes(needle)) continue;
      const split = splitPlan(service.name);
      for (const zone of zoneList) {
        for (const cls of classList) {
          const cell = service.prices?.[zone.id]?.[cls];
          if (!cell) continue;
          const key = `${zone.id}|${cls}|${serviceCategory}|${split.label}`;
          const row = map.get(key) || {
            zone: zoneLabel(zone),
            zoneKey: zone.key,
            carClass: classMeta(cls).label,
            category: shortCategory(serviceCategory),
            service: split.label,
          };
          row[split.group] = cell;
          map.set(key, row);
        }
      }
    }
    const categoryRank = (name: string) => {
      const index = categories.findIndex((item) => shortCategory(item.name) === name);
      return index < 0 ? 99 : index;
    };
    const classRank = (label: string) => classChoices.findIndex((name) => classMeta(name).label === label);
    return [...map.values()].sort((a, b) =>
      (a.zoneKey === 'prime' ? 0 : 1) - (b.zoneKey === 'prime' ? 0 : 1)
      || (classRank(a.carClass) < 0 ? 99 : classRank(a.carClass)) - (classRank(b.carClass) < 0 ? 99 : classRank(b.carClass))
      || categoryRank(a.category) - categoryRank(b.category)
      || planRank(a.service) - planRank(b.service)
      || a.service.localeCompare(b.service),
    );
  };

  const runExport = async (scope: 'selection' | 'all', format: 'csv' | 'xlsx' | 'pdf') => {
    const lines = buildExportLines(scope);
    if (!lines.length) {
      Alert.alert('Export', scope === 'selection' ? 'Nothing to export for this selection.' : 'No zone prices to export.');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const selectionName = [activeZone ? zoneLabel(activeZone) : 'zone', selectedClass.label, categoryLabel].join(' ');
    const filenameBase = `zone-prices-${scope === 'all' ? 'all' : selectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${stamp}`;
    const rows = lines.map(exportCells);
    setExporting(`${scope}-${format}`);
    try {
      if (format === 'csv') {
        const body = [EXPORT_HEADERS, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
        await shareExportFile(`${filenameBase}.csv`, `\uFEFF${body}\n`, 'utf8');
      } else if (format === 'xlsx') {
        await shareExportFile(`${filenameBase}.xls`, excelXml([EXPORT_HEADERS, ...rows]), 'utf8');
      } else {
        const pad = (value: string | number, width: number) => {
          const text = String(value ?? '');
          return (text.length > width ? text.slice(0, width - 1) : text).padEnd(width, ' ');
        };
        const textLines = [
          EXPORT_HEADERS.map((header, index) => pad(header, [16, 18, 16, 24, 12, 12, 10, 18][index])).join(' '),
          ...rows.map((row) => [16, 18, 16, 24, 12, 12, 10, 18].map((width, index) => pad(row[index], width)).join(' ')),
        ];
        const title = scope === 'all' ? 'Zone prices - all zones, classes and services' : `Zone prices - ${selectionName}`;
        await shareExportFile(`${filenameBase}.pdf`, asciiBase64(buildPdf(title, textLines)), 'base64');
      }
    } catch (error: any) {
      Alert.alert('Export', error?.message || 'Could not export');
    } finally {
      setExporting('');
    }
  };

  return (
    <View style={styles.screen}>
      <DashboardHeader title="Zone Prices" onBack={() => navigation?.goBack?.()} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {note ? <Text style={styles.note}>{note}</Text> : null}
          <Text style={styles.step}>Zone</Text>
          <View style={styles.zoneRow}>
            {zones.map((zone) => {
              const selected = activeZone?.id === zone.id;
              return (
                <TouchableOpacity key={zone.id} onPress={() => setZoneId(zone.id)} style={[styles.zoneBtn, selected && styles.zoneBtnOn]}>
                  <Text style={[styles.zoneName, selected && styles.zoneNameOn]}>{zoneLabel(zone)}</Text>
                </TouchableOpacity>
              );
            })}
            <TextInput
              value={modelQuery}
              onChangeText={setModelQuery}
              placeholder="Rapid, Swift..."
              style={styles.modelInput}
            />
          </View>
          {modelHits.map((car) => (
            <TouchableOpacity key={`${car.id}-${car.variant || ''}`} onPress={() => pickModel(car)} style={styles.modelHit}>
              <Text style={styles.modelHitTitle}>{car.make} {car.model}{car.variant ? ` (${car.variant})` : ''}</Text>
              <Text style={styles.modelHitClass}>{car.vehicleClass || 'Class not set'}</Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.step}>Car class</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
            {classChoices.map((name) => {
              const meta = classMeta(name);
              const selected = carClass === name;
              return (
                <TouchableOpacity key={name} onPress={() => setCarClass(name)} style={[styles.classTile, selected && styles.classTileOn]}>
                  <Image source={{ uri: iconUrl(meta.image) }} style={styles.classPhoto} />
                  <Text style={styles.classLabel}>{meta.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.step}>Service</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
            <TouchableOpacity onPress={() => setCategory(SHOW_ALL)} style={[styles.tile, showAll && styles.tileOn]}>
              <View style={styles.iconBox}>
                <Text style={styles.allMark}>All</Text>
              </View>
              <Text style={styles.tileText}>Show all</Text>
            </TouchableOpacity>
            {visibleCategories.map((item) => (
              <TouchableOpacity key={item.name} onPress={() => setCategory(item.name)} style={[styles.tile, category === item.name && styles.tileOn]}>
                <View style={styles.iconBox}>
                  {item.icon ? <Image source={{ uri: iconUrl(item.icon) }} style={styles.icon} /> : <Text style={styles.allMark}>{shortCategory(item.name).slice(0, 2)}</Text>}
                </View>
                <Text style={styles.tileText}>{shortCategory(item.name)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.resultTitle}>{categoryLabel} · {selectedClass.label}</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search service" style={styles.input} />
          <View style={styles.exportBox}>
            <Text style={styles.exportLabel}>Export this selection</Text>
            <View style={styles.exportRow}>
              {(['csv', 'xlsx', 'pdf'] as const).map((format) => (
                <TouchableOpacity key={`selection-${format}`} disabled={!!exporting} onPress={() => void runExport('selection', format)} style={styles.exportBtn}>
                  <Text style={styles.exportBtnText}>{exporting === `selection-${format}` ? '...' : format === 'xlsx' ? 'Excel' : format.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.exportLabel}>Export everything</Text>
            <View style={styles.exportRow}>
              {(['csv', 'xlsx', 'pdf'] as const).map((format) => (
                <TouchableOpacity key={`all-${format}`} disabled={!!exporting} onPress={() => void runExport('all', format)} style={[styles.exportBtn, styles.exportBtnLight]}>
                  <Text style={[styles.exportBtnText, styles.exportBtnTextDark]}>{exporting === `all-${format}` ? '...' : format === 'xlsx' ? 'Excel' : format.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {sections.length === 0 ? <Text style={styles.note}>No price for {selectedClass.label} in {categoryLabel}.</Text> : sections.map((section) => (
            <View key={section.name} style={styles.section}>
              {showAll && !section.periodic ? <Text style={styles.sectionTitle}>{shortCategory(section.name)}</Text> : null}
              {section.periodic ? (
                <View style={styles.card}>
                  <View style={styles.oilHead}>
                    <Text style={[styles.oilCol, styles.oilName]}>{showAll ? shortCategory(section.name) : 'Service'}</Text>
                    <Text style={styles.oilCol}>Semi</Text>
                    <Text style={styles.oilCol}>Fully</Text>
                  </View>
                  {section.plans.map((row) => (
                    <View key={row.label} style={styles.oilRow}>
                      <Text style={[styles.oilName, styles.planName]} numberOfLines={1}>{row.label}</Text>
                      <PriceText cell={row.semi} style={styles.oilPrice} />
                      <PriceText cell={row.full} style={styles.oilPrice} />
                    </View>
                  ))}
                </View>
              ) : section.plans.map((row) => (
                <View key={row.label} style={styles.priceRow}>
                  <Text style={styles.service} numberOfLines={1}>{row.label}</Text>
                  <PriceText cell={row.semi || row.full || row.other} style={styles.price} />
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  body: { padding: SPACING.md, paddingBottom: 40 },
  step: { color: '#64748B', fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  note: { color: '#92400E', fontSize: 13, marginBottom: 10 },
  zoneRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  zoneBtn: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff', padding: 14 },
  zoneBtnOn: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  zoneName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  zoneNameOn: { color: '#fff' },
  modelInput: { width: 130, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 10, fontSize: 13 },
  modelHit: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6 },
  modelHitTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  modelHitClass: { fontSize: 12, color: '#64748B', marginTop: 2 },
  tiles: { gap: 8, paddingBottom: 8 },
  classTile: { width: 120, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center' },
  classTileOn: { borderColor: '#1D4ED8', borderWidth: 2 },
  classPhoto: { width: 108, height: 64, resizeMode: 'contain' },
  classLabel: { marginTop: 2, fontSize: 11, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  tile: { width: 92, borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff', padding: 10, alignItems: 'center' },
  tileOn: { borderColor: '#93C5FD', borderWidth: 2 },
  iconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  icon: { width: 32, height: 32, resizeMode: 'contain' },
  allMark: { fontSize: 12, fontWeight: '800', color: '#1D4ED8' },
  tileText: { marginTop: 6, fontSize: 11, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  resultTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  section: { marginBottom: 12 },
  sectionTitle: { color: '#64748B', fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  exportBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, marginBottom: 10 },
  exportLabel: { color: '#64748B', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 },
  exportRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  exportBtn: { backgroundColor: '#0F172A', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  exportBtnLight: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#CBD5E1' },
  exportBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  exportBtnTextDark: { color: '#0F172A' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  service: { fontWeight: '700', color: '#0F172A', fontSize: 12, flexShrink: 1 },
  price: { color: '#0F172A', fontSize: 12, fontWeight: '700' },
  priceVaries: { color: '#EA580C' },
  oilHead: { flexDirection: 'row', marginBottom: 8 },
  oilRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  oilCol: { flex: 1, fontSize: 12, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' },
  oilName: { flex: 1.2 },
  planName: { fontSize: 12, fontWeight: '700', color: '#0F172A', textTransform: 'none' },
  oilPrice: { flex: 1, fontSize: 12, fontWeight: '700', color: '#0F172A' },
});
