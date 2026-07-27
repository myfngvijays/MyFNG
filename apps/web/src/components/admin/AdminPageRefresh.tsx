'use client';

import { RefreshCw } from 'lucide-react';

type Props = {
  onClick: () => void;
  loading?: boolean;
  label?: string;
  className?: string;
};

/** Standard admin Refresh control — use only where the page has no Refresh yet. */
export default function AdminPageRefresh({
  onClick,
  loading = false,
  label = 'Refresh',
  className = '',
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`btn btn-primary !px-3.5 !py-2 !text-sm !rounded-xl !shadow-sm disabled:opacity-60 ${className}`}
      style={{ backgroundColor: '#5B6CFF', color: '#ffffff' }}
    >
      <RefreshCw className={`w-4 h-4 shrink-0 ${loading ? 'animate-spin' : ''}`} />
      <span>{label}</span>
    </button>
  );
}
