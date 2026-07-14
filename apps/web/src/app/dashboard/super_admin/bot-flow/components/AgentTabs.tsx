'use client';

import { Activity, Brain, CalendarClock, ShoppingCart, Target } from 'lucide-react';

export type AgentTabId = 'brain' | 'booking' | 'followup' | 'chase' | 'monitoring';

const TABS: Array<{ id: AgentTabId; label: string; icon: typeof Brain; description: string }> = [
  { id: 'brain', label: 'AI Brain', icon: Brain, description: 'Inbound router + flows' },
  { id: 'booking', label: 'MISA AI', icon: ShoppingCart, description: 'Instant Service Assistant' },
  { id: 'followup', label: 'Follow-up Bot', icon: CalendarClock, description: 'Scheduled check-ins' },
  { id: 'chase', label: 'Chase Bot', icon: Target, description: 'Persistent conversion' },
  { id: 'monitoring', label: 'Monitoring', icon: Activity, description: 'Analytics + audit log' },
];

type Props = {
  activeTab: AgentTabId;
  onChange: (tab: AgentTabId) => void;
};

export default function AgentTabs({ activeTab, onChange }: Props) {
  return (
    <div className="rounded-xl border bg-white p-2 shadow-sm">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`rounded-lg px-3 py-3 text-left transition ${
                isActive
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'border border-gray-100 bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${isActive ? 'text-violet-100' : 'text-violet-600'}`} />
                <span className="text-sm font-semibold">{tab.label}</span>
              </div>
              <p className={`mt-1 text-[11px] ${isActive ? 'text-violet-100' : 'text-gray-500'}`}>
                {tab.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
