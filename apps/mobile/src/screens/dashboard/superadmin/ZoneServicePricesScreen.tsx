import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';
import { ENV } from '../../../config/environment';

type ZoneInfo = { id: string; name: string; key: string };
type CategoryInfo = { name: string; icon: string };
type ZonePrice = { price: number; varies: boolean };
type ServiceRow = { id: string; name: string; category?: string; prices: Record<string, Record<string, ZonePrice>> };
type PlanRow = { label: string; semi?: ZonePrice; full?: ZonePrice; other?: ZonePrice };
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

function priceText(cell?: ZonePrice) {
  if (!cell) return '—';
  return `${money(cell.price)}${cell.varies ? '  (workshops differ)' : ''}`;
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
      current && visibleCategories.some((item) => item.name === current)
        ? current
        : visibleCategories.find((item) => /periodic/i.test(item.name))?.name || visibleCategories[0].name
    ));
  }, [visibleCategories]);

  const plans = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const map = new Map<string, PlanRow>();
    if (!activeZone || !carClass || !category) return [];
    for (const service of services) {
      const serviceCategory = service.category || 'Other';
      if (serviceCategory !== category) continue;
      if (needle && !service.name.toLowerCase().includes(needle)) continue;
      const cell = service.prices?.[activeZone.id]?.[carClass];
      if (!cell) continue;
      const split = splitPlan(service.name);
      const row = map.get(split.label) || { label: split.label };
      row[split.group] = cell;
      map.set(split.label, row);
    }
    return [...map.values()].sort((a, b) => planRank(a.label) - planRank(b.label) || a.label.localeCompare(b.label));
  }, [services, activeZone, carClass, category, query]);

  const periodic = /periodic/i.test(category) && plans.some((row) => row.semi || row.full);
  const selectedClass = classMeta(carClass || 'HATCHBACK');

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
            {visibleCategories.map((item) => (
              <TouchableOpacity key={item.name} onPress={() => setCategory(item.name)} style={[styles.tile, category === item.name && styles.tileOn]}>
                <View style={styles.iconBox}>
                  {item.icon ? <Image source={{ uri: iconUrl(item.icon) }} style={styles.icon} /> : <Text style={styles.allMark}>{shortCategory(item.name).slice(0, 2)}</Text>}
                </View>
                <Text style={styles.tileText}>{shortCategory(item.name)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.resultTitle}>{shortCategory(category || 'Service')} · {selectedClass.label}</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search service" style={styles.input} />

          {periodic ? (
            <View style={styles.card}>
              <View style={styles.oilHead}>
                <Text style={[styles.oilCol, styles.oilName]}>Service</Text>
                <Text style={styles.oilCol}>Semi</Text>
                <Text style={styles.oilCol}>Fully</Text>
              </View>
              {plans.map((row) => (
                <View key={row.label} style={styles.oilRow}>
                  <Text style={[styles.oilName, styles.planName]}>{row.label}</Text>
                  <Text style={styles.oilPrice}>{priceText(row.semi)}</Text>
                  <Text style={styles.oilPrice}>{priceText(row.full)}</Text>
                </View>
              ))}
            </View>
          ) : plans.map((row) => (
            <View key={row.label} style={styles.priceRow}>
              <Text style={styles.service}>{row.label}</Text>
              <Text style={styles.price}>{priceText(row.semi || row.full || row.other)}</Text>
            </View>
          ))}
          {!plans.length ? <Text style={styles.note}>No price for {selectedClass.label} in {shortCategory(category || 'this service')}.</Text> : null}
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
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  service: { fontWeight: '800', color: '#0F172A', fontSize: 15, flexShrink: 1 },
  price: { color: '#0F172A', fontSize: 14, fontWeight: '700' },
  oilHead: { flexDirection: 'row', marginBottom: 8 },
  oilRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  oilCol: { flex: 1, fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' },
  oilName: { flex: 1.2 },
  planName: { fontSize: 13, fontWeight: '800', color: '#0F172A', textTransform: 'none' },
  oilPrice: { flex: 1, fontSize: 12, fontWeight: '700', color: '#0F172A' },
});
