'use client';

import {
  HOME_SMART_TOOL_PLACEMENT_OPTIONS,
  RSA_SMART_TOOL_PLACEMENT_OPTIONS,
  SEARCH_SMART_TOOL_PLACEMENT_OPTIONS,
  SERVICES_SMART_TOOL_PLACEMENT_OPTIONS,
  SETTINGS_SMART_TOOL_PLACEMENT_OPTIONS,
  toggleSmartToolPlacement,
  type SmartToolPlacements,
  type SmartToolScreen,
} from '@/lib/smart-tools-placements';
import type { SmartToolRow } from '@/lib/smart-tools-config';

type MembershipPlanOption = {
  id: string;
  name: string;
  code: string;
  membership_type: string;
  active: boolean;
};

type Props = {
  tool: SmartToolRow;
  plans: MembershipPlanOption[];
  onChange: (patch: Partial<SmartToolRow>) => void;
};

function PlacementCheckboxGroup({
  title,
  screen,
  options,
  placements,
  onChangePlacements,
}: {
  title: string;
  screen: SmartToolScreen;
  options: Array<{ key: string; label: string }>;
  placements: SmartToolPlacements;
  onChangePlacements: (next: SmartToolPlacements) => void;
}) {
  const section = (placements[screen] || {}) as Record<string, boolean>;
  return (
    <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-gray-600">{title}</div>
      {options.map((opt) => (
        <label key={opt.key} className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={Boolean(section[opt.key])}
            onChange={(e) =>
              onChangePlacements(toggleSmartToolPlacement(placements, screen, opt.key, e.target.checked))
            }
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

export default function SmartToolAdvancedFields({ tool, plans, onChange }: Props) {
  const servicePlans = plans.filter((plan) => String(plan.membership_type || '').toUpperCase() === 'SERVICE');
  const rsaPlans = plans.filter((plan) => String(plan.membership_type || '').toUpperCase() === 'RSA');
  const selectedPlanIds = tool.allowed_membership_plan_ids || [];
  const hasPlanRestriction = selectedPlanIds.length > 0;
  const anyMembership = tool.membership_only && !hasPlanRestriction;

  const togglePlan = (planId: string, checked: boolean) => {
    const next = checked
      ? [...new Set([...selectedPlanIds, planId])]
      : selectedPlanIds.filter((id) => id !== planId);
    onChange({
      allowed_membership_plan_ids: next,
      membership_only: next.length > 0 ? true : tool.membership_only,
    });
  };

  const renderPlanGroup = (title: string, groupPlans: MembershipPlanOption[]) => {
    if (!groupPlans.length) return null;
    return (
      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{title}</div>
        {groupPlans.map((plan) => (
          <label key={plan.id} className="flex items-start gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={selectedPlanIds.includes(plan.id)}
              onChange={(e) => togglePlan(plan.id, e.target.checked)}
            />
            <span>
              <span className="font-semibold text-gray-900">{plan.name}</span>
              <span className="ml-2 text-xs text-gray-500">{plan.code}</span>
              {!plan.active ? <span className="ml-2 text-xs font-bold text-red-600">Inactive</span> : null}
            </span>
          </label>
        ))}
      </div>
    );
  };

  return (
    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
      <div>
        <div className="text-xs font-black uppercase tracking-wide text-gray-500">Membership visibility</div>
        <p className="mt-1 text-xs text-gray-500">
          Leave all unchecked for everyone. Pick specific plans, or use &quot;Any active membership&quot; for all members.
        </p>
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={anyMembership}
              onChange={(e) =>
                onChange({
                  membership_only: e.target.checked,
                  allowed_membership_plan_ids: e.target.checked ? [] : selectedPlanIds,
                })
              }
            />
            <span className="font-semibold text-amber-900">Any active membership (Prime / RSA / all plans)</span>
          </label>

          {renderPlanGroup('MyFNG Prime / Service plans', servicePlans)}
          {renderPlanGroup('RSA plans', rsaPlans)}

          {hasPlanRestriction ? (
            <p className="text-xs font-semibold text-blue-700">
              Showing only to users on {selectedPlanIds.length} selected plan{selectedPlanIds.length === 1 ? '' : 's'}.
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <div className="text-xs font-black uppercase tracking-wide text-gray-500">Placements (multi-select)</div>
        <p className="mt-1 text-xs text-gray-500">Choose where this tool appears — same screens as membership cards.</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <PlacementCheckboxGroup
            title="Home screen"
            screen="home"
            options={HOME_SMART_TOOL_PLACEMENT_OPTIONS}
            placements={tool.placements}
            onChangePlacements={(placements) => onChange({ placements })}
          />
          <PlacementCheckboxGroup
            title="Search overlay"
            screen="search"
            options={SEARCH_SMART_TOOL_PLACEMENT_OPTIONS}
            placements={tool.placements}
            onChangePlacements={(placements) => onChange({ placements })}
          />
          <PlacementCheckboxGroup
            title="Services screen"
            screen="services"
            options={SERVICES_SMART_TOOL_PLACEMENT_OPTIONS}
            placements={tool.placements}
            onChangePlacements={(placements) => onChange({ placements })}
          />
          <PlacementCheckboxGroup
            title="RSA screen"
            screen="rsa"
            options={RSA_SMART_TOOL_PLACEMENT_OPTIONS}
            placements={tool.placements}
            onChangePlacements={(placements) => onChange({ placements })}
          />
          <PlacementCheckboxGroup
            title="Settings screen"
            screen="settings"
            options={SETTINGS_SMART_TOOL_PLACEMENT_OPTIONS}
            placements={tool.placements}
            onChangePlacements={(placements) => onChange({ placements })}
          />
        </div>
      </div>
    </div>
  );
}
