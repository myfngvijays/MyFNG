'use client';

import { useState } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Link2,
  ExternalLink,
  Zap,
  Activity,
  Smartphone,
  Apple,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import NotificationLivePreview from '../components/NotificationLivePreview';
import { PUSH_TEST_PHONE_PRESETS } from '@/lib/push/push-admin-constants';

type PlatformChoice = 'both' | 'android' | 'ios';
type AudienceChoice = 'all' | 'android' | 'ios';
type NotificationType = 'promotional' | 'transactional' | 'reminder' | 'system';

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
      <div className="flex items-start gap-3">
        <div
          className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
            active ? 'bg-[#1f7a55] text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {icon}
        </div>
        <div>
          <p className="font-semibold text-sm text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
    </button>
  );
}

export default function PushComposeSection() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
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
  const [result, setResult] = useState<{ success: boolean; sent?: number; error?: string; hint?: string } | null>(
    null,
  );

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
        setResult({ success: true, sent: data.sent, hint: data.message });
        if (Number(data.sent) > 0) {
          toast.success(`Delivered to ${data.sent} device(s)`);
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

  return (
    <div className="grid xl:grid-cols-[1fr_320px] gap-6 items-start">
      <div>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">Send Push Notification</h2>
              <span className="push-badge-green">FCM HTTP v1 · Real-time delivery</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Compose and broadcast a notification to your Android &amp; iOS users.
            </p>
          </div>
        </div>

        <div className="push-card p-6 space-y-5">
          <div>
            <label className="push-label">
              Notification Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
              placeholder="e.g. Flat 30% off on car servicing this weekend!"
              className="push-input"
            />
            <p className="push-hint">{title.length}/80</p>
          </div>

          <div>
            <label className="push-label">
              Notification Message <span className="text-red-500">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 200))}
              placeholder="Add a short, friendly description of the offer or update…"
              rows={4}
              className="push-input resize-none"
            />
            <p className="push-hint">{message.length}/200</p>
          </div>

          <div>
            <label className="push-label flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-gray-500" />
              Notification Image URL (Optional)
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://cdn.myfng.in/banners/offer-123.png"
              className="push-input"
            />
            <p className="push-hint">Rich image attachment (4:3 or 16:9, &lt; 1MB)</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="push-label flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-gray-500" />
                Deep Link (Optional)
              </label>
              <input
                type="text"
                value={deepLink}
                onChange={(e) => setDeepLink(e.target.value)}
                placeholder="myfng://offer/123"
                className="push-input"
              />
              <p className="push-hint">Opens a specific screen in the app</p>
            </div>
            <div>
              <label className="push-label flex items-center gap-1.5">
                <ExternalLink className="w-4 h-4 text-gray-500" />
                CTA Button URL (Optional)
              </label>
              <input
                type="url"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://myfng.in/offer/123"
                className="push-input"
              />
              <p className="push-hint">Adds an &quot;Open&quot; button to the notification</p>
            </div>
          </div>

          <div>
            <label className="push-label">Notification Type</label>
            <select
              value={notificationType}
              onChange={(e) => setNotificationType(e.target.value as NotificationType)}
              className="push-input"
            >
              <option value="promotional">Promotional</option>
              <option value="transactional">Transactional</option>
              <option value="reminder">Reminder</option>
              <option value="system">System</option>
            </select>
            <p className="push-hint">Used for analytics and rate limits</p>
          </div>

          <div>
            <label className="push-label">Priority</label>
            <div className="grid sm:grid-cols-2 gap-3">
              <SelectCard
                active={priority === 'high'}
                onClick={() => setPriority('high')}
                icon={<Zap className="w-4 h-4" />}
                title="High"
                subtitle="Heads-up notification"
              />
              <SelectCard
                active={priority === 'default'}
                onClick={() => setPriority('default')}
                icon={<Activity className="w-4 h-4" />}
                title="Normal"
                subtitle="Quiet inbox"
              />
            </div>
          </div>

          <div>
            <label className="push-label">Platform</label>
            <div className="grid sm:grid-cols-3 gap-3">
              <SelectCard
                active={platform === 'android'}
                onClick={() => setPlatform('android')}
                icon={<Smartphone className="w-4 h-4" />}
                title="Android"
                subtitle="FCM channel"
              />
              <SelectCard
                active={platform === 'ios'}
                onClick={() => setPlatform('ios')}
                icon={<Apple className="w-4 h-4" />}
                title="iOS"
                subtitle="APNs channel"
              />
              <SelectCard
                active={platform === 'both'}
                onClick={() => setPlatform('both')}
                icon={<Users className="w-4 h-4" />}
                title="Both"
                subtitle="All platforms"
              />
            </div>
          </div>

          <div>
            <label className="push-label">Audience</label>
            <div className="grid sm:grid-cols-3 gap-3">
              <SelectCard
                active={audience === 'all'}
                onClick={() => setAudience('all')}
                icon={<Users className="w-4 h-4" />}
                title="All Users"
                subtitle="Every active device"
              />
              <SelectCard
                active={audience === 'android'}
                onClick={() => setAudience('android')}
                icon={<Smartphone className="w-4 h-4" />}
                title="Android Users"
                subtitle="Android devices only"
              />
              <SelectCard
                active={audience === 'ios'}
                onClick={() => setAudience('ios')}
                icon={<Apple className="w-4 h-4" />}
                title="iPhone Users"
                subtitle="iOS devices only"
              />
            </div>
          </div>

          <div>
            <p className="push-label text-gray-400">Future Targeting (Phase 2)</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {['City', 'Service Center', 'Car Brand', 'Customer Type', 'Membership', 'Coupon Users'].map(
                (chip) => (
                  <span key={chip} className="push-chip-disabled">
                    {chip}
                  </span>
                ),
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-sm font-semibold text-gray-600 inline-flex items-center gap-1 hover:text-gray-900"
            >
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Advanced · Test on one phone
            </button>
            {showAdvanced ? (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {PUSH_TEST_PHONE_PRESETS.map((preset) => (
                    <button
                      key={preset.phone}
                      type="button"
                      onClick={() => setTargetPhone(preset.phone)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                        targetPhone === preset.phone
                          ? 'bg-[#1f7a55] border-[#1f7a55] text-white'
                          : 'bg-white border-gray-300 text-gray-700 hover:border-[#1f7a55]'
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
                  className="push-input"
                />
              </div>
            ) : null}
          </div>

          {result ? (
            <div
              className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              )}
              <div>
                {result.success ? (
                  <>
                    <p>
                      Sent to <strong>{result.sent}</strong> device(s)
                    </p>
                    {result.hint ? <p className="mt-1">{result.hint}</p> : null}
                  </>
                ) : (
                  <p>{result.error}</p>
                )}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setTitle('');
                setMessage('');
                setImageUrl('');
                setDeepLink('');
                setCtaUrl('');
                setResult(null);
              }}
              className="push-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending || !title.trim() || !message.trim()}
              className="push-btn-primary inline-flex items-center gap-2 disabled:opacity-50"
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
      </div>

      <NotificationLivePreview
        title={title}
        message={message}
        notificationType={notificationType}
        priority={priority}
        imageUrl={imageUrl}
      />
    </div>
  );
}
