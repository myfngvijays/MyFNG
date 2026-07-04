'use client';

import { useState } from 'react';
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
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import NotificationLivePreview, { TYPE_DOT } from '../components/NotificationLivePreview';
import PushMediaUploadField from '../components/PushMediaUploadField';
import { PUSH_TEST_PHONE_PRESETS } from '@/lib/push/push-admin-constants';

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

export default function PushComposeSection() {
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [targetPhone, setTargetPhone] = useState('');
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

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    const audienceLabel =
      audience === 'all' ? 'All Users' : audience === 'android' ? 'Android Users' : 'iPhone Users';
    const phoneHint = targetPhone.trim() ? `\nTest phone: ${targetPhone.trim()}` : '';

    if (
      !confirm(
        `Send notification to "${audienceLabel}"?${phoneHint}\n\nTitle: ${title}\nMessage: ${message}\nPriority: ${priority === 'high' ? 'High' : 'Normal'}`,
      )
    ) {
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const res = await fetch('/api/super_admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          target_role: 'CUSTOMER',
          target_phone: targetPhone.trim() ? targetPhone.replace(/\D/g, '').slice(-10) : undefined,
          priority,
          notification_type: notificationType,
          image_url: imageUrl.trim() || undefined,
          deep_link: deepLink.trim() || undefined,
          cta_url: ctaUrl.trim() || undefined,
          platform,
          audience,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ success: false, error: data.error || 'Failed to send' });
        toast.error(data.error || 'Failed to send notification');
      } else {
        const partialFailure = Boolean(data.partial_failure);
        const platformStats = data.platform_stats;
        setResult({
          success: true,
          sent: data.sent,
          attempted: data.attempted,
          hint: data.message,
          partialFailure,
          platformStats,
        });

        if (Number(data.sent) > 0 && partialFailure) {
          toast.error(data.message || 'Some devices failed — check iPhone/Android breakdown below');
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
    setTitle('');
    setMessage('');
    setIconUrl('');
    setImageUrl('');
    setDeepLink('');
    setCtaUrl('');
    setResult(null);
    setTargetPhone('');
  };

  return (
    <div className="push-compose-layout w-full">
      <div className="push-compose-grid">
        <div className="push-card p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">Send Push Notification</h2>
            <span className="push-badge-accent">FCM HTTP v1 · Real-time delivery</span>
          </div>

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

        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-sm font-medium text-gray-500 inline-flex items-center gap-1 hover:text-gray-800"
          >
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Advanced · test on one phone
          </button>
          {showAdvanced ? (
            <div className="mt-3 space-y-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3">
              <div className="flex flex-wrap gap-2">
                {PUSH_TEST_PHONE_PRESETS.map((preset) => (
                  <button
                    key={preset.phone}
                    type="button"
                    onClick={() => setTargetPhone(preset.phone)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                      targetPhone === preset.phone
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'
                    }`}
                  >
                    {preset.label} · {preset.phone}
                  </button>
                ))}
              </div>
              <input
                type="tel"
                value={targetPhone}
                onChange={(e) => setTargetPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="8652710389 — leave empty for broadcast"
                className="push-input bg-white"
              />
            </div>
          ) : null}
        </div>

        {result ? (
          <div
            className={`flex items-start gap-2 p-3 rounded-xl text-sm ${
              result.success
                ? result.partialFailure
                  ? 'bg-amber-50 text-amber-900 border border-amber-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-100'
                : 'bg-red-50 text-red-800 border border-red-100'
            }`}
          >
            {result.success ? (
              result.partialFailure ? (
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              )
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <div>
              {result.success ? (
                <>
                  <p>
                    Sent to <strong>{result.sent}</strong> of <strong>{result.attempted ?? result.sent}</strong>{' '}
                    device(s)
                  </p>
                  {result.platformStats ? (
                    <ul className="mt-2 space-y-1 text-xs">
                      {result.platformStats.android?.attempted ? (
                        <li>
                          Android: {result.platformStats.android.delivered}/{result.platformStats.android.attempted}{' '}
                          delivered
                        </li>
                      ) : null}
                      {result.platformStats.ios?.attempted ? (
                        <li>
                          iPhone: {result.platformStats.ios.delivered}/{result.platformStats.ios.attempted} delivered
                        </li>
                      ) : null}
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

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button type="button" onClick={resetForm} className="push-btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !title.trim() || !message.trim()}
            className="push-btn-primary inline-flex items-center gap-2 px-5 py-2.5 disabled:opacity-50 shadow-sm"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Notification
              </>
            )}
          </button>
        </div>
      </div>

      <NotificationLivePreview
        title={title}
        message={message}
        notificationType={notificationType}
        priority={priority}
        imageUrl={imageUrl}
        iconUrl={iconUrl}
      />
      </div>
    </div>
  );
}
