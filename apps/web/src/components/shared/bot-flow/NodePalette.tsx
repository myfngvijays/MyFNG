'use client';

import { Bot, GitBranch, MessageSquare, PlugZap, Target, UserRoundCheck, Flag } from 'lucide-react';

type NodePaletteProps = {
  onAddNode: (type: string) => void;
};

const ITEMS = [
  { type: 'trigger', label: 'Trigger', icon: Flag },
  { type: 'message', label: 'Message', icon: MessageSquare },
  { type: 'template', label: 'Template', icon: Bot },
  { type: 'condition', label: 'Condition', icon: GitBranch },
  { type: 'api_request', label: 'API Request', icon: PlugZap },
  { type: 'handoff', label: 'Handoff', icon: UserRoundCheck },
  { type: 'end', label: 'End', icon: Target },
];

export default function NodePalette({ onAddNode }: NodePaletteProps) {
  return (
    <div className="rounded-xl border bg-white p-3 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Node Palette</h3>
      <p className="mt-1 text-xs text-gray-500">Click to add blocks on canvas</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => onAddNode(item.type)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
