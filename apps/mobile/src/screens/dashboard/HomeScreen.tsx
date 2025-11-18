import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Activity, FileText, CheckCircle, Clock } from 'lucide-react-native';
import { useAuthStore } from '../../store/authStore';
import StatCard from '../../components/StatCard';
import LeadCard from '../../components/LeadCard';
import { COLORS, SIZES } from '../../constants/theme';

export default function HomeScreen() {
  const { userProfile } = useAuthStore();
  const role = userProfile?.role?.role_code || '';

  const renderRoleSpecificContent = () => {
    switch (role) {
      case 'WORKSHOP_ADMIN':
        return renderWorkshopAdminDashboard();
      case 'WORKSHOP_SUPERVISOR':
        return renderWorkshopSupervisorDashboard();
      case 'WORKSHOP_MECHANIC':
        return renderMechanicDashboard();
      case 'WORKSHOP_PICKUP_BOY':
        return renderPickupBoyDashboard();
      case 'LEAD_MANAGER':
        return renderLeadManagerDashboard();
      case 'CUSTOMER':
        return renderCustomerDashboard();
      default:
        return renderDefaultDashboard();
    }
  };

  const renderWorkshopAdminDashboard = () => (
    <>
      <View style={styles.statsGrid}>
        <View style={styles.statRow}>
          <StatCard
            title="Pending"
            value="5"
            icon={<Clock color={COLORS.warning} size={32} />}
            color={COLORS.warning}
          />
          <StatCard
            title="Active"
            value="12"
            icon={<Activity color={COLORS.info} size={32} />}
            color={COLORS.info}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pending Approvals</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        <LeadCard
          leadNumber="LN000123"
          customerName="Rajesh Kumar"
          vehicleNumber="MH 01 AB 1234"
          status="PENDING"
          serviceType="General Service"
        />
        <LeadCard
          leadNumber="LN000124"
          customerName="Amit Sharma"
          vehicleNumber="MH 02 CD 5678"
          status="PENDING"
          serviceType="Engine Repair"
        />
      </View>
    </>
  );

  const renderWorkshopSupervisorDashboard = () => (
    <>
      <View style={styles.statsGrid}>
        <View style={styles.statRow}>
          <StatCard
            title="Active Jobs"
            value="8"
            icon={<Activity color={COLORS.primary} size={32} />}
            color={COLORS.primary}
          />
          <StatCard
            title="Team"
            value="12"
            icon={<CheckCircle color={COLORS.success} size={32} />}
            color={COLORS.success}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Jobs Needing Assignment</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        <LeadCard
          leadNumber="LN000128"
          customerName="Vikram Patel"
          vehicleNumber="MH 06 KL 2345"
          status="ACCEPTED"
          serviceType="Brake Service"
        />
      </View>
    </>
  );

  const renderMechanicDashboard = () => (
    <>
      <View style={styles.statsGrid}>
        <View style={styles.statRow}>
          <StatCard
            title="Assigned"
            value="5"
            icon={<FileText color={COLORS.primary} size={32} />}
            color={COLORS.primary}
          />
          <StatCard
            title="In Progress"
            value="2"
            icon={<Activity color={COLORS.info} size={32} />}
            color={COLORS.info}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Jobs</Text>
        <LeadCard
          leadNumber="LN000125"
          customerName="Priya Singh"
          vehicleNumber="MH 03 EF 9012"
          status="IN_PROGRESS"
          serviceType="AC Service"
        />
      </View>
    </>
  );

  const renderPickupBoyDashboard = () => (
    <>
      <View style={styles.statsGrid}>
        <View style={styles.statRow}>
          <StatCard
            title="Pickups"
            value="3"
            icon={<Clock color={COLORS.warning} size={32} />}
            color={COLORS.warning}
          />
          <StatCard
            title="In Transit"
            value="1"
            icon={<Activity color={COLORS.success} size={32} />}
            color={COLORS.success}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pending Pickups</Text>
        <LeadCard
          leadNumber="PU000045"
          customerName="Mohit Shah"
          vehicleNumber="MH 04 GH 3456"
          status="PENDING"
          serviceType="Vehicle Pickup"
        />
      </View>
    </>
  );

  const renderLeadManagerDashboard = () => (
    <>
      <View style={styles.statsGrid}>
        <View style={styles.statRow}>
          <StatCard
            title="New Leads"
            value="23"
            icon={<FileText color={COLORS.primary} size={32} />}
            color={COLORS.primary}
          />
          <StatCard
            title="Assigned"
            value="45"
            icon={<CheckCircle color={COLORS.success} size={32} />}
            color={COLORS.success}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>New Leads to Assign</Text>
        <LeadCard
          leadNumber="LN000126"
          customerName="Sneha Desai"
          vehicleNumber="MH 05 IJ 7890"
          status="NEW"
          serviceType="Full Service"
        />
      </View>
    </>
  );

  const renderCustomerDashboard = () => (
    <>
      <View style={styles.quickAction}>
        <Text style={styles.quickActionTitle}>Need Service?</Text>
        <Text style={styles.quickActionText}>Book a service for your vehicle</Text>
        <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Book Now</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statRow}>
          <StatCard title="Active" value="2" color={COLORS.info} />
          <StatCard title="Completed" value="5" color={COLORS.success} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Services</Text>
        <LeadCard
          leadNumber="LN000127"
          customerName="Your Vehicle"
          vehicleNumber="MH 01 AB 1234"
          status="IN_PROGRESS"
          serviceType="General Service"
        />
      </View>
    </>
  );

  const renderDefaultDashboard = () => (
    <>
      <View style={styles.statsGrid}>
        <View style={styles.statRow}>
          <StatCard title="Total" value="0" color={COLORS.primary} />
          <StatCard title="Active" value="0" color={COLORS.info} />
        </View>
      </View>

      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No recent activity</Text>
      </View>
    </>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.userName}>{userProfile?.full_name}</Text>
        <Text style={styles.role}>{userProfile?.role?.role_name}</Text>
      </View>

      {renderRoleSpecificContent()}

      <View style={{ height: SIZES.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SIZES.lg,
    backgroundColor: COLORS.primary,
  },
  greeting: {
    fontSize: SIZES.md,
    color: COLORS.white,
    opacity: 0.9,
  },
  userName: {
    fontSize: SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.white,
    marginTop: SIZES.xs,
  },
  role: {
    fontSize: SIZES.base,
    color: COLORS.white,
    opacity: 0.8,
    marginTop: SIZES.xs,
  },
  quickAction: {
    margin: SIZES.lg,
    padding: SIZES.lg,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radiusMd,
  },
  quickActionTitle: {
    fontSize: SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: SIZES.xs,
  },
  quickActionText: {
    fontSize: SIZES.base,
    color: COLORS.white,
    opacity: 0.9,
    marginBottom: SIZES.md,
  },
  primaryButton: {
    backgroundColor: COLORS.white,
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.primary,
    fontSize: SIZES.md,
    fontWeight: 'bold',
  },
  statsGrid: {
    padding: SIZES.lg,
    paddingTop: SIZES.md,
  },
  statRow: {
    flexDirection: 'row',
    gap: SIZES.md,
  },
  section: {
    padding: SIZES.lg,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SIZES.md,
  },
  seeAll: {
    fontSize: SIZES.base,
    color: COLORS.primary,
    fontWeight: '500',
  },
  emptyState: {
    padding: SIZES.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: SIZES.md,
    color: COLORS.textGray,
  },
});

