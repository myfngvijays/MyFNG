import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import type { PricingHit, WorkshopHit } from '../types';
import { ensureInvoiceForLead } from '@/lib/payments/chatInvoice';
import { createShortUrl } from '@/lib/services/urlShortener';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ADMIN_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return { db: null as any, error: 'Missing Supabase URL or service role key' };
  }

  const db = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { db, error: null as string | null };
}

export async function fetchNearestWorkshops(params: {
  lat: number;
  lng: number;
  radiiKm?: number[];
  limit?: number;
}): Promise<{ radiusKm: number; workshops: WorkshopHit[] }> {
  const radiiKm = params.radiiKm || [15, 50, 100, 200];
  const limit = Math.min(Math.max(params.limit || 5, 1), 5);
  const maxRadius = radiiKm[radiiKm.length - 1] || 200;
  // Guard against bogus coords (common: 0,0 or out-of-range), so UI doesn't show absurd distances.
  if (
    !Number.isFinite(params.lat) ||
    !Number.isFinite(params.lng) ||
    Math.abs(params.lat) > 90 ||
    Math.abs(params.lng) > 180 ||
    (Math.abs(params.lat) < 0.0001 && Math.abs(params.lng) < 0.0001)
  ) {
    return { radiusKm: maxRadius, workshops: [] };
  }

  const { db, error } = getSupabaseAdmin();
  if (!db) throw new Error(error || 'Supabase admin not configured');

  const { data, error: qErr } = await db
    .from('workshops')
    .select('id, name, address, short_address, latitude, longitude, map_link, is_verified')
    .eq('is_verified', true)
    .limit(200);
  if (qErr) throw new Error(qErr.message);

  const rows = (data as any[]) || [];
  const points = rows
    .map((w) => {
      const lat = Number(w?.latitude);
      const lng = Number(w?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const km = haversineKm(params.lat, params.lng, lat, lng);
      const fallbackMap = Number.isFinite(lat) && Number.isFinite(lng) ? `https://www.google.com/maps?q=${lat},${lng}` : null;
      return {
        id: String(w.id),
        name: String(w.name || 'Workshop'),
        address: w.short_address ? String(w.short_address) : w.address ? String(w.address) : null,
        mapLink: w.map_link ? String(w.map_link) : fallbackMap,
        // For now, use a safe default image; can be replaced with a DB column later.
        imageUrl: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=900',
        km,
      } satisfies WorkshopHit;
    })
    .filter(Boolean) as WorkshopHit[];

  points.sort((a, b) => (a.km ?? Number.POSITIVE_INFINITY) - (b.km ?? Number.POSITIVE_INFINITY));

  for (const r of radiiKm) {
    const list = points.filter((p) => typeof p.km === 'number' && p.km <= r).slice(0, limit);
    if (list.length > 0) return { radiusKm: r, workshops: list };
  }

  // If nothing is within the max radius, return empty.
  // (Prevents showing 1000km+ workshops while claiming "within 200 km".)
  return { radiusKm: maxRadius, workshops: [] };
}

export async function fetchWorkshopsByCityOrPincode(params: {
  cityOrArea?: string | null;
  pincode?: string | null;
  limit?: number;
}): Promise<WorkshopHit[]> {
  const cityOrArea = String(params.cityOrArea || '').trim();
  const pincode = String(params.pincode || '').replace(/\D/g, '').slice(0, 6);
  const limit = Math.min(Math.max(params.limit || 5, 1), 10);

  const { db, error } = getSupabaseAdmin();
  if (!db) throw new Error(error || 'Supabase admin not configured');

  let q = db
    .from('workshops')
    .select('id, name, address, short_address, city, service_pincode, latitude, longitude, map_link, is_verified')
    .eq('is_verified', true)
    .limit(200);

  // We want a reasonably small candidate set without requiring PostGIS.
  if (pincode.length >= 5) q = q.or(`service_pincode.eq.${pincode},pincode.eq.${pincode}`);
  if (cityOrArea.length >= 3) q = q.ilike('city', `%${cityOrArea}%`);

  const { data, error: qErr } = await q;
  if (qErr) throw new Error(qErr.message);

  const rows = (data as any[]) || [];
  const out = rows
    .map((w) => {
      const lat = Number(w?.latitude);
      const lng = Number(w?.longitude);
      const fallbackMap = Number.isFinite(lat) && Number.isFinite(lng) ? `https://www.google.com/maps?q=${lat},${lng}` : null;
      return {
        id: String(w.id),
        name: String(w.name || w.workshop_name || 'Workshop'),
        address: w.short_address ? String(w.short_address) : w.address ? String(w.address) : null,
        mapLink: w.map_link ? String(w.map_link) : fallbackMap,
        imageUrl: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=900',
        km: null,
      } satisfies WorkshopHit;
    })
    .slice(0, limit);

  return out;
}

export async function fetchPeriodicServicePricing(): Promise<PricingHit[]> {
  const { db, error } = getSupabaseAdmin();
  if (!db) throw new Error(error || 'Supabase admin not configured');

  const { data, error: qErr } = await db.from('service_packages').select('id, name, description, total_price').order('name');
  if (qErr) throw new Error(qErr.message);

  const rows = (data as any[]) || [];
  const keep = rows
    .filter((p) => /(basic|general|premium|platinum|interim)/i.test(String(p?.name || '')))
    .slice(0, 6)
    .map((p) => ({
      kind: 'PACKAGE' as const,
      id: String(p.id),
      name: String(p.name),
      price: p.total_price != null ? Number(p.total_price) : null,
      note: p.description ? String(p.description).slice(0, 120) : null,
    }));
  return keep;
}

export async function inferCityZoneFromText(params: { locationText?: string | null }) {
  const raw = String(params.locationText || '').trim();
  if (!raw) return null as null | { cityId: string; cityName: string; zoneId: string | null };

  const { db, error } = getSupabaseAdmin();
  if (!db) throw new Error(error || 'Supabase admin not configured');

  const tokens = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(-4)
    .flatMap((p) => p.replace(/[^a-zA-Z\s]/g, ' ').split(/\s+/))
    .map((w) => w.trim())
    .filter((w) => w.length >= 3)
    .sort((a, b) => b.length - a.length)
    .slice(0, 8);

  const seen = new Set<string>();
  const uniq = tokens.filter((t) => {
    const k = t.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  for (const token of uniq) {
    const { data } = await db
      .from('cities')
      .select('id, name, zone_id, is_active')
      .eq('is_active', true)
      .ilike('name', `%${token}%`)
      .limit(1);
    const row = (data || [])[0] as any;
    if (row?.id && row?.name) return { cityId: String(row.id), cityName: String(row.name), zoneId: row.zone_id ? String(row.zone_id) : null };
  }

  return null;
}

export async function fetchZoneWisePeriodicServicePricing(params: {
  locationText?: string | null;
  vehicleClass?: string | null; // DEFAULT or null => treated as null class
}): Promise<Array<PricingHit & { kind: 'SERVICE'; serviceTypeId: string }>> {
  const { db, error } = getSupabaseAdmin();
  if (!db) throw new Error(error || 'Supabase admin not configured');

  const cityZone = await inferCityZoneFromText({ locationText: params.locationText || null });
  const zoneId = cityZone?.zoneId || null;
  const cityName = cityZone?.cityName || null;
  const cityId = cityZone?.cityId || null;

  // 1) shortlist periodic package-like service types
  const { data: st } = await db.from('service_types').select('id, name').eq('is_active', true).order('name');
  const serviceTypes = ((st as any[]) || [])
    .filter((x) => /(basic|general|premium|platinum|interim)/i.test(String(x?.name || '')))
    .slice(0, 6)
    .map((x) => ({ id: String(x.id), name: String(x.name) }));

  if (serviceTypes.length === 0) return [];

  // 2) candidate workshops in zone/city (verified)
  let wq = db.from('workshops').select('id, city, zone_id, is_verified').eq('is_verified', true).limit(400);
  if (zoneId) wq = wq.eq('zone_id', zoneId);
  const { data: ws } = await wq;
  let workshops = ((ws as any[]) || []).map((w) => ({ id: String(w.id), city: String(w.city || '') }));
  if (cityName) workshops = workshops.filter((w) => w.city && w.city.toLowerCase() === cityName.toLowerCase());
  const workshopIds = workshops.map((w) => w.id).filter(Boolean);
  if (workshopIds.length === 0) return [];

  // 3) fetch pricing overrides for these workshops + service types (city > zone > default is DB policy; here we pick min available)
  let pq = db
    .from('workshop_service_pricing')
    .select('workshop_id, service_type_id, custom_price, zone_id, city_id, class')
    .in('workshop_id', workshopIds)
    .in(
      'service_type_id',
      serviceTypes.map((s) => s.id)
    );

  // City + zone filters: allow both specific and default rows, we'll score preference in code.
  if (zoneId) pq = pq.or(`zone_id.eq.${zoneId},zone_id.is.null`);
  if (cityId) pq = pq.or(`city_id.eq.${cityId},city_id.is.null`);

  const vehicleClass = params.vehicleClass && params.vehicleClass !== 'DEFAULT' ? params.vehicleClass : null;
  if (vehicleClass) pq = pq.or(`class.eq.${vehicleClass},class.is.null`);
  else pq = pq.is('class', null);

  const { data: pr } = await pq.limit(5000);
  const rows = (pr as any[]) || [];

  const rank = (r: any) => {
    const cityScore = cityId && r?.city_id === cityId ? 4 : 0;
    const zoneScore = zoneId && r?.zone_id === zoneId ? 2 : 0;
    const classScore = vehicleClass && r?.class === vehicleClass ? 1 : 0;
    return cityScore + zoneScore + classScore;
  };

  const bestByService = new Map<string, { price: number; score: number }>();
  for (const r of rows) {
    const sid = String(r?.service_type_id || '');
    const price = Number(r?.custom_price);
    if (!sid || !Number.isFinite(price) || price <= 0) continue;
    const score = rank(r);
    const prev = bestByService.get(sid);
    // prefer higher specificity; if tie, take cheaper
    if (!prev || score > prev.score || (score === prev.score && price < prev.price)) bestByService.set(sid, { price, score });
  }

  return serviceTypes.map((s) => ({
    kind: 'SERVICE' as const,
    serviceTypeId: s.id,
    id: s.id,
    name: s.name,
    price: bestByService.get(s.id)?.price ?? null,
    note: cityName ? `Area: ${cityName}${zoneId ? ' (zone-based)' : ''}` : zoneId ? 'Zone-based pricing' : null,
  }));
}

function ensureLeadNumber() {
  return `L-${Date.now().toString().slice(-8)}`;
}

export async function createServiceLead(params: {
  customerName?: string | null;
  customerPhone: string;
  vehicleNumber: string;
  vehicleModel?: string | null;
  serviceTypeLabel: string;
  pickupRequired: boolean;
  addressText?: string | null;
  lat?: number | null;
  lng?: number | null;
  problemDescription?: string | null;
}): Promise<{ leadId: string; leadNumber: string }> {
  const { db, error } = getSupabaseAdmin();
  if (!db) throw new Error(error || 'Supabase admin not configured');

  const now = new Date().toISOString();
  const payload: any = {
    lead_number: ensureLeadNumber(),
    lead_type: 'NORMAL',
    created_from: 'CHATBOT',
    status: 'NEW',

    customer_name: (params.customerName || 'Customer').slice(0, 80),
    customer_phone: String(params.customerPhone).replace(/\D/g, '').slice(-10),
    vehicle_number: String(params.vehicleNumber).toUpperCase().replace(/\s+/g, '').slice(0, 16),

    vehicle_model: params.vehicleModel ? String(params.vehicleModel).slice(0, 60) : null,
    service_type: params.serviceTypeLabel.slice(0, 80),

    pickup_required: Boolean(params.pickupRequired),

    address: params.addressText ? String(params.addressText).slice(0, 160) : null,
    customer_address: params.addressText ? String(params.addressText).slice(0, 160) : null,
    location_latitude: Number.isFinite(params.lat as number) ? Number(params.lat) : null,
    location_longitude: Number.isFinite(params.lng as number) ? Number(params.lng) : null,

    problem_description: params.problemDescription ? String(params.problemDescription).slice(0, 240) : null,
    created_at: now,
    updated_at: now,
  };

  const { data, error: insErr } = await db.from('service_leads').insert([payload]).select('id, lead_number').single();
  if (insErr) throw new Error(insErr.message);
  return { leadId: String((data as any).id), leadNumber: String((data as any).lead_number) };
}

export async function createBookingTokenPaymentLink(leadId: string): Promise<{ invoiceId: string; invoiceNumber: string; paymentLink: string }> {
  const invoice = await ensureInvoiceForLead({ leadId, purpose: 'BOOKING_TOKEN' });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const longUrl = `${appUrl}/invoice/${invoice.invoice_number}`;
  const short = await createShortUrl(longUrl, 'invoice', invoice.id);
  return { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number, paymentLink: short.shortUrl || longUrl };
}


