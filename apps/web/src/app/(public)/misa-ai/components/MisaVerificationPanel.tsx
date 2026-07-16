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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (chatContext?.customerPhone) setPhoneInput(chatContext.customerPhone);
  }, [chatContext?.customerPhone]);

  useEffect(() => {
    if (!otpSent || chatContext?.phoneVerified || otpTimer <= 0) return;
    const t = setTimeout(() => setOtpTimer((prev) => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [otpSent, chatContext?.phoneVerified, otpTimer]);

  if (chatContext?.pricingEligible) return null;

  const phoneVerified = Boolean(chatContext?.phoneVerified);

  async function sendOtp() {
    if (!isValidIndianMobile(phoneInput)) {
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
          phone: phoneInput,
          metadata: { source: 'misa-ai-verification', session_id: sessionId },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'OTP send failed');

      setOtpSent(true);
      setOtpCode('');
      setOtpTimer(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 60);
    } catch (e: any) {
      setError(e?.message || 'OTP send failed');
    } finally {
      setLoading(false);
    }
  }

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
        body: JSON.stringify({ phone: phoneInput, otp: otpCode }),
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
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Mobile number (WhatsApp OTP)</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10));
                    setError(null);
                    setOtpSent(false);
                  }}
                  placeholder="10-digit mobile"
                  disabled={loading}
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-base text-gray-900 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
                {!otpSent ? (
                  <button
                    type="button"
                    onClick={() => void sendOtp()}
                    disabled={loading || !isValidIndianMobile(phoneInput)}
                    className="rounded-xl bg-brand-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    Send OTP
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void sendOtp()}
                    disabled={loading || otpTimer > 0}
                    className="rounded-xl border border-brand-primary/30 px-3 py-2 text-xs font-semibold text-brand-primary disabled:opacity-40"
                  >
                    {otpTimer > 0 ? `Resend (${otpTimer}s)` : 'Resend'}
                  </button>
                )}
              </div>
            </div>

            {otpSent && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Enter 6-digit OTP from WhatsApp</label>
                <div className="flex gap-2">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={otpCode[idx] || ''}
                      onChange={(e) => {
                        const digit = e.target.value.replace(/\D/g, '').slice(-1);
                        const digits = Array.from({ length: 6 }, (_, i) => otpCode[i] || '');
                        digits[idx] = digit;
                        setOtpCode(digits.join(''));
                        setError(null);
                        if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !otpCode[idx] && idx > 0) {
                          otpRefs.current[idx - 1]?.focus();
                        }
                      }}
                        className="h-11 w-11 rounded-lg border border-gray-200 text-center text-base font-semibold focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void verifyOtp()}
                  disabled={loading || otpCode.length !== 6}
                  className="mt-3 w-full rounded-xl bg-brand-secondary py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Verify OTP
                </button>
              </div>
            )}
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
