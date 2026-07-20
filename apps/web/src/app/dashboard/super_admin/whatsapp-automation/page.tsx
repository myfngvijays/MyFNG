'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Send,
  XCircle,
} from 'lucide-react';
import ToggleSwitch from '@/components/shared/ToggleSwitch';

type TemplateStatus = {
  triggerKey: string;
  templateName: string;
  exists: boolean;
  isApproved: boolean;
  metaStatus: string | null;
  metaCategory: string | null;
  canSendTemplate: boolean;
  isUtilityCategory: boolean;
};

type AutomationTrigger = {
  trigger_key: string;
  display_name: string;
  description: string | null;
  template_name: string;
  template_body: string;
  is_enabled: boolean;
  cron_enabled: boolean;
  cooldown_hours: number;
  phase: string;
  templateStatus: TemplateStatus;
  exampleValues?: string[];
};

const CRON_TRIGGER_KEYS = new Set([
  'booking_incomplete',
  'admin_daily_summary',
  'service_due_reminder',
  'membership_expiring',
]);

const CRON_SCHEDULE_HINTS: Record<string, string> = {
  booking_incomplete: 'Daily scan — inactive drafts 24h+',
  admin_daily_summary: 'Daily 9 AM IST',
  service_due_reminder: 'Mondays IST — 6 months since last service',
  membership_expiring: 'Daily — memberships expiring within 7 days',
};

function isCronTrigger(triggerKey: string) {
  return CRON_TRIGGER_KEYS.has(triggerKey);
}

function fillTemplatePreview(body: string, examples: string[] = []): string {
  return examples.reduce((text, value, index) => {
    return text.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), value);
  }, body);
}

function statusBadge(trigger: AutomationTrigger) {
  if (trigger.templateStatus.isApproved && !trigger.templateStatus.isUtilityCategory) {
    return {
      label: `Meta: ${trigger.templateStatus.metaCategory || 'MARKETING'} — recreate as UTILITY`,
      className: 'bg-orange-50 border-orange-200 text-orange-800',
    };
  }
  if (trigger.templateStatus.canSendTemplate && trigger.is_enabled) {
    return { label: 'Live', className: 'bg-emerald-50 border-emerald-200 text-emerald-800' };
  }
  if (trigger.templateStatus.isApproved) {
    return { label: 'Approved — enable to go live', className: 'bg-amber-50 border-amber-200 text-amber-800' };
  }
  if (trigger.templateStatus.exists) {
    return {
      label: `Meta: ${trigger.templateStatus.metaStatus || 'Pending'}`,
      className: 'bg-amber-50 border-amber-200 text-amber-800',
    };
  }
  return { label: 'Template not created', className: 'bg-red-50 border-red-200 text-red-800' };
}

function TriggerCard({
  trigger,
  expanded,
  onToggle,
  actionKey,
  testPhone,
  onRunAction,
  onToggleEnabled,
  onToggleCronEnabled,
  cronMasterEnabled,
}: {
  trigger: AutomationTrigger;
  expanded: boolean;
  onToggle: () => void;
  actionKey: string | null;
  testPhone: string;
  onRunAction: (
    triggerKey: string,
    action: 'create-template' | 'sync-template' | 'toggle-enabled' | 'test-send',
    extra?: Record<string, unknown>
  ) => Promise<void>;
  onToggleEnabled: (triggerKey: string, isEnabled: boolean) => Promise<void>;
  onToggleCronEnabled: (triggerKey: string, cronEnabled: boolean) => Promise<void>;
  cronMasterEnabled: boolean;
}) {
  const badge = statusBadge(trigger);
  const isBusy = actionKey?.startsWith(`${trigger.trigger_key}:`) ?? false;
  const toggleBusy = actionKey === `${trigger.trigger_key}:toggle-enabled`;
  const cronToggleBusy = actionKey === `${trigger.trigger_key}:toggle-cron-enabled`;
  const cronEligible = isCronTrigger(trigger.trigger_key);
  const cronScheduleHint = CRON_SCHEDULE_HINTS[trigger.trigger_key];

  return (
    <div className={`border rounded-xl overflow-hidden ${expanded ? 'border-blue-300 shadow-sm' : 'border-gray-200'}`}>
      <div
        className={`px-5 py-4 flex items-start justify-between gap-4 ${
          expanded ? 'bg-blue-50/60' : 'bg-white'
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 text-left hover:opacity-90 transition-opacity"
        >
          <div className="flex items-center gap-2 flex-wrap">
            {trigger.templateStatus.canSendTemplate ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-gray-400 shrink-0" />
            )}
            <p className="font-semibold text-gray-900">{trigger.display_name}</p>
            <span className="text-xs text-gray-400">Phase {trigger.phase}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1 truncate">
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{trigger.template_name}</code>
            {' · '}cooldown {trigger.cooldown_hours}h
            {cronEligible && cronScheduleHint ? (
              <>
                {' · '}
                <span className="text-violet-600">{cronScheduleHint}</span>
              </>
            ) : null}
          </p>
        </button>

        <div className="flex items-center gap-4 shrink-0 pt-0.5">
          <div className="flex flex-col items-end gap-1">
            <span className={`text-xs font-semibold ${trigger.is_enabled ? 'text-emerald-600' : 'text-gray-400'}`}>
              {toggleBusy ? 'Saving...' : trigger.is_enabled ? 'Active' : 'Inactive'}
            </span>
            <ToggleSwitch
              enabled={trigger.is_enabled}
              busy={toggleBusy}
              disabled={actionKey !== null && !toggleBusy}
              onChange={(next) => onToggleEnabled(trigger.trigger_key, next)}
              label={`Toggle ${trigger.display_name}`}
            />
          </div>

          {cronEligible ? (
            <div className="flex flex-col items-end gap-1 border-l border-gray-200 pl-4">
              <span
                className={`text-xs font-semibold ${
                  !cronMasterEnabled
                    ? 'text-gray-400'
                    : trigger.cron_enabled
                      ? 'text-violet-600'
                      : 'text-gray-400'
                }`}
              >
                {cronToggleBusy
                  ? 'Saving...'
                  : !cronMasterEnabled
                    ? 'Cron off (master)'
                    : trigger.cron_enabled
                      ? 'Cron on'
                      : 'Cron off'}
              </span>
              <ToggleSwitch
                enabled={trigger.cron_enabled && cronMasterEnabled}
                busy={cronToggleBusy}
                disabled={!cronMasterEnabled || (actionKey !== null && !cronToggleBusy)}
                onChange={(next) => onToggleCronEnabled(trigger.trigger_key, next)}
                label={`Toggle cron for ${trigger.display_name}`}
              />
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1 border-l border-gray-200 pl-4 min-w-[72px]">
              <span className="text-xs font-semibold text-gray-400">Instant</span>
              <span className="text-[10px] text-gray-400 text-right leading-tight">On event</span>
            </div>
          )}
          <button type="button" onClick={onToggle} className="p-1 text-gray-500 hover:text-gray-700">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 pt-0 bg-white border-t border-gray-100 space-y-4">
          {trigger.description && (
            <p className="text-sm text-gray-600 pt-4">{trigger.description}</p>
          )}

          {trigger.templateStatus.isApproved && !trigger.templateStatus.isUtilityCategory && (
            <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              Meta approved this as <strong>{trigger.templateStatus.metaCategory || 'MARKETING'}</strong>, not UTILITY.
              Run SQL migration <code>257_whatsapp_automation_utility_templates.sql</code>, refresh this page, then
              create the new template name shown below.
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Template Preview (UTILITY · en)</p>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-4">
              {fillTemplatePreview(trigger.template_body, trigger.exampleValues || [])}
            </pre>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onRunAction(trigger.trigger_key, 'create-template')}
              disabled={actionKey !== null || trigger.templateStatus.isApproved}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
            >
              {isBusy && actionKey?.endsWith(':create-template') ? 'Submitting...' : 'Create & Submit to Meta'}
            </button>
            <button
              onClick={() => onRunAction(trigger.trigger_key, 'sync-template')}
              disabled={actionKey !== null}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
            >
              {isBusy && actionKey?.endsWith(':sync-template') ? 'Refreshing...' : 'Refresh Template Status'}
            </button>
            <button
              onClick={() => onRunAction(trigger.trigger_key, 'test-send', { phone: testPhone.trim() })}
              disabled={actionKey !== null || !testPhone.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              <Send className="w-4 h-4" />
              {isBusy && actionKey?.endsWith(':test-send') ? 'Sending...' : 'Send Test'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WhatsAppAutomationPage() {
  const [triggers, setTriggers] = useState<AutomationTrigger[]>([]);
  const [cronMasterEnabled, setCronMasterEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>('booking_confirmed');

  const loadTriggers = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch('/api/super_admin/whatsapp-automation');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load automation triggers');
      setTriggers(Array.isArray(json.triggers) ? json.triggers : []);
      setCronMasterEnabled(json.cronMasterEnabled !== false);
    } catch (error: any) {
      if (!silent) {
        setMessage(error.message || 'Failed to load triggers');
        setMessageIsError(true);
        setTriggers([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTriggers();
  }, [loadTriggers]);

  const runAction = async (
    triggerKey: string,
    action: 'create-template' | 'sync-template' | 'toggle-enabled' | 'test-send',
    extra?: Record<string, unknown>
  ) => {
    setActionKey(`${triggerKey}:${action}`);
    setMessage(null);
    setMessageIsError(false);
    try {
      const res = await fetch('/api/super_admin/whatsapp-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, triggerKey, ...extra }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Action failed');
      const successText = json.message || json.result?.message || json.warning || 'Action completed successfully';
      setMessage(successText);
      setMessageIsError(false);
      await loadTriggers(true);
    } catch (error: any) {
      setMessage(error.message || 'Action failed');
      setMessageIsError(true);
      await loadTriggers(true);
    } finally {
      setActionKey(null);
    }
  };

  const handleToggleCronMaster = async (enabled: boolean) => {
    setCronMasterEnabled(enabled);
    setActionKey('cron-master');
    setMessage(null);
    setMessageIsError(false);
    try {
      const res = await fetch('/api/super_admin/whatsapp-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-cron-master', cronMasterEnabled: enabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update cron master switch');
      setMessage(`Scheduled cron jobs ${enabled ? 'enabled' : 'disabled'} globally.`);
    } catch (error: any) {
      setMessage(error.message || 'Failed to update cron master switch');
      setMessageIsError(true);
      setCronMasterEnabled(!enabled);
    } finally {
      setActionKey(null);
    }
  };

  const handleToggleCronEnabled = async (triggerKey: string, cronEnabled: boolean) => {
    setTriggers((current) =>
      current.map((row) => (row.trigger_key === triggerKey ? { ...row, cron_enabled: cronEnabled } : row))
    );
    setActionKey(`${triggerKey}:toggle-cron-enabled`);
    setMessage(null);
    setMessageIsError(false);
    try {
      const res = await fetch('/api/super_admin/whatsapp-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-cron-enabled', triggerKey, cronEnabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update cron setting');
      const row = triggers.find((item) => item.trigger_key === triggerKey);
      setMessage(`${row?.display_name || triggerKey} cron ${cronEnabled ? 'enabled' : 'disabled'}.`);
    } catch (error: any) {
      setMessage(error.message || 'Failed to update cron setting');
      setMessageIsError(true);
      setTriggers((current) =>
        current.map((row) =>
          row.trigger_key === triggerKey ? { ...row, cron_enabled: !cronEnabled } : row
        )
      );
    } finally {
      setActionKey(null);
    }
  };

  const handleToggleEnabled = async (triggerKey: string, isEnabled: boolean) => {
    setTriggers((current) =>
      current.map((row) => (row.trigger_key === triggerKey ? { ...row, is_enabled: isEnabled } : row))
    );
    setActionKey(`${triggerKey}:toggle-enabled`);
    setMessage(null);
    setMessageIsError(false);
    try {
      const res = await fetch('/api/super_admin/whatsapp-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-enabled', triggerKey, isEnabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update trigger');
      const row = triggers.find((item) => item.trigger_key === triggerKey);
      const note =
        isEnabled && row && !row.templateStatus.canSendTemplate
          ? `${row.display_name} enabled — messages will send once Meta approves the UTILITY template.`
          : `${row?.display_name || triggerKey} ${isEnabled ? 'enabled' : 'disabled'}.`;
      setMessage(note);
    } catch (error: any) {
      setMessage(error.message || 'Failed to update trigger');
      setMessageIsError(true);
      setTriggers((current) =>
        current.map((row) =>
          row.trigger_key === triggerKey ? { ...row, is_enabled: !isEnabled } : row
        )
      );
    } finally {
      setActionKey(null);
    }
  };

  const grouped = useMemo(() => {
    const phases = ['1', '2', '3'];
    return phases.map((phase) => ({
      phase,
      items: triggers.filter((row) => row.phase === phase),
    })).filter((group) => group.items.length > 0);
  }, [triggers]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">WhatsApp Automation</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            All triggers use UTILITY templates in English. Use Active for instant/event sends and Cron for scheduled jobs — no page reload.
            {refreshing ? ' · Updating...' : ''}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Scheduled cron jobs (master)</p>
            <p className="text-xs text-gray-500 mt-1">
              Controls all cron-driven WhatsApp jobs: booking incomplete, admin daily summary, service due, membership expiring.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold ${cronMasterEnabled ? 'text-violet-600' : 'text-gray-400'}`}>
              {actionKey === 'cron-master'
                ? 'Saving...'
                : cronMasterEnabled
                  ? 'Cron scheduler on'
                  : 'Cron scheduler off'}
            </span>
            <ToggleSwitch
              enabled={cronMasterEnabled}
              busy={actionKey === 'cron-master'}
              disabled={actionKey !== null && actionKey !== 'cron-master'}
              onChange={handleToggleCronMaster}
              label="Toggle WhatsApp automation cron master switch"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-600 font-medium">Test phone (shared):</label>
          <input
            type="text"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="e.g. 918652710389"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">Used when you click Send Test inside any trigger</span>
        </div>

        {message && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              messageIsError
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-blue-200 bg-blue-50 text-blue-800'
            }`}
          >
            {message}
          </div>
        )}

        {loading && triggers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
            Loading automation triggers...
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.phase} className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1">
                Phase {group.phase}
              </h2>
              <div className="space-y-3">
                {group.items.map((trigger) => (
                  <TriggerCard
                    key={trigger.trigger_key}
                    trigger={trigger}
                    expanded={expandedKey === trigger.trigger_key}
                    onToggle={() =>
                      setExpandedKey((current) =>
                        current === trigger.trigger_key ? null : trigger.trigger_key
                      )
                    }
                    actionKey={actionKey}
                    testPhone={testPhone}
                    onRunAction={runAction}
                    onToggleEnabled={handleToggleEnabled}
                    onToggleCronEnabled={handleToggleCronEnabled}
                    cronMasterEnabled={cronMasterEnabled}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
