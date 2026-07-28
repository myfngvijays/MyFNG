'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';

export type PushTemplateOption = {
  id: string;
  name: string;
  title: string;
  body: string;
  priority?: string;
  category?: string;
  target_role?: string;
  is_active?: boolean;
};

type Props = {
  onSelect: (template: PushTemplateOption) => void;
  className?: string;
};

export default function TemplatePicker({ onSelect, className = '' }: Props) {
  const [templates, setTemplates] = useState<PushTemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/super_admin/notifications/templates');
        const json = await res.json();
        if (res.ok && Array.isArray(json.templates)) {
          setTemplates(json.templates.filter((t: PushTemplateOption) => t.is_active !== false));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className={className}>
      <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5 mb-1.5">
        <FileText className="w-3.5 h-3.5" />
        Use template
      </label>
      <div className="relative">
        {loading ? (
          <div className="push-input flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading templates…
          </div>
        ) : (
          <select
            value={selectedId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedId(id);
              const t = templates.find((x) => x.id === id);
              if (t) onSelect(t);
            }}
            className="push-input bg-white w-full text-sm"
          >
            <option value="">— Write manually or pick a template —</option>
            {templates.map((t) => {
              const isAuto = String(t.category || '').toLowerCase() === 'automation';
              return (
                <option key={t.id} value={t.id}>
                  {isAuto ? '⚡ ' : ''}
                  {t.name}
                </option>
              );
            })}
          </select>
        )}
      </div>
      <p className="text-[11px] text-gray-400 mt-1">
        Selecting fills title &amp; message (you can still edit before send).
      </p>
    </div>
  );
}
