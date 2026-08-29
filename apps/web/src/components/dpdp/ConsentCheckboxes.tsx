'use client';

import Link from 'next/link';
import { CONSENT_PURPOSES, type ConsentPurposeId } from '@/lib/dpdp/constants';

export type ConsentMap = Partial<Record<ConsentPurposeId, boolean>>;

type Props = {
  value: ConsentMap;
  onChange: (next: ConsentMap) => void;
  purposes?: ConsentPurposeId[];
  requiredPurposes?: ConsentPurposeId[];
  error?: string;
};

export default function ConsentCheckboxes({
  value,
  onChange,
  purposes = ['service', 'marketing'],
  requiredPurposes = ['service'],
  error,
}: Props) {
  const items = CONSENT_PURPOSES.filter((p) => purposes.includes(p.id));

  return (
    <fieldset className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
      <legend className="px-1 text-sm font-semibold text-gray-800">Consent (unticked until you choose)</legend>
      <p className="text-xs text-gray-600">
        We only process optional purposes if you tick them. Read the{' '}
        <Link href="/privacy-notice" className="text-blue-700 underline">
          Privacy Notice
        </Link>
        .
      </p>
      {items.map((item) => {
        const required = requiredPurposes.includes(item.id);
        return (
          <label key={item.id} className="flex items-start gap-2.5 text-sm text-gray-800">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-blue-700"
              checked={Boolean(value[item.id])}
              onChange={(e) => onChange({ ...value, [item.id]: e.target.checked })}
            />
            <span>
              <span className="font-medium">
                {item.label}
                {required ? ' (needed to continue)' : ' (optional)'}
              </span>
              <span className="mt-0.5 block text-xs text-gray-600">{item.description}</span>
            </span>
          </label>
        );
      })}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </fieldset>
  );
}

export function requiredConsentsGranted(value: ConsentMap, required: ConsentPurposeId[] = ['service']) {
  return required.every((id) => Boolean(value[id]));
}
