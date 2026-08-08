'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Shield,
  CreditCard,
  Bell,
  Brain,
  HardDrive,
  Globe,
  Clock,
  Zap,
  Send,
  Server,
  Wifi,
  Lock,
  ExternalLink,
  Wrench,
  ChevronDown,
  ChevronUp,
  Info,
  Key,
  MessageSquare,
  FileText,
  Wallet,
  CarFront,
} from 'lucide-react';

type ServiceStatus = 'healthy' | 'degraded' | 'down';

interface QuickFix {
  label: string;
  action: string;
  actionPayload?: Record<string, unknown>;
}

interface HealthCheck {
  name: string;
  category: string;
  status: ServiceStatus;
  responseTime: number;
  message: string;
  reason: string;
  lastChecked: string;
  quickFix?: QuickFix | null;
  details?: Record<string, unknown>;
}

interface CategoryStat {
  category: string;
  status: ServiceStatus;
  total: number;
  healthy: number;
}

interface HealthAlertTemplateStatus {
  templateName: string;
  exists: boolean;
  isApproved: boolean;
  metaStatus: string | null;
  templateId: string | null;
  canSendTemplate: boolean;
}

interface TemplatePreview {
  template_name: string;
  display_name: string;
  language_code: string;
  category: string;
  body_text: string;
  variable_keys: string[];
  example_values: string[];
}

interface MonitorData {
  healthScore: number;
  overallStatus: 'operational' | 'warning' | 'critical';
  summary: { total: number; healthy: number; degraded: number; down: number };
  categories: CategoryStat[];
  checks: HealthCheck[];
  envStatus: Record<string, boolean>;
  healthAlertTemplate?: HealthAlertTemplateStatus;
  templatePreview?: TemplatePreview;
  lastChecked: string;
  alertsSent: boolean;
}

const categoryIcons: Record<string, any> = {
  Database: Database,
  Authentication: Shield,
  Payments: CreditCard,
  Notifications: Bell,
  Commerce: Wallet,
  Operations: CarFront,
  AI: Brain,
  Storage: HardDrive,
  'Third Party': Globe,
  'Background Jobs': Clock,
  Security: Lock,
};

const statusConfig = {
  healthy: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2, label: 'Healthy', dot: 'bg-emerald-500' },
  degraded: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle, label: 'Degraded', dot: 'bg-amber-500' },
  down: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: XCircle, label: 'Down', dot: 'bg-red-500' },
};

export default function SystemMonitorPage() {
  const router = useRouter();
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingAlert, setTestingAlert] = useState(false);
  const [alertResult, setAlertResult] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedChecks, setExpandedChecks] = useState<Set<number>>(new Set());
  const [fixingService, setFixingService] = useState<string | null>(null);
  const [fixResult, setFixResult] = useState<{ name: string; message: string; success: boolean } | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [syncingTemplate, setSyncingTemplate] = useState(false);
  const [templateActionResult, setTemplateActionResult] = useState<string | null>(null);

  const fetchHealthData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/super_admin/system-monitor');
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const json = await res.json();
      setData(json);
      // Auto-expand down services
      const downIndices = new Set<number>();
      json.checks.forEach((check: HealthCheck, idx: number) => {
        if (check.status === 'down') downIndices.add(idx);
      });
      setExpandedChecks(downIndices);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch health data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealthData();
  }, [fetchHealthData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchHealthData(true), 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchHealthData]);

  const toggleExpand = (idx: number) => {
    setExpandedChecks(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleQuickFix = async (check: HealthCheck) => {
    if (!check.quickFix) return;

    const { action, actionPayload } = check.quickFix;

    if (action === 'external-link' && actionPayload?.url) {
      window.open(actionPayload.url as string, '_blank');
      return;
    }

    if (action === 'internal-link' && actionPayload?.url) {
      router.push(actionPayload.url as string);
      return;
    }

    if (action === 'check-env') {
      // Show env panel - scroll to it
      document.getElementById('env-status-panel')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (action === 'wake-db') {
      setFixingService(check.name);
      try {
        const res = await fetch('/api/super_admin/system-monitor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'wake-db' }),
        });
        const json = await res.json();
        if (res.ok) {
          setFixResult({ name: check.name, message: json.message || 'Action completed', success: true });
          setTimeout(() => fetchHealthData(true), 3000);
        } else {
          setFixResult({ name: check.name, message: json.error || 'Action failed', success: false });
        }
      } catch (e: any) {
        setFixResult({ name: check.name, message: e.message, success: false });
      } finally {
        setFixingService(null);
      }
      return;
    }
  };

  const handleTemplateAction = async (action: 'create-health-template' | 'sync-health-template') => {
    if (action === 'create-health-template') setCreatingTemplate(true);
    else setSyncingTemplate(true);
    setTemplateActionResult(null);

    try {
      const res = await fetch('/api/super_admin/system-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) {
        setTemplateActionResult(json.message || json.error || 'Template action failed');
        return;
      }

      setTemplateActionResult(json.message || 'Template updated successfully');
      if (json.healthAlertTemplate) {
        setData((prev) => (prev ? { ...prev, healthAlertTemplate: json.healthAlertTemplate } : prev));
      } else {
        await fetchHealthData(true);
      }
    } catch (e: any) {
      setTemplateActionResult(e.message || 'Template action failed');
    } finally {
      setCreatingTemplate(false);
      setSyncingTemplate(false);
    }
  };

  const handleTestAlert = async () => {
    if (!testPhone.trim()) {
      setAlertResult('Please enter a phone number');
      return;
    }
    setTestingAlert(true);
    setAlertResult(null);
    try {
      const useTemplate = Boolean(data?.healthAlertTemplate?.canSendTemplate);
      const res = await fetch('/api/super_admin/system-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-alert',
          phoneNumber: testPhone.trim(),
          useTemplate,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const msgId = json.results?.[0]?.messageId;
        const mode = json.deliveryMode === 'template' ? 'Template' : 'Text';
        setAlertResult(`${mode} sent! Message ID: ${msgId || 'N/A'}`);
      } else {
        const errDetail = json.results?.[0]?.error || json.error || 'Failed';
        setAlertResult(`Failed: ${errDetail}`);
      }
    } catch (e: any) {
      setAlertResult(e.message || 'Failed to send test alert');
    } finally {
      setTestingAlert(false);
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600';
    if (score >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  const getHealthScoreRing = (score: number) => {
    if (score >= 90) return 'stroke-emerald-500';
    if (score >= 70) return 'stroke-amber-500';
    return 'stroke-red-500';
  };

  const getOverallStatusBadge = (status: string) => {
    switch (status) {
      case 'operational': return { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'All Systems Operational' };
      case 'warning': return { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Partial Degradation' };
      case 'critical': return { bg: 'bg-red-100', text: 'text-red-800', label: 'Critical Issues Detected' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Unknown' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Running health checks...</p>
          <p className="text-sm text-gray-400 mt-1">Checking all platform services</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-red-200 max-w-md text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900 mt-4">Health Check Failed</h2>
          <p className="text-gray-600 mt-2">{error}</p>
          <button onClick={() => fetchHealthData()} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const overallBadge = getOverallStatusBadge(data.overallStatus);
  const templateStatus = data.healthAlertTemplate;
  const templatePreview = data.templatePreview;
  const templateStatusLabel = templateStatus?.canSendTemplate
    ? 'Approved — 24/7 alerts enabled'
    : templateStatus?.exists
      ? `Submitted — ${templateStatus.metaStatus || 'Pending Meta approval'}`
      : 'Not created yet';
  const templateStatusClass = templateStatus?.canSendTemplate
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : templateStatus?.exists
      ? 'bg-amber-50 border-amber-200 text-amber-800'
      : 'bg-red-50 border-red-200 text-red-800';
  const circumference = 2 * Math.PI * 45;
  const scoreOffset = circumference - (data.healthScore / 100) * circumference;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">System Monitor & Health Check</h1>
                <p className="text-sm text-gray-500">Real-time platform health monitoring</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Auto-refresh (60s)
              </label>
              <button
                onClick={() => fetchHealthData(true)}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Fix Result Toast */}
        {fixResult && (
          <div className={`p-4 rounded-lg border ${fixResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'} flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              {fixResult.success ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
              <span className={`text-sm font-medium ${fixResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                {fixResult.name}: {fixResult.message}
              </span>
            </div>
            <button onClick={() => setFixResult(null)} className="text-gray-400 hover:text-gray-600">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Health Score Circle */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="45" fill="none"
                  className={getHealthScoreRing(data.healthScore)}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={scoreOffset}
                  style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${getHealthScoreColor(data.healthScore)}`}>{data.healthScore}</span>
                <span className="text-xs text-gray-500">/ 100</span>
              </div>
            </div>
            <p className="mt-3 font-semibold text-gray-700">Health Score</p>
            <div className={`mt-2 px-3 py-1 rounded-full text-xs font-medium ${overallBadge.bg} ${overallBadge.text}`}>
              {overallBadge.label}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">Healthy</span>
            </div>
            <p className="text-4xl font-bold text-emerald-600">{data.summary.healthy}</p>
            <p className="text-sm text-gray-500 mt-1">of {data.summary.total} services</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">Degraded</span>
            </div>
            <p className="text-4xl font-bold text-amber-600">{data.summary.degraded}</p>
            <p className="text-sm text-gray-500 mt-1">slow response</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">Down</span>
            </div>
            <p className="text-4xl font-bold text-red-600">{data.summary.down}</p>
            <p className="text-sm text-gray-500 mt-1">need attention</p>
            {data.alertsSent && (
              <p className="text-xs text-red-500 mt-2 font-medium flex items-center gap-1">
                <Send className="w-3 h-3" /> Alert sent via WhatsApp
              </p>
            )}
          </div>
        </div>

        {/* Category Overview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Category Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {data.categories.map((cat) => {
              const Icon = categoryIcons[cat.category] || Server;
              const cfg = statusConfig[cat.status];
              return (
                <div key={cat.category} className={`p-4 rounded-lg border ${cfg.border} ${cfg.bg}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                    <span className="text-xs font-semibold text-gray-700 truncate">{cat.category}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-xs text-gray-500">{cat.healthy}/{cat.total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Checks with Expandable Reasons */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">All Service Checks</h2>
            <span className="text-sm text-gray-500">
              Last checked: {data.lastChecked ? new Date(data.lastChecked).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-'}
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {data.checks.map((check, idx) => {
              const cfg = statusConfig[check.status];
              const StatusIcon = cfg.icon;
              const CatIcon = categoryIcons[check.category] || Server;
              const isExpanded = expandedChecks.has(idx);

              return (
                <div key={idx} className={`${check.status === 'down' ? 'bg-red-50/30' : ''}`}>
                  {/* Main Row */}
                  <div
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => toggleExpand(idx)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${cfg.bg}`}>
                        <StatusIcon className={`w-5 h-5 ${cfg.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{check.name}</p>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <CatIcon className="w-3 h-3" /> {check.category}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{check.message}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm text-gray-700">
                          <Zap className="w-3 h-3" />
                          <span className="font-mono">{check.responseTime}ms</span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                        {cfg.label}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-6 pb-4 pt-0">
                      <div className={`ml-14 p-4 rounded-lg border ${check.status === 'down' ? 'bg-red-50 border-red-200' : check.status === 'degraded' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                        {/* Reason */}
                        <div className="flex items-start gap-2 mb-3">
                          <Info className={`w-4 h-4 mt-0.5 flex-shrink-0 ${check.status === 'down' ? 'text-red-500' : check.status === 'degraded' ? 'text-amber-500' : 'text-blue-500'}`} />
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Reason</p>
                            <p className="text-sm text-gray-600 mt-1">{check.reason}</p>
                          </div>
                        </div>

                        {/* Details if any */}
                        {check.details && Object.keys(check.details).length > 0 && (
                          <div className="flex items-start gap-2 mb-3 mt-3 pt-3 border-t border-gray-200/60">
                            <Database className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                            <div>
                              <p className="text-sm font-semibold text-gray-700">Details</p>
                              <div className="text-xs text-gray-500 mt-1 font-mono bg-white/50 p-2 rounded">
                                {Object.entries(check.details).map(([k, v]) => (
                                  <div key={k}>{k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Quick Fix Button */}
                        {check.quickFix && (
                          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200/60">
                            <Wrench className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-semibold text-gray-700">Quick Fix:</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleQuickFix(check); }}
                              disabled={fixingService === check.name}
                              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                              {check.quickFix.action === 'external-link' && <ExternalLink className="w-3.5 h-3.5" />}
                              {check.quickFix.action === 'internal-link' && <Brain className="w-3.5 h-3.5" />}
                              {check.quickFix.action === 'check-env' && <Key className="w-3.5 h-3.5" />}
                              {check.quickFix.action === 'wake-db' && <Zap className="w-3.5 h-3.5" />}
                              {fixingService === check.name ? 'Running...' : check.quickFix.label}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Environment Variables Status */}
        <div id="env-status-panel" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Environment Variables Status</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">These environment variables are required for services to work. Missing variables will cause services to show as &quot;Down&quot;.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.envStatus && Object.entries(data.envStatus).map(([key, configured]) => (
              <div key={key} className={`flex items-center gap-3 p-3 rounded-lg border ${configured ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${configured ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className={`text-sm font-mono ${configured ? 'text-emerald-700' : 'text-red-700'}`}>{key}</span>
                <span className={`ml-auto text-xs font-medium ${configured ? 'text-emerald-600' : 'text-red-600'}`}>
                  {configured ? 'Set' : 'Missing'}
                </span>
              </div>
            ))}
          </div>
          {data.envStatus && Object.values(data.envStatus).some(v => !v) && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>How to fix:</strong> Add missing variables to your <code className="bg-amber-100 px-1 py-0.5 rounded">.env.local</code> file in the project root, then restart the server.
              </p>
            </div>
          )}
        </div>

        {/* WhatsApp Template Setup */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                  <h2 className="text-lg font-semibold text-gray-900">WhatsApp Alert Template</h2>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  New lined template (<code className="bg-gray-100 px-1 rounded">system_health_alert_v2</code>) lists each service on its own line.
                  Create &amp; submit once — after Meta approval, 24/7 alerts work without a &quot;Hi&quot; first.
                </p>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${templateStatusClass}`}>
                {templateStatusLabel}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-gray-600" />
                  <p className="text-sm font-medium text-gray-900">Template Preview</p>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Name: <code className="bg-white px-1 py-0.5 rounded">{templatePreview?.template_name || 'system_health_alert_v2'}</code>
                  {' · '}
                  Category: {templatePreview?.category || 'UTILITY'}
                </p>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-white border border-gray-200 rounded-lg p-3">
                  {templatePreview?.body_text || 'Template preview unavailable'}
                </pre>
              </div>

              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <p className="text-sm text-gray-700">
                  <strong>Why this is needed:</strong> plain text alerts only deliver inside WhatsApp&apos;s 24-hour reply window. The approved template lets cron alerts reach all admin numbers every 3 hours reliably.
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>1. Click <strong>Create &amp; Submit to Meta</strong></li>
                  <li>2. Wait for Meta approval (usually a few minutes)</li>
                  <li>3. Click <strong>Refresh Template Status</strong></li>
                  <li>4. Send test alert — it will use the template automatically</li>
                </ul>
                <div className="flex items-center gap-3 flex-wrap pt-1">
                  <button
                    onClick={() => handleTemplateAction('create-health-template')}
                    disabled={creatingTemplate || syncingTemplate || templateStatus?.canSendTemplate}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <MessageSquare className={`w-4 h-4 ${creatingTemplate ? 'animate-pulse' : ''}`} />
                    {creatingTemplate ? 'Submitting...' : templateStatus?.exists ? 'Template Submitted' : 'Create & Submit to Meta'}
                  </button>
                  <button
                    onClick={() => handleTemplateAction('sync-health-template')}
                    disabled={creatingTemplate || syncingTemplate}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncingTemplate ? 'animate-spin' : ''}`} />
                    {syncingTemplate ? 'Refreshing...' : 'Refresh Template Status'}
                  </button>
                  <a
                    href="/dashboard/super_admin/whatsapp-templates"
                    className="text-sm text-blue-600 hover:text-blue-700 underline"
                  >
                    Open WhatsApp Templates
                  </a>
                </div>
                {templateActionResult && (
                  <p className={`text-sm font-medium ${templateActionResult.toLowerCase().includes('fail') || templateActionResult.toLowerCase().includes('error') ? 'text-red-600' : 'text-emerald-600'}`}>
                    {templateActionResult}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* WhatsApp Alert Test */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">WhatsApp Alert System</h2>
              <p className="text-sm text-gray-500 mt-1">
                Test alerts to a phone number. Uses the approved template automatically when available.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                For auto-alerts, set: <code className="bg-gray-100 px-1 py-0.5 rounded">SYSTEM_ALERT_WHATSAPP_NUMBERS=918652710389</code> in .env.local
              </p>
              {!templateStatus?.canSendTemplate && (
                <p className="text-xs text-amber-700 mt-2">
                  Template not approved yet — test alerts will use plain text and may fail unless the 24-hour WhatsApp window is open.
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="Enter phone number (e.g. 918652710389)"
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent w-72"
              />
              <button
                onClick={handleTestAlert}
                disabled={testingAlert}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Send className={`w-4 h-4 ${testingAlert ? 'animate-pulse' : ''}`} />
                {testingAlert ? 'Sending...' : 'Send Test Alert'}
              </button>
              {alertResult && (
                <span className={`text-sm font-medium ${alertResult.includes('success') ? 'text-emerald-600' : 'text-red-600'}`}>
                  {alertResult}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info footer */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Wifi className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">How this works</p>
              <ul className="text-sm text-blue-700 mt-1 space-y-1">
                <li>- Click on any service row to expand and see the detailed reason + quick fix</li>
                <li>- Services marked DOWN are auto-expanded on page load</li>
                <li>- Cron alerts run every 3 hours and prefer the approved WhatsApp template when available</li>
                <li>- Create the template from the section above so alerts work without the 24-hour WhatsApp window</li>
                <li>- Health score is weighted across Database, Auth, Payments, Notifications, Commerce, Operations, AI, and more</li>
                <li>- New checks cover Advance Push campaigns, FCM Admin, wallet, coupons, RSA leads, and feature crons</li>
                <li>- Quick Fix buttons let you open relevant dashboards or trigger recovery actions directly</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
