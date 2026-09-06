'use client';

import { useEffect, useRef, useState } from 'react';

export type OtpAnimStatus = 'idle' | 'mixing' | 'success' | 'error';

type Props = {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  status?: OtpAnimStatus;
  onFilled?: (code: string) => void;
  error?: boolean;
  verified?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
};

export default function AnimatedOtpBoxes({
  value,
  onChange,
  length = 6,
  status,
  onFilled,
  error = false,
  verified = false,
  disabled = false,
  autoFocus = true,
}: Props) {
  const hiddenRef = useRef<HTMLInputElement>(null);
  const filledSent = useRef('');
  const [shown, setShown] = useState('');
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, length);
  const phase: OtpAnimStatus = status || (verified ? 'success' : error ? 'error' : 'idle');

  useEffect(() => {
    if (autoFocus && !disabled && phase === 'idle') hiddenRef.current?.focus();
  }, [autoFocus, disabled, phase]);

  useEffect(() => {
    if (digits.length === length && filledSent.current !== digits) {
      filledSent.current = digits;
      onFilled?.(digits);
    }
    if (digits.length < length) filledSent.current = '';
  }, [digits, length, onFilled]);

  useEffect(() => {
    if (phase !== 'mixing') {
      setShown(digits);
      return;
    }
    const tick = () => {
      setShown(Array.from({ length }, () => String(Math.floor(Math.random() * 10))).join(''));
    };
    tick();
    const id = window.setInterval(tick, 80);
    return () => window.clearInterval(id);
  }, [phase, digits, length]);

  if (phase === 'success') {
    return (
      <div className="myfng-otp-success">
        <style>{successCss}</style>
        <div className="ring">✓</div>
        <p className="title">Verified successfully</p>
        <p className="sub">Your number is locked in</p>
      </div>
    );
  }

  return (
    <div className="myfng-otp" data-phase={phase}>
      <style>{css}</style>
      {Array.from({ length }).map((_, i) => {
        const label = phase === 'mixing' ? shown[i] || '' : digits[i] || '';
        const filled = Boolean(label);
        const active = phase === 'idle' && !disabled && digits.length === i;
        return (
          <div
            key={i}
            className={`myfng-otp-box${filled ? ' is-filled' : ''}${active ? ' is-active' : ''}`}
            style={{ ['--i' as string]: String(i), animationDelay: `${i * 40}ms` }}
          >
            {label ? label : active ? <span className="myfng-otp-caret" /> : null}
          </div>
        );
      })}
      <input
        ref={hiddenRef}
        className="myfng-otp-hidden"
        value={digits}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        disabled={disabled || phase === 'mixing'}
        aria-label="Enter 6-digit OTP"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
      />
    </div>
  );
}

const css = `
.myfng-otp { position:relative; display:flex; justify-content:center; gap:8px; min-height:3.4rem; }
.myfng-otp-box {
  width: 2.75rem; height: 3.15rem; border-radius: 0.85rem;
  border: 2px solid #e5e7eb; background:#fff;
  display:flex; align-items:center; justify-content:center;
  font-size: 1.25rem; font-weight: 800; color:#023D95;
  animation: myfngOtpIn .45s cubic-bezier(.2,.9,.2,1) both;
  box-shadow: 0 6px 16px rgba(2,61,149,.08);
}
.myfng-otp-box.is-filled { border-color:#004AAD; background:#F0F7FF; }
.myfng-otp-box.is-active { border-color:#004AAD; box-shadow: 0 0 0 4px rgba(0,74,173,.12); }
.myfng-otp[data-phase="error"] .myfng-otp-box { border-color:#dc2626; background:#FEF2F2; animation: myfngOtpShake .35s ease; }
.myfng-otp[data-phase="mixing"] {
  height: 10.5rem; align-items:center;
}
.myfng-otp[data-phase="mixing"] .myfng-otp-box {
  position:absolute; left:50%; top:50%; margin:-1.55rem 0 0 -1.35rem;
  border-color:#f59e0b; box-shadow: 0 0 16px rgba(245,158,11,.35);
  animation: myfngOrbit 1.45s linear infinite;
  animation-delay: calc(var(--i) * -0.22s);
}
.myfng-otp-caret { width:2px; height:1.35rem; background:#004AAD; border-radius:1px; animation: myfngOtpBlink 1s ease-in-out infinite; }
.myfng-otp-hidden { position:absolute; inset:0; opacity:0; z-index:2; font-size:2rem; }
@keyframes myfngOtpIn { from { opacity:0; transform: translateY(12px) scale(.92);} to { opacity:1; transform:none;} }
@keyframes myfngOtpShake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
@keyframes myfngOtpBlink { 0%,100%{opacity:1} 50%{opacity:.15} }
@keyframes myfngOrbit {
  from { transform: rotate(calc(var(--i) * 60deg)) translateX(58px) rotate(calc(var(--i) * -60deg)); }
  to { transform: rotate(calc(var(--i) * 60deg + 360deg)) translateX(58px) rotate(calc(var(--i) * -60deg - 360deg)); }
}
@media (min-width: 640px) { .myfng-otp-box { width:3rem; height:3.25rem; } }
`;

const successCss = `
.myfng-otp-success { display:flex; flex-direction:column; align-items:center; padding: 8px 0 12px; animation: myfngPop .45s cubic-bezier(.2,.9,.2,1); }
.myfng-otp-success .ring {
  width:72px; height:72px; border-radius:20px; display:flex; align-items:center; justify-content:center;
  background:#ecfdf5; border:2px solid #16a34a; color:#16a34a; font-size:34px; font-weight:800; margin-bottom:10px;
}
.myfng-otp-success .title { margin:0; font-size:16px; font-weight:800; color:#065f46; }
.myfng-otp-success .sub { margin:4px 0 0; font-size:12px; font-weight:600; color:#059669; }
@keyframes myfngPop { from { opacity:0; transform:scale(.8);} to { opacity:1; transform:none;} }
`;
