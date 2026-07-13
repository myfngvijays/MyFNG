'use client';

import type { AgentRules } from '@/lib/whatsappAgents/shared/types';

type Props = {
  rules: AgentRules;
  onChange: (rules: AgentRules) => void;
};

export default function AgentRulesEditor({ rules, onChange }: Props) {
  const patch = (partial: Partial<AgentRules>) => onChange({ ...rules, ...partial });

  return (
    <div className="rounded-lg border bg-slate-50 p-3 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">Rules</div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="text-xs text-gray-600">
          Max follow-ups
          <input
            type="number"
            min={1}
            max={20}
            value={rules.max_follow_ups}
            onChange={(e) => patch({ max_follow_ups: Number(e.target.value) })}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          Min wait (hours)
          <input
            type="number"
            min={1}
            max={168}
            value={rules.min_wait_hours}
            onChange={(e) => patch({ min_wait_hours: Number(e.target.value) })}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          Max daily messages
          <input
            type="number"
            min={1}
            max={10}
            value={rules.max_daily_messages}
            onChange={(e) => patch({ max_daily_messages: Number(e.target.value) })}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          Confidence threshold
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={rules.confidence_threshold}
            onChange={(e) => patch({ confidence_threshold: Number(e.target.value) })}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          Business hours start
          <input
            type="time"
            value={rules.business_hours.start}
            onChange={(e) =>
              patch({ business_hours: { ...rules.business_hours, start: e.target.value } })
            }
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          Business hours end
          <input
            type="time"
            value={rules.business_hours.end}
            onChange={(e) =>
              patch({ business_hours: { ...rules.business_hours, end: e.target.value } })
            }
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={rules.skip_assigned_chats}
          onChange={(e) => patch({ skip_assigned_chats: e.target.checked })}
        />
        Skip when chat assigned to human agent
      </label>
    </div>
  );
}
