'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

export default function LeadManagerDashboard() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    newLeads: 0,
    incompleteLeads: 0,
    pendingAssignment: 0,
    awaitingAcceptance: 0,
    slaAtRisk: 0,
    slaBreached: 0,
    workshopRejected: 0,
    reopenedLeads: 0,
    telecallerPending: 0,
    pickupPending: 0,
    totalLeads: 0,
    assignmentAccuracy: 94,
    avgAssignmentTime: 12
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [
        newLeadsResult,
        incompleteResult,
        pendingAssignmentResult,
        awaitingAcceptanceResult,
        slaAtRiskResult,
        slaBreachedResult,
        rejectedResult,
        reopenedResult,
        telecallerPendingResult,
        pickupPendingResult,
        totalLeadsResult
      ] = await Promise.all([
        supabase.from('service_leads').select('id', { count: 'exact', head: true }).eq('status', 'NEW').is('workshop_id', null),
        supabase.from('service_leads').select('id', { count: 'exact', head: true }).eq('is_incomplete', true),
        supabase.from('service_leads').select('id', { count: 'exact', head: true }).in('status', ['NEW', 'VALIDATED']).is('workshop_id', null).eq('is_incomplete', false),
        supabase.from('service_leads').select('id', { count: 'exact', head: true }).eq('status', 'ASSIGNED').not('workshop_id', 'is', null),
        supabase.from('service_leads').select('id', { count: 'exact', head: true }).eq('sla_state', 'AT_RISK').not('status', 'in', '(COMPLETED,CANCELLED,CLOSED)'),
        supabase.from('service_leads').select('id', { count: 'exact', head: true }).eq('sla_state', 'BREACHED').not('status', 'in', '(COMPLETED,CANCELLED,CLOSED)'),
        supabase.from('service_leads').select('id', { count: 'exact', head: true }).eq('status', 'REJECTED'),
        supabase.from('service_leads').select('id', { count: 'exact', head: true }).gt('reopen_count', 0).not('status', 'in', '(COMPLETED,CANCELLED,CLOSED)'),
        supabase.from('service_leads').select('id', { count: 'exact', head: true }).eq('follow_up_required', true).not('assigned_telecaller_id', 'is', null),
        supabase.from('service_leads').select('id', { count: 'exact', head: true }).eq('pickup_required', true).eq('pickup_status', 'PENDING'),
        supabase.from('service_leads').select('id', { count: 'exact', head: true }).not('status', 'in', '(COMPLETED,CANCELLED,CLOSED)')
      ]);

      setStats({
        newLeads: newLeadsResult.count || 0,
        incompleteLeads: incompleteResult.count || 0,
        pendingAssignment: pendingAssignmentResult.count || 0,
        awaitingAcceptance: awaitingAcceptanceResult.count || 0,
        slaAtRisk: slaAtRiskResult.count || 0,
        slaBreached: slaBreachedResult.count || 0,
        workshopRejected: rejectedResult.count || 0,
        reopenedLeads: reopenedResult.count || 0,
        telecallerPending: telecallerPendingResult.count || 0,
        pickupPending: pickupPendingResult.count || 0,
        totalLeads: totalLeadsResult.count || 0,
        assignmentAccuracy: 94,
        avgAssignmentTime: 12
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-4 text-text-body">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-heading">Lead Manager Control Panel</h1>
        <p className="text-text-body mt-2">Traffic Controller • Quality Gatekeeper • Assignment Brain</p>
      </div>

      {/* Critical Alerts */}
      {(stats.slaBreached > 0 || stats.workshopRejected > 0 || stats.slaAtRisk > 0) && (
          <div className="mb-8 card">
          <h2 className="text-xl font-bold text-red-600 mb-4">🚨 Critical Alerts</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.slaBreached > 0 && (
              <Link href="/dashboard/lead_manager/leads?filter=SLA_BREACHED">
                <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 hover:shadow-lg transition cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold text-red-600">{stats.slaBreached}</p>
                      <p className="text-sm font-medium text-red-700">SLA BREACHED</p>
                    </div>
                    <div className="text-red-500 text-4xl">⚠️</div>
                  </div>
                </div>
              </Link>
            )}
            
            {stats.slaAtRisk > 0 && (
              <Link href="/dashboard/lead_manager/leads?filter=SLA_AT_RISK">
                <div className="bg-orange-50 border-2 border-orange-500 rounded-lg p-4 hover:shadow-lg transition cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold text-orange-600">{stats.slaAtRisk}</p>
                      <p className="text-sm font-medium text-orange-700">SLA AT RISK</p>
                    </div>
                    <div className="text-orange-500 text-4xl">⏰</div>
                  </div>
                </div>
              </Link>
            )}

            {stats.workshopRejected > 0 && (
              <Link href="/dashboard/lead_manager/leads?filter=WORKSHOP_REJECTED">
                <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4 hover:shadow-lg transition cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold text-red-600">{stats.workshopRejected}</p>
                      <p className="text-sm font-medium text-red-700">WORKSHOP REJECTED</p>
                    </div>
                    <div className="text-red-500 text-4xl">❌</div>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Main KPI Grid */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-text-heading mb-4">📊 Operational Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
          <Link href="/dashboard/lead_manager/leads?filter=NEW">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-brand-primary">
              <div className="text-brand-primary text-3xl mb-2">📋</div>
              <p className="text-3xl font-bold text-text-heading">{stats.newLeads}</p>
              <p className="text-sm text-text-body">New Leads</p>
            </div>
          </Link>

          <Link href="/dashboard/lead_manager/leads?filter=INCOMPLETE">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-orange-500">
              <div className="text-orange-500 text-3xl mb-2">⚠️</div>
              <p className="text-3xl font-bold text-text-heading">{stats.incompleteLeads}</p>
              <p className="text-sm text-text-body">Incomplete</p>
            </div>
          </Link>

          <Link href="/dashboard/lead_manager/leads?filter=NEED_ASSIGNMENT">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-brand-secondary">
              <div className="text-brand-secondary text-3xl mb-2">👉</div>
              <p className="text-3xl font-bold text-text-heading">{stats.pendingAssignment}</p>
              <p className="text-sm text-text-body">Need Assignment</p>
            </div>
          </Link>

          <Link href="/dashboard/lead_manager/leads?filter=AWAITING_ACCEPTANCE">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-brand-primary">
              <div className="text-brand-primary text-3xl mb-2">⏳</div>
              <p className="text-3xl font-bold text-text-heading">{stats.awaitingAcceptance}</p>
              <p className="text-sm text-text-body">Awaiting Accept</p>
            </div>
          </Link>

          <Link href="/dashboard/lead_manager/leads?filter=REOPENED">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-red-500">
              <div className="text-red-500 text-3xl mb-2">🔄</div>
              <p className="text-3xl font-bold text-text-heading">{stats.reopenedLeads}</p>
              <p className="text-sm text-text-body">Reopened</p>
            </div>
          </Link>

          <Link href="/dashboard/lead_manager/leads?filter=TELECALLER_PENDING">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-brand-primary">
              <div className="text-brand-primary text-3xl mb-2">📞</div>
              <p className="text-3xl font-bold text-text-heading">{stats.telecallerPending}</p>
              <p className="text-sm text-text-body">Tel. Pending</p>
            </div>
          </Link>

          <Link href="/dashboard/lead_manager/leads?filter=PICKUP_PENDING">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-green-500">
              <div className="text-green-500 text-3xl mb-2">🚗</div>
              <p className="text-3xl font-bold text-text-heading">{stats.pickupPending}</p>
              <p className="text-sm text-text-body">Pickup Pending</p>
            </div>
          </Link>

          <Link href="/dashboard/lead_manager/leads">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-brand-secondary">
              <div className="text-brand-secondary text-3xl mb-2">📊</div>
              <p className="text-3xl font-bold text-text-heading">{stats.totalLeads}</p>
              <p className="text-sm text-text-body">Total Active</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-text-heading mb-4">📈 Performance Metrics</h2>
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="text-center">
              <p className="text-5xl font-bold text-green-600">{stats.assignmentAccuracy}%</p>
              <p className="text-text-body mt-2">Assignment Accuracy</p>
              <div className="mt-4 bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: `${stats.assignmentAccuracy}%` }}></div>
              </div>
            </div>
            <div className="text-center">
              <p className="text-5xl font-bold text-brand-primary">{stats.avgAssignmentTime}m</p>
              <p className="text-text-body mt-2">Avg Assignment Time</p>
              <p className="text-sm text-gray-500 mt-2">Industry Target: 15 minutes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-text-heading mb-4">⚡ Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link href="/dashboard/lead_manager/leads">
            <div className="bg-brand-primary text-white rounded-lg p-6 hover:bg-brand-primary-hover transition cursor-pointer text-center">
              <div className="text-4xl mb-2">📋</div>
              <p className="font-bold">All Leads</p>
            </div>
          </Link>

          <Link href="/dashboard/lead_manager/escalations">
            <div className="bg-orange-600 text-white rounded-lg p-6 hover:bg-orange-700 transition cursor-pointer text-center">
              <div className="text-4xl mb-2">🚨</div>
              <p className="font-bold">Escalations</p>
            </div>
          </Link>

          <Link href="/dashboard/lead_manager/leads?filter=NEED_ASSIGNMENT">
            <div className="bg-brand-secondary text-white rounded-lg p-6 hover:bg-opacity-90 transition cursor-pointer text-center">
              <div className="text-4xl mb-2">➡️</div>
              <p className="font-bold">Assign Leads</p>
            </div>
          </Link>

          <Link href="/dashboard/lead_manager/leads?filter=INCOMPLETE">
            <div className="bg-green-600 text-white rounded-lg p-6 hover:bg-green-700 transition cursor-pointer text-center">
              <div className="text-4xl mb-2">✅</div>
              <p className="font-bold">Fix Incomplete</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
