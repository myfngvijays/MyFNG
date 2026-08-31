import { formatDateDMY } from "@/lib/dateFormat";
/**
 * Daily Report Screen - Workshop Supervisor
 * End of day summary and reports
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { COLORS, SIZES, SPACING, SHADOWS } from '../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { AC } from '../../../components/workshop/advisorCrmUi';

type MechanicRow = {
  id: string;
  name: string;
  assigned: number;
  completed: number;
  active: number;
};

type IssueRow = { type: string; count: number; description: string };

type PickupRow = {
  id: string;
  name: string;
  assigned: number;
  completed: number;
  active: number;
};

export default function DailyReportScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    overdue: 0,
    rejected: 0,
    qcPassed: 0,
    extraPending: 0,
    pickupActive: 0,
  });
  const [mechanics, setMechanics] = useState<MechanicRow[]>([]);
  const [pickupBoys, setPickupBoys] = useState<PickupRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [insights, setInsights] = useState<string[]>([]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [navigation]);

  useEffect(() => {
    fetchDailyReport();

    const channel = supabase
      .channel(`daily-report-updates-${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mechanic_jobs',
      }, () => {
        fetchDailyReport();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDailyReport = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      const workshopId = userProfile?.workshop_id;
      if (!workshopId) return;

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startIso = startOfDay.toISOString();

      const { data: leads } = await supabase
        .from('service_leads')
        .select(
          'id, status, sla_deadline, sla_expires_at, assigned_mechanic_id, assigned_pickup_boy_id, pickup_status, pickup_required, created_at, updated_at',
        )
        .eq('workshop_id', workshopId)
        .is('deleted_at', null)
        .gte('created_at', startIso);

      const { data: jobs } = await supabase
        .from('mechanic_jobs')
        .select('id, mechanic_id, mechanic_status, sla_expires_at, assigned_at, completed_at, service_leads!inner(workshop_id)')
        .eq('service_leads.workshop_id', workshopId)
        .gte('assigned_at', startIso);

      const jobsToUse = jobs || [];
      const leadsToUse = leads || [];
      const leadIds = leadsToUse.map((l) => l.id);

      const completedFromJobs = jobsToUse.filter((j) => j.mechanic_status === 'COMPLETED').length;
      const pendingFromJobs = jobsToUse.filter((j) =>
        ['ASSIGNED', 'IN_PROGRESS', 'HOLD'].includes(j.mechanic_status)
      ).length;
      const completed = jobsToUse.length
        ? completedFromJobs
        : leadsToUse.filter((j) => ['COMPLETED', 'CLOSED'].includes(j.status)).length;
      const pending = jobsToUse.length
        ? pendingFromJobs
        : leadsToUse.filter((j) => ['IN_PROGRESS', 'ASSIGNED', 'ACCEPTED'].includes(j.status)).length;
      const overdueFromJobs = jobsToUse.filter((j) => {
        if (!j.sla_expires_at || j.mechanic_status === 'COMPLETED') return false;
        return new Date(j.sla_expires_at) < new Date();
      }).length;
      const overdue = jobsToUse.length
        ? overdueFromJobs
        : leadsToUse.filter((j) => {
            if (!j.sla_deadline || ['COMPLETED', 'CLOSED'].includes(j.status)) return false;
            return new Date(j.sla_deadline) < new Date();
          }).length;
      const rejected = leadsToUse.filter((j) => ['REJECTED', 'SENT_BACK'].includes(j.status)).length;
      const total = Math.max(leadsToUse.length, jobsToUse.length);

      let qcPassed = 0;
      if (leadIds.length > 0) {
        const { data: qc } = await supabase
          .from('qc_checks')
          .select('lead_id, qc_status')
          .in('lead_id', leadIds)
          .eq('qc_status', 'PASSED');
        qcPassed = qc?.length || 0;
      }

      const { count: extraPending } = await supabase
        .from('lead_extra_charges')
        .select('id, service_leads!inner(workshop_id)', { count: 'exact', head: true })
        .eq('service_leads.workshop_id', workshopId)
        .eq('status', 'PENDING');

      const { count: pickupActive } = await supabase
        .from('service_leads')
        .select('id', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .eq('pickup_required', true)
        .in('pickup_status', ['ASSIGNED', 'IN_TRANSIT', 'PICKED_UP', 'EN_ROUTE']);

      const { data: mechanicUsers } = await supabase
        .from('users_login')
        .select('id, full_name, role:role_id(role_code)')
        .eq('workshop_id', workshopId)
        .eq('is_active', true);

      const mechanicRows: MechanicRow[] = (mechanicUsers || [])
        .filter((m: any) => {
          const role = Array.isArray(m.role) ? m.role[0] : m.role;
          return role?.role_code === 'WORKSHOP_MECHANIC';
        })
        .map((m: any) => {
          const mineFromJobs = jobsToUse.filter((j) => j.mechanic_id === m.id);
          const mineFromLeads = leadsToUse.filter((l) => l.assigned_mechanic_id === m.id);
          const assigned = mineFromJobs.length || mineFromLeads.length;
          const completed =
            mineFromJobs.filter((j) => j.mechanic_status === 'COMPLETED').length ||
            mineFromLeads.filter((l) => ['COMPLETED', 'CLOSED'].includes(l.status)).length;
          const active =
            mineFromJobs.filter((j) => ['ASSIGNED', 'IN_PROGRESS'].includes(j.mechanic_status)).length ||
            mineFromLeads.filter((l) =>
              ['ASSIGNED', 'IN_PROGRESS', 'ACCEPTED'].includes(String(l.status || '')),
            ).length;
          return {
            id: m.id,
            name: m.full_name,
            assigned,
            completed,
            active,
          };
        });

      const { data: pickupUsers } = await supabase
        .from('users_login')
        .select('id, full_name, role:role_id(role_code)')
        .eq('workshop_id', workshopId)
        .eq('is_active', true);

      const pickupRows: PickupRow[] = (pickupUsers || [])
        .filter((m: any) => {
          const role = Array.isArray(m.role) ? m.role[0] : m.role;
          return role?.role_code === 'WORKSHOP_PICKUP_BOY';
        })
        .map((m: any) => {
          const mine = leadsToUse.filter((l) => l.assigned_pickup_boy_id === m.id);
          const completed = mine.filter((l) =>
            ['VEHICLE_DROPPED_AT_WORKSHOP', 'PICKUP_COMPLETED', 'DROPPED'].includes(
              String(l.pickup_status || '').toUpperCase(),
            ),
          ).length;
          const active = mine.filter((l) =>
            ['ASSIGNED', 'ON_THE_WAY', 'OTP_VERIFIED', 'VEHICLE_IN_TRANSIT', 'IN_TRANSIT', 'PICKED'].includes(
              String(l.pickup_status || '').toUpperCase(),
            ),
          ).length;
          return {
            id: m.id,
            name: m.full_name,
            assigned: mine.length,
            completed,
            active,
          };
        });

      const nextIssues: IssueRow[] = [
        { type: 'Overdue jobs', count: overdue, description: 'SLA already passed' },
        { type: 'Pending extra jobs', count: extraPending || 0, description: 'Waiting for advisor decision' },
        { type: 'Active pickups', count: pickupActive || 0, description: 'Vehicles still in transit' },
        { type: 'Rejected / sent back', count: rejected, description: 'Need follow-up today' },
      ];

      const nextInsights: string[] = [];
      if (overdue > 0) nextInsights.push(`${overdue} job(s) overdue — check mechanic workload.`);
      if ((extraPending || 0) > 0) nextInsights.push(`${extraPending} extra job request(s) still pending.`);
      if (total > 0 && completed < total * 0.5) nextInsights.push('Completion rate is low for today. Review hold / unassigned work.');
      if (nextInsights.length === 0) nextInsights.push('All clear for now. Keep the floor moving.');

      setReport({
        total,
        completed,
        pending,
        overdue,
        rejected,
        qcPassed,
        extraPending: extraPending || 0,
        pickupActive: pickupActive || 0,
      });
      setMechanics(mechanicRows);
      setPickupBoys(pickupRows);
      setIssues(nextIssues.filter((i) => i.count > 0));
      setInsights(nextInsights);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const kpis = [
    { label: 'Total', value: report.total, color: '#004AAD', icon: 'briefcase-outline' as const },
    { label: 'Completed', value: report.completed, color: '#10B981', icon: 'checkmark-circle' as const },
    { label: 'Pending', value: report.pending, color: '#F59E0B', icon: 'time' as const },
    { label: 'Overdue', value: report.overdue, color: '#EF4444', icon: 'alert-circle' as const },
    { label: 'QC Passed', value: report.qcPassed, color: '#0284C7', icon: 'shield-checkmark' as const },
    { label: 'Extra pending', value: report.extraPending, color: '#7C3AED', icon: 'add-circle' as const },
  ];

  return (
    <ScrollView
      style={AC.page}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchDailyReport();
          }}
        />
      }
    >
      <Text style={AC.sub}>{formatDateDMY(new Date().toISOString())} · end of day snapshot</Text>

      <View style={AC.kpiRow}>
        {kpis.map((kpi) => (
          <View key={kpi.label} style={AC.kpiWide}>
            <Ionicons name={kpi.icon} size={18} color={kpi.color} />
            <Text style={[AC.kpiVal, { color: kpi.color }]}>{kpi.value}</Text>
            <Text style={AC.kpiLab}>{kpi.label}</Text>
          </View>
        ))}
      </View>

      <Text style={AC.section}>Mechanic performance today</Text>
      {mechanics.length === 0 ? (
        <View style={AC.whiteCard}>
          <Text style={AC.meta}>No mechanics on this workshop yet.</Text>
        </View>
      ) : (
        mechanics.map((m) => (
          <View key={m.id} style={AC.listCard}>
            <Text style={AC.name}>{m.name}</Text>
            <Text style={AC.meta}>
              Assigned {m.assigned} · Completed {m.completed} · Active {m.active}
            </Text>
          </View>
        ))
      )}

      <Text style={AC.section}>Pickup performance today</Text>
      {pickupBoys.length === 0 ? (
        <View style={AC.whiteCard}>
          <Text style={AC.meta}>No pickup boys on this workshop yet.</Text>
        </View>
      ) : (
        pickupBoys.map((p) => (
          <View key={p.id} style={[AC.listCard, { borderLeftColor: '#EA580C', borderLeftWidth: 4 }]}>
            <Text style={AC.name}>{p.name}</Text>
            <Text style={AC.meta}>
              Assigned {p.assigned} · Completed {p.completed} · Active {p.active}
            </Text>
          </View>
        ))
      )}

      {issues.length > 0 ? (
        <>
          <Text style={AC.section}>Needs attention</Text>
          {issues.map((issue) => (
            <View key={issue.type} style={AC.listCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={AC.name}>{issue.type}</Text>
                  <Text style={AC.meta}>{issue.description}</Text>
                </View>
                <Text style={[AC.kpiVal, { color: '#EA580C' }]}>{issue.count}</Text>
              </View>
            </View>
          ))}
        </>
      ) : null}

      <Text style={AC.section}>Insights</Text>
      {insights.map((line) => (
        <View key={line} style={AC.whiteCard}>
          <Text style={AC.meta}>{line}</Text>
        </View>
      ))}

      <View style={{ height: SPACING.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.md, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: SIZES.xxl, fontWeight: 'bold' },
  date: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    justifyContent: 'space-between',
    rowGap: 10,
  },
  card: {
    width: '48.5%',
    backgroundColor: COLORS.white,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderLeftWidth: 4,
    ...SHADOWS.small,
  },
  value: { fontSize: 26, fontWeight: '800', marginTop: 8, color: COLORS.textHeading },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginTop: 2 },
});
