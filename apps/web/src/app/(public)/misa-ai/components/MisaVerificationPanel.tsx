'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

type VerificationContext = {
  conversationId?: string;
  customerPhone?: string;
  phoneVerified?: boolean;
  pricingEligible?: boolean;
};

type Props = {
  chatContext: VerificationContext;
  onContextPatch: (patch: VerificationContext) => void;
  onVerified?: (phone: string) => void;
};

function isValidIndianMobile(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}

export function MisaVerificationPanel({ chatContext, onContextPatch, onVerified }: Props) {
  const sessionId = String(chatContext?.conversationId || '').trim();
  const [phoneInput, setPhoneInput] = useState(chatContext?.customerPhone || '');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpChannelLabel, setOtpChannelLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const otpSendLock = useRef('');

  useEffect(() => {
    if (chatContext?.customerPhone) setPhoneInput(chatContext.customerPhone);
  }, [chatContext?.customerPhone]);

  useEffect(() => {
    if (!otpSent || chatContext?.phoneVerified || otpTimer <= 0) return;
    const t = setTimeout(() => setOtpTimer((prev) => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [otpSent, chatContext?.phoneVerified, otpTimer]);

  const phoneVerified = Boolean(chatContext?.phoneVerified);

  async function sendOtp(targetPhone = phoneInput) {
    if (!isValidIndianMobile(targetPhone)) {
      setError('Valid 10-digit mobile number daalein');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/booking/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: targetPhone,
          channel: 'SMS',
          fallbackWhatsapp: true,
          metadata: { source: 'misa-ai-verification', session_id: sessionId },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'OTP send failed');

      const onWhatsapp = String(json.channel || '').toUpperCase() === 'WHATSAPP';
      setOtpChannelLabel(onWhatsapp ? 'OTP sent on WhatsApp' : 'OTP sent by SMS');
      setOtpSent(true);
      setOtpCode('');
      setOtpTimer(30);
    } catch (e: any) {
      otpSendLock.current = '';
      setError(e?.message || 'OTP send failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (phoneVerified || !isValidIndianMobile(phoneInput)) return;
    if (otpSendLock.current === phoneInput) return;
    otpSendLock.current = phoneInput;
    void sendOtp(phoneInput);
    // Auto-send once when the number is complete. SMS first, WhatsApp if SMS is down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneInput, phoneVerified]);

  if (chatContext?.pricingEligible) return null;

  async function verifyOtp() {
    if (!/^\d{6}$/.test(otpCode)) {
      setError('6-digit OTP daalein');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const verifyRes = await fetch('/api/booking/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneInput,
          otp: otpCode,
          source: 'misa-ai-verification',
          misa_channel: 'WEBSITE',
        }),
      });
      const verifyJson = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !verifyJson?.verified) {
        throw new Error(verifyJson?.error || 'Invalid OTP');
      }

      if (sessionId) {
        const syncRes = await fetch('/api/chatbot/v2/verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync_phone',
            session_id: sessionId,
            phone: phoneInput,
          }),
        });
        const syncJson = await syncRes.json().catch(() => ({}));
        if (syncRes.ok && syncJson?.success) {
          onContextPatch({ ...(syncJson.contextPatch || {}), conversationId: sessionId });
        } else {
          onContextPatch({
            conversationId: sessionId,
            customerPhone: phoneInput,
            phoneVerified: true,
            pricingEligible: true,
          });
        }
      }

      onVerified?.(phoneInput);
    } catch (e: any) {
      setError(e?.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-4 pl-10">
      <div className="rounded-2xl border border-brand-primary/15 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-primary" />
          <p className="text-sm font-semibold text-brand-secondary">Mobile verification for pricing</p>
        </div>

        {!phoneVerified ? (
          <div className="space-y-3">
            <div>
              <div className="flex items-end gap-2">
                <label className="block min-w-0 flex-1">
                  <span className="mb-1.5 block text-xs font-medium text-gray-600">Mobile number</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phoneInput}
                    onChange={(e) => {
                      const next = e.target.value.replace(/\D/g, '').slice(0, 10);
                      if (next !== phoneInput) {
                        setOtpSent(false);
                        setOtpCode('');
                        setOtpChannelLabel('');
                        if (next.length < 10) otpSendLock.current = '';
                      }
                      setPhoneInput(next);
                      setError(null);
                    }}
                    placeholder="10-digit mobile"
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-base text-gray-900 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                </label>
                <label className="block min-w-0 flex-1">
                  <span className="mb-1.5 block text-xs font-medium text-gray-600">OTP</span>
                  <input
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setError(null);
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6-digit OTP"
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-base text-gray-900 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void verifyOtp()}
                  disabled={loading || !otpSent || otpCode.length !== 6}
                  className="h-11 shrink-0 rounded-xl bg-brand-secondary px-4 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Verify
                </button>
              </div>
              <p className="mt-1 text-[11px] font-medium text-gray-500">
                {loading && !otpSent
                  ? 'Sending OTP…'
                  : otpChannelLabel
                    ? `${otpChannelLabel}${otpTimer > 0 ? ` · Resend in ${otpTimer}s` : ''}`
                    : 'OTP on this number.'}
                {otpSent && otpTimer === 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      otpSendLock.current = '';
                      void sendOtp(phoneInput);
                    }}
                    disabled={loading}
                    className="ml-1 font-bold text-brand-primary disabled:opacity-40"
                  >
                    Resend
                  </button>
                ) : null}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Mobile verified — ab aap pricing dekh sakte ho.
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}

export function assistantNeedsMobileVerification(text: string): boolean {
  const t = String(text || '').toLowerCase();
  return /mobile|phone|otp|whatsapp|verify|verification|10.digit/i.test(t);
}
