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

  const { db, error } = getSupabaseAdmin();
  if (!db) throw new Error(error || 'Supabase admin not configured');

  const { data, error: qErr } = await db
    .from('workshops')
    .select('id, name, address, latitude, longitude, map_link, is_verified')
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
      return {
        id: String(w.id),
        name: String(w.name || 'Workshop'),
        address: w.address ? String(w.address) : null,
        mapLink: w.map_link ? String(w.map_link) : null,
        km,
      } satisfies WorkshopHit;
    })
    .filter(Boolean) as WorkshopHit[];

  points.sort((a, b) => a.km - b.km);

  for (const r of radiiKm) {
    const list = points.filter((p) => p.km <= r).slice(0, limit);
    if (list.length > 0) return { radiusKm: r, workshops: list };
  }

  return { radiusKm: radiiKm[radiiKm.length - 1] || 200, workshops: points.slice(0, limit) };
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


