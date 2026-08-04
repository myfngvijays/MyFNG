import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

export function AdminGradientBannerEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-xs font-semibold uppercase tracking-wider" style={{ color: '#bfdbfe' }}>
      {children}
    </p>
  );
}

export function AdminGradientBannerTitle({ children }: { children: ReactNode }) {
  return (
    <p
      className="m-0 text-2xl sm:text-3xl font-bold leading-snug sm:leading-normal"
      style={{ color: '#ffffff' }}
    >
      {children}
    </p>
  );
}

export function AdminGradientBannerCopy({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`m-0 text-sm sm:text-base leading-7 ${className}`.trim()}
      style={{ color: '#bfdbfe' }}
    >
      {children}
    </p>
  );
}

export default function AdminGradientBanner({ children, className = '' }: Props) {
  return (
    <div
      className={`rounded-2xl p-6 sm:p-8 flex flex-col gap-4 ${className}`.trim()}
      style={{ color: '#ffffff' }}
    >
      {children}
    </div>
  );
}
