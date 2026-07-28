'use client';

import { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link2,
  ExternalLink,
  Zap,
  Activity,
  Smartphone,
  Apple,
  Users,
  Globe,
  Sparkles,
  ChevronDown,
  MapPin,
  Crown,
  UserPlus,
  Hash,
  Upload,
  FileSpreadsheet,
  X,
  Wrench,
  Car,
  UserCheck,
  Ticket,
  Wallet,
  ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import NotificationLivePreview, { TYPE_DOT } from '../components/NotificationLivePreview';
import PushMediaUploadField from '../components/PushMediaUploadField';
import TemplatePicker from '../components/TemplatePicker';

type PlatformChoice = 'both' | 'android' | 'ios';
type AudienceChoice = 'all' | 'android' | 'ios';
type NotificationType = 'promotional' | 'transactional' | 'reminder' | 'system';

const TITLE_MAX = 60;
const MESSAGE_MAX = 200;

function FieldCounter({ current, max }: { current: number; max: number }) {
  return (
    <span className={`text-xs ${current >= max ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
      {current}/{max}
    </span>
  );
}

function SelectCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button type="button" onClick={onClick} className={`push-select-card ${active ? 'active' : ''}`}>
      <div className="flex items-center gap-2.5">
        <div className="push-select-icon">{icon}</div>
        <div className="min-w-0 text-left">
          <p className="font-semibold text-[13px] text-gray-900 leading-tight">{title}</p>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug truncate">{subtitle}</p>
        </div>
      </div>
    </button>
  );
}

const COLOR_MAP: Record<string, { active: string; chip: string }> = {
  blue: { active: 'bg-blue-600 border-blue-600 text-white', chip: 'bg-blue-100 text-blue-700' },
  emerald: { active: 'bg-emerald-600 border-emerald-600 text-white', chip: 'bg-emerald-100 text-emerald-700' },
  orange: { active: 'bg-orange-500 border-orange-500 text-white', chip: 'bg-orange-100 text-orange-700' },
};

function DropdownMulti({
  label, icon, items, selected, onToggle, color,
}: {
  label: string; icon: React.ReactNode; items: string[]; selected: string[]; onToggle: (v: string) => void; color: string;
}) {
  const [open, setOpen] = useState(false);
  const colors = COLOR_MAP[color] || COLOR_MAP.blue;
  return (
    <div className="space-y-1.5 relative">
      <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5">{icon} {label}</label>
      <button type="button" onClick={() => setOpen((v) => !v)} className="push-input bg-white text-left flex items-center justify-between w-full text-xs">
        <span className={selected.length === 0 ? 'text-gray-400' : 'text-gray-800'}>
          {selected.length === 0 ? `All` : `${selected.length} selected`}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1 mt-1">
          {selected.map((v) => (
            <span key={v} className={`inline-flex items-center gap-0.5 ${colors.chip} text-[11px] font-semibold px-1.5 py-0.5 rounded-full`}>
              {v}
              <button type="button" onClick={() => onToggle(v)} className="hover:text-red-500">&times;</button>
            </span>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {items.map((item) => {
            const isSelected = selected.includes(item);
            return (
              <button key={item} type="button" onClick={() => onToggle(item)}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 transition ${isSelected ? 'font-semibold' : 'text-gray-700'}`}
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${isSelected ? colors.active : 'border-gray-300'}`}>
                  {isSelected ? '✓' : ''}
                </span>
                {item}
              </button>
            );
          })}
          {items.length === 0 ? <p className="px-3 py-2 text-xs text-gray-400">No data</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export default function AdvancedComposeSection() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [deepLink, setDeepLink] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [notificationType, setNotificationType] = useState<NotificationType>('promotional');
  const [priority, setPriority] = useState<'default' | 'high'>('high');
  const [platform, setPlatform] = useState<PlatformChoice>('both');
  const [audience, setAudience] = useState<AudienceChoice>('all');
  const [sending, setSending] = useState(false);

  const [targetCities, setTargetCities] = useState<string[]>([]);
  const [targetMembership, setTargetMembership] = useState<'all' | 'members' | 'non_members'>('all');
  const [targetMembershipPlans, setTargetMembershipPlans] = useState<string[]>([]);
  const [targetServiceCenters, setTargetServiceCenters] = useState<string[]>([]);
  const [targetCarBrands, setTargetCarBrands] = useState<string[]>([]);
  const [targetCustomerType, setTargetCustomerType] = useState<'all' | 'new' | 'returning'>('all');
  const [targetCouponUsers, setTargetCouponUsers] = useState<'all' | 'used' | 'never' | 'assigned'>('all');
  const [targetCouponCodes, setTargetCouponCodes] = useState<string[]>([]);
  const [targetWallet, setTargetWallet] = useState<'all' | 'has_balance' | 'no_balance'>('all');
  const [targetBooking, setTargetBooking] = useState<'all' | 'booked' | 'completed' | 'never'>('all');
  const [availableCoupons, setAvailableCoupons] = useState<{ id: string; code: string }[]>([]);
  const [targetPhoneList, setTargetPhoneList] = useState('');
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availablePlans, setAvailablePlans] = useState<{ code: string; name: string }[]>([]);
  const [availableServiceCenters, setAvailableServiceCenters] = useState<string[]>([]);
  const [availableCarBrands, setAvailableCarBrands] = useState<string[]>([]);
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetLoading, setSheetLoading] = useState(false);
  const [estimatedReach, setEstimatedReach] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    sent?: number;
    attempted?: number;
    error?: string;
    hint?: string;
    partialFailure?: boolean;
    platformStats?: {
      ios?: { attempted: number; delivered: number; failed: number };
      android?: { attempted: number; delivered: number; failed: number };
    };
  } | null>(null);

  useEffect(() => {
    fetch('/api/super_admin/notifications/targeting-options')
      .then((r) => r.json())
      .then((d) => {
        setAvailableCities(d.cities || []);
        setAvailablePlans(d.plans || []);
        setAvailableServiceCenters(d.service_centers || []);
        setAvailableCarBrands(d.car_brands || []);
        setAvailableCoupons(d.coupons || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const phones = targetPhoneList.trim();
    if (phones) {
      const count = phones.split(/[\n,;]+/).filter((p) => p.replace(/\D/g, '').length >= 10).length;
      setEstimatedReach(count);
      return;
    }
    if (
      targetCities.length === 0 &&
      targetMembership === 'all' &&
      targetWallet === 'all' &&
      targetBooking === 'all'
    ) {
      setEstimatedReach(null);
      return;
    }
    setEstimating(true);
    const q = new URLSearchParams();
    if (targetCities.length > 0) q.set('cities', targetCities.join(','));
    if (targetMembership !== 'all') q.set('membership', targetMembership);
    if (targetMembership === 'members' && targetMembershipPlans.length > 0) {
      q.set('plans', targetMembershipPlans.join(','));
    }
    if (targetWallet !== 'all') q.set('wallet', targetWallet);
    if (targetBooking !== 'all') q.set('booking', targetBooking);
    fetch(`/api/super_admin/notifications/estimate-reach?${q}`)
      .then((r) => r.json())
      .then((d) => setEstimatedReach(d.count ?? null))
      .catch(() => setEstimatedReach(null))
      .finally(() => setEstimating(false));
  }, [
    targetCities,
    targetMembership,
    targetMembershipPlans,
    targetPhoneList,
    targetWallet,
    targetBooking,
  ]);

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (val: string) =>
    setter((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]);

  const mergePhones = (newPhones: string[]) => {
    setTargetPhoneList((prev) => {
      const existing = prev.trim() ? prev.split(/[\n,;]+/).map((p) => p.replace(/\D/g, '').slice(-10)).filter((p) => p.length === 10) : [];
      return [...new Set([...existing, ...newPhones])].join('\n');
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();

    if (name.endsWith('.csv') || name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const phones = text.split(/[\n\r,;|\t]+/).map((p) => p.replace(/[^0-9]/g, '').slice(-10)).filter((p) => p.length === 10);
        const unique = [...new Set(phones)];
        mergePhones(unique);
        toast.success(`${unique.length} phone numbers loaded from ${file.name}`);
      };
      reader.readAsText(file);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const XLSX = await import('xlsx');
          const wb = XLSX.read(ev.target?.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
          const phones: string[] = [];
          for (const row of rows) {
            for (const cell of row) {
              const val = String(cell || '').replace(/[^0-9]/g, '').slice(-10);
              if (val.length === 10) phones.push(val);
            }
          }
          const unique = [...new Set(phones)];
          mergePhones(unique);
          toast.success(`${unique.length} phone numbers loaded from ${file.name}`);
        } catch {
          toast.error('Could not read Excel file. Try CSV instead.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error('Unsupported file type. Use .csv, .xlsx, .xls or .txt');
    }
    e.target.value = '';
  };

  const handleSheetFetch = async () => {
    const url = sheetUrl.trim();
    if (!url) return;
    setSheetLoading(true);
    try {
      const res = await fetch('/api/super_admin/notifications/import-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to fetch sheet'); return; }
      const phones: string[] = data.phones || [];
      if (phones.length === 0) { toast.error('No phone numbers found in sheet'); return; }
      mergePhones(phones);
      toast.success(`${phones.length} phone numbers imported from Google Sheet`);
      setSheetUrl('');
    } catch {
      toast.error('Failed to fetch Google Sheet');
    } finally {
      setSheetLoading(false);
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    const parts: string[] = [];
    if (targetCities.length > 0) parts.push(`Cities: ${targetCities.join(', ')}`);
    if (targetMembership !== 'all') parts.push(`Membership: ${targetMembership === 'members' ? 'Members' : 'Non-Members'}`);
    const phoneCount = targetPhoneList.trim() ? targetPhoneList.split(/[\n,;]+/).filter((p) => p.replace(/\D/g, '').length >= 10).length : 0;
    if (phoneCount > 0) parts.push(`Phone list: ${phoneCount} numbers`);
    const targetSummary = parts.length > 0 ? `\nTargeting: ${parts.join(' · ')}` : '\nTargeting: All users';

    if (!confirm(`Send advanced notification?\n\nTitle: ${title}\nMessage: ${message}\nPriority: ${priority === 'high' ? 'High' : 'Normal'}${targetSummary}`)) {
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const phoneList = targetPhoneList.trim()
        ? targetPhoneList.split(/[\n,;]+/).map((p) => p.replace(/\D/g, '').slice(-10)).filter((p) => p.length === 10)
        : undefined;

      const res = await fetch('/api/super_admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          target_role: 'CUSTOMER',
          priority,
          notification_type: notificationType,
          image_url: imageUrl.trim() || undefined,
          deep_link: deepLink.trim() || undefined,
          cta_url: ctaUrl.trim() || undefined,
          platform,
          audience,
          target_cities: targetCities.length > 0 ? targetCities : undefined,
          target_membership: targetMembership !== 'all' ? targetMembership : undefined,
          target_membership_plans: targetMembership === 'members' && targetMembershipPlans.length > 0 ? targetMembershipPlans : undefined,
          target_service_centers: targetServiceCenters.length > 0 ? targetServiceCenters : undefined,
          target_car_brands: targetCarBrands.length > 0 ? targetCarBrands : undefined,
          target_customer_type: targetCustomerType !== 'all' ? targetCustomerType : undefined,
          target_coupon_users: targetCouponUsers !== 'all' ? targetCouponUsers : undefined,
          target_coupon_codes: (targetCouponUsers === 'used' || targetCouponUsers === 'assigned') && targetCouponCodes.length > 0 ? targetCouponCodes : undefined,
          target_wallet: targetWallet !== 'all' ? targetWallet : undefined,
          target_booking: targetBooking !== 'all' ? targetBooking : undefined,
          target_phone_list: phoneList?.length ? phoneList : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ success: false, error: data.error || 'Failed to send' });
        toast.error(data.error || 'Failed to send notification');
      } else {
        const partialFailure = Boolean(data.partial_failure);
        setResult({
          success: true,
          sent: data.sent,
          attempted: data.attempted,
          hint: data.message,
          partialFailure,
          platformStats: data.platform_stats,
        });
        if (Number(data.sent) > 0 && partialFailure) {
          toast.error(data.message || 'Some devices failed');
        } else if (Number(data.sent) > 0) {
          toast.success(data.message || `Delivered to ${data.sent} device(s)`);
        } else {
          toast.error(data.message || 'No devices found');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setResult({ success: false, error: msg });
      toast.error('Network error. Try again.');
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setTitle(''); setMessage(''); setIconUrl(''); setImageUrl('');
    setDeepLink(''); setCtaUrl(''); setResult(null);
    setTargetCities([]); setTargetMembership('all');
    setTargetMembershipPlans([]); setTargetServiceCenters([]);
    setTargetCarBrands([]); setTargetCustomerType('all');
    setTargetCouponUsers('all'); setTargetCouponCodes([]);
    setTargetPhoneList('');
    setSheetUrl('');
  };

  const phoneCount = targetPhoneList.trim() ? targetPhoneList.split(/[\n,;]+/).filter((p) => p.replace(/\D/g, '').length >= 10).length : 0;

  return (
    <div className="push-compose-layout w-full">
      <div className="push-compose-grid">
        <div className="push-card p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              Advanced Send
            </h2>
            <span className="push-badge-accent">Targeted · City · Membership · Phone List</span>
          </div>

          <TemplatePicker
            onSelect={(t) => {
              setTitle(String(t.title || '').slice(0, TITLE_MAX));
              setMessage(String(t.body || '').slice(0, MESSAGE_MAX));
              if (t.priority === 'high' || t.priority === 'default') {
                setPriority(t.priority);
              }
              toast.success(`Loaded “${t.name}”`);
            }}
          />

          {/* Title + Message side by side */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="push-label mb-0">Title <span className="text-red-500">*</span></label>
                <FieldCounter current={title.length} max={TITLE_MAX} />
              </div>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))} placeholder="e.g. Flat 30% off this weekend!" className="push-input" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="push-label mb-0">Message <span className="text-red-500">*</span></label>
                <FieldCounter current={message.length} max={MESSAGE_MAX} />
              </div>
              <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))} placeholder="Short description of the offer…" rows={1} className="push-input resize-none" />
            </div>
          </div>

          {/* Icon + Image side by side */}
          <div className="grid md:grid-cols-2 gap-4">
            <PushMediaUploadField label="App Icon (Optional)" hint="256×256 px · PNG/WEBP" sizeHint="max 512 KB" value={iconUrl} onChange={setIconUrl} kind="icon" placeholder="https://cdn.myfng.in/icons/app-icon.png" />
            <PushMediaUploadField label="Notification Image (Optional)" hint="1024×512 px · JPG/PNG/WEBP" sizeHint="max 1 MB" value={imageUrl} onChange={setImageUrl} kind="banner" placeholder="https://cdn.myfng.in/banners/offer.png" />
          </div>

          {/* Deep Link + CTA side by side */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="push-label mb-0 flex items-center gap-1.5"><Link2 className="w-4 h-4 text-gray-400" /> Deep Link</label>
              <input type="text" value={deepLink} onChange={(e) => setDeepLink(e.target.value)} placeholder="myfng://offer/123" className="push-input" />
            </div>
            <div className="space-y-1.5">
              <label className="push-label mb-0 flex items-center gap-1.5"><ExternalLink className="w-4 h-4 text-gray-400" /> CTA Button URL</label>
              <input type="url" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://myfng.in/offer/123" className="push-input" />
            </div>
          </div>

          {/* Type + Priority in one row */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="push-label mb-0">Notification Type</label>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${TYPE_DOT[notificationType] || 'bg-gray-400'}`} />
                <select value={notificationType} onChange={(e) => setNotificationType(e.target.value as NotificationType)} className="push-input flex-1 appearance-none cursor-pointer">
                  <option value="promotional">Promotional</option>
                  <option value="transactional">Transactional</option>
                  <option value="reminder">Reminder</option>
                  <option value="system">System</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="push-label mb-0">Priority</label>
              <div className="grid grid-cols-2 gap-2">
                <SelectCard active={priority === 'high'} onClick={() => setPriority('high')} icon={<Zap className="w-4 h-4" />} title="High" subtitle="Heads-up" />
                <SelectCard active={priority === 'default'} onClick={() => setPriority('default')} icon={<Activity className="w-4 h-4" />} title="Normal" subtitle="Quiet" />
              </div>
            </div>
          </div>

          {/* Platform + Audience in one row */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="push-label mb-0">Platform</label>
              <div className="grid grid-cols-3 gap-2">
                <SelectCard active={platform === 'android'} onClick={() => setPlatform('android')} icon={<Smartphone className="w-4 h-4" />} title="Android" subtitle="FCM" />
                <SelectCard active={platform === 'ios'} onClick={() => setPlatform('ios')} icon={<Apple className="w-4 h-4" />} title="iOS" subtitle="APNs" />
                <SelectCard active={platform === 'both'} onClick={() => setPlatform('both')} icon={<Globe className="w-4 h-4" />} title="Both" subtitle="All" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="push-label mb-0">Audience</label>
              <div className="grid grid-cols-3 gap-2">
                <SelectCard active={audience === 'all'} onClick={() => setAudience('all')} icon={<Users className="w-4 h-4" />} title="All" subtitle="Everyone" />
                <SelectCard active={audience === 'android'} onClick={() => setAudience('android')} icon={<Smartphone className="w-4 h-4" />} title="Android" subtitle="Only" />
                <SelectCard active={audience === 'ios'} onClick={() => setAudience('ios')} icon={<Apple className="w-4 h-4" />} title="iPhone" subtitle="Only" />
              </div>
            </div>
          </div>

          {/* ── Advanced Targeting ── */}
          <div
            data-targeting-version="wallet-booking-v1"
            className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-bold text-gray-800">Audience Targeting</p>
            </div>

            {/* Cities, Service Centers, Car Brands - one row, dropdowns */}
            <div className="grid grid-cols-3 gap-3">
              <DropdownMulti label="Cities" icon={<MapPin className="w-3.5 h-3.5" />} items={availableCities} selected={targetCities} onToggle={toggle(setTargetCities)} color="blue" />
              <DropdownMulti label="Service Centers" icon={<Wrench className="w-3.5 h-3.5" />} items={availableServiceCenters} selected={targetServiceCenters} onToggle={toggle(setTargetServiceCenters)} color="emerald" />
              <DropdownMulti label="Car Brands" icon={<Car className="w-3.5 h-3.5" />} items={availableCarBrands} selected={targetCarBrands} onToggle={toggle(setTargetCarBrands)} color="orange" />
            </div>

            {/* Membership + Plans - inline chips */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5"><Crown className="w-3.5 h-3.5" /> Membership</label>
              <div className="flex flex-wrap gap-1.5">
                {([['all', 'All'], ['members', 'Members Only'], ['non_members', 'Non-Members']] as const).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => { setTargetMembership(val); if (val !== 'members') setTargetMembershipPlans([]); }}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${targetMembership === val ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-purple-400'}`}
                  >{label}</button>
                ))}
              </div>
              {targetMembership === 'members' && availablePlans.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pl-2 pt-1">
                  <span className="text-[11px] text-gray-400 font-semibold self-center">Plans:</span>
                  {availablePlans.map((p) => {
                    const active = targetMembershipPlans.includes(p.code);
                    return (
                      <button key={p.code} type="button" onClick={() => toggle(setTargetMembershipPlans)(p.code)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${active ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-purple-400'}`}
                      >{p.name}</button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {/* Wallet + Service booking — shown before phone list */}
            <div className="grid md:grid-cols-2 gap-4 rounded-lg border border-emerald-200 bg-white/80 p-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-emerald-600" /> Wallet Balance
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['all', 'All'],
                      ['has_balance', 'Has wallet money'],
                      ['no_balance', 'Empty / no wallet'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTargetWallet(val)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                        targetWallet === val
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-white border-gray-300 text-gray-600 hover:border-emerald-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400">Has wallet money = balance &gt; Rs 0</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-indigo-600" /> Service Booking
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['all', 'All'],
                      ['booked', 'Booked service'],
                      ['completed', 'Service completed'],
                      ['never', 'Never booked'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTargetBooking(val)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                        targetBooking === val
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-gray-300 text-gray-600 hover:border-indigo-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400">Booked / completed / never booked customers</p>
              </div>
            </div>

            {/* Customer Type + Coupon Users side by side */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5" /> Customer Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {([['all', 'All'], ['new', 'New'], ['returning', 'Returning']] as const).map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setTargetCustomerType(val)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${targetCustomerType === val ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-teal-400'}`}
                    >{label}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5"><Ticket className="w-3.5 h-3.5" /> Coupon Users</label>
                <div className="flex flex-wrap gap-1.5">
                  {([['all', 'All'], ['used', 'Used Coupons'], ['never', 'Never Used'], ['assigned', 'Assigned Coupon']] as const).map(([val, label]) => (
                    <button key={val} type="button" onClick={() => { setTargetCouponUsers(val); if (val !== 'used' && val !== 'assigned') setTargetCouponCodes([]); }}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${targetCouponUsers === val ? 'bg-amber-600 border-amber-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-amber-400'}`}
                    >{label}</button>
                  ))}
                </div>
                {(targetCouponUsers === 'used' || targetCouponUsers === 'assigned') && availableCoupons.length > 0 ? (
                  <DropdownMulti
                    label={targetCouponUsers === 'assigned' ? 'Assigned Coupons' : 'Coupons'}
                    icon={<Ticket className="w-3.5 h-3.5" />}
                    items={availableCoupons.map((c) => c.code)}
                    selected={targetCouponCodes}
                    onToggle={toggle(setTargetCouponCodes)}
                    color="orange"
                  />
                ) : null}
              </div>
            </div>

            {/* Phone Numbers */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" /> Specific Phone Numbers (optional)
              </label>
              <textarea
                value={targetPhoneList}
                onChange={(e) => setTargetPhoneList(e.target.value)}
                placeholder={"Paste phone numbers — one per line or comma separated\n9876543210\n8765432109, 7654321098"}
                rows={3}
                className="push-input bg-white resize-none text-xs font-mono"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 bg-white text-xs font-semibold text-gray-600 cursor-pointer hover:border-blue-400 hover:text-blue-600 transition">
                  <Upload className="w-3.5 h-3.5" />
                  Upload CSV / Excel
                  <input type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={handleFileUpload} />
                </label>
                {phoneCount > 0 ? (
                  <>
                    <span className="text-xs text-gray-500">
                      <FileSpreadsheet className="w-3.5 h-3.5 inline -mt-0.5 mr-0.5" />
                      {phoneCount} numbers
                    </span>
                    <button type="button" onClick={() => setTargetPhoneList('')} className="text-xs text-red-500 hover:text-red-700 font-semibold inline-flex items-center gap-0.5">
                      <X className="w-3 h-3" /> Clear
                    </button>
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 relative">
                  <input
                    type="url"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/... (public sheet URL)"
                    className="push-input bg-white text-xs pr-20"
                  />
                  <button
                    type="button"
                    disabled={!sheetUrl.trim() || sheetLoading}
                    onClick={handleSheetFetch}
                    className="absolute right-1 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-40 inline-flex items-center gap-1"
                  >
                    {sheetLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSpreadsheet className="w-3 h-3" />}
                    Fetch
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-gray-400">Paste, upload CSV/Excel, or import from a Google Sheet. If phone numbers are provided, city & membership filters are ignored.</p>
            </div>

            {estimatedReach !== null ? (
              <div className="flex items-center gap-2 text-sm font-bold text-blue-700">
                <Users className="w-4 h-4" />
                Estimated reach: ~{estimatedReach} {estimatedReach === 1 ? 'user' : 'users'}
                {estimating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              </div>
            ) : null}
          </div>

          {/* ── Result ── */}
          {result ? (
            <div className={`flex items-start gap-2 p-3 rounded-xl text-sm ${result.success ? result.partialFailure ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-blue-50 text-blue-800 border border-blue-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
              {result.success ? (result.partialFailure ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />) : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
              <div>
                {result.success ? (
                  <>
                    <p>Sent to <strong>{result.sent}</strong> of <strong>{result.attempted ?? result.sent}</strong> device(s)</p>
                    {result.platformStats ? (
                      <ul className="mt-2 space-y-1 text-xs">
                        {result.platformStats.android?.attempted ? <li>Android: {result.platformStats.android.delivered}/{result.platformStats.android.attempted} delivered</li> : null}
                        {result.platformStats.ios?.attempted ? <li>iPhone: {result.platformStats.ios.delivered}/{result.platformStats.ios.attempted} delivered</li> : null}
                      </ul>
                    ) : null}
                    {result.hint ? <p className="mt-1">{result.hint}</p> : null}
                  </>
                ) : (
                  <p>{result.error}</p>
                )}
              </div>
            </div>
          ) : null}

          {/* ── Actions ── */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button type="button" onClick={resetForm} className="push-btn-ghost">Cancel</button>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending || !title.trim() || !message.trim()}
              className="push-btn-primary inline-flex items-center gap-2 px-5 py-2.5 disabled:opacity-50 shadow-sm"
            >
              {sending ? (<><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>) : (<><Send className="w-4 h-4" /> Send Notification</>)}
            </button>
          </div>
        </div>

        <NotificationLivePreview title={title} message={message} notificationType={notificationType} priority={priority} imageUrl={imageUrl} iconUrl={iconUrl} />
      </div>
    </div>
  );
}
