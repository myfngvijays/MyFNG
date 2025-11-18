/**
 * Lead Card Component - Mobile
 * Displays lead information with SLA tracking for mobile
 * Task: WA-302
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { 
  getSLAColor, 
  getTimeRemaining, 
  formatTimeRemaining,
  getTimeSince,
  calculateLeadSLAStatus,
  type SLAStatus 
} from '../services/slaService';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

interface LeadCardMobileProps {
  lead: {
    id: string;
    lead_number: string;
    lead_type: 'NORMAL' | 'RSA' | 'HOME_SERVICE';
    customer_name: string;
    customer_phone: string;
    vehicle_number: string;
    vehicle_make?: string;
    vehicle_model?: string;
    service_type: string;
    status: string;
    priority: string;
    pickup_required?: boolean;
    distance_from_workshop?: number;
    created_at: string;
    assigned_at?: string;
    accepted_at?: string;
    sla_accept_deadline?: string;
    sla_assign_deadline?: string;
    sla_start_deadline?: string;
    assigned_mechanic_id?: string;
    estimated_amount?: number;
  };
  onAccept?: (leadId: string) => void;
  onReject?: (leadId: string) => void;
  onPress?: (leadId: string) => void;
}

export default function LeadCardMobile({ lead, onAccept, onReject, onPress }: LeadCardMobileProps) {
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<any>(null);
  const [slaStatus, setSlaStatus] = useState<SLAStatus>('ON_TIME');

  // Update SLA status every second
  useEffect(() => {
    const updateSLA = () => {
      const status = calculateLeadSLAStatus({
        status: lead.status,
        assigned_at: lead.assigned_at || null,
        accepted_at: lead.accepted_at || null,
        sla_accept_deadline: lead.sla_accept_deadline || null,
        sla_assign_deadline: lead.sla_assign_deadline || null,
        sla_start_deadline: lead.sla_start_deadline || null,
        assigned_mechanic_id: lead.assigned_mechanic_id || null,
        lead_type: lead.lead_type,
      });
      setSlaStatus(status);

      if (lead.status === 'ASSIGNED' && lead.sla_accept_deadline) {
        const remaining = getTimeRemaining(new Date(lead.sla_accept_deadline), lead.lead_type);
        setTimeRemaining(remaining);
      }
    };

    updateSLA();
    const interval = setInterval(updateSLA, 1000);

    return () => clearInterval(interval);
  }, [lead]);

  const maskPhone = (phone: string) => {
    if (phone.length < 4) return phone;
    return '••••' + phone.slice(-4);
  };

  const handleCall = () => {
    Linking.openURL(`tel:${lead.customer_phone}`);
  };

  const getStatusColor = () => {
    switch (lead.status) {
      case 'ASSIGNED': return COLORS.warning;
      case 'ACCEPTED': return COLORS.success;
      case 'REJECTED': return COLORS.danger;
      case 'IN_PROGRESS': return COLORS.secondary;
      default: return COLORS.gray[500];
    }
  };

  const getPriorityColor = () => {
    switch (lead.priority) {
      case 'URGENT': return '#EF4444';
      case 'HIGH': return '#F59E0B';
      case 'MEDIUM': return '#FBBF24';
      case 'LOW': return '#10B981';
      default: return COLORS.gray[500];
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: getSLAColor(slaStatus), borderLeftWidth: 4 }]}
      onPress={() => onPress?.(lead.id)}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.leadNumber}>{lead.lead_number}</Text>
          <Text style={styles.timeAgo}>{getTimeSince(lead.created_at)}</Text>
        </View>
        
        {/* SLA Indicator */}
        <View style={[styles.slaIndicator, { backgroundColor: getSLAColor(slaStatus) + '20' }]}>
          <Text style={[styles.slaStatus, { color: getSLAColor(slaStatus) }]}>
            {slaStatus.replace('_', ' ')}
          </Text>
          {timeRemaining && (
            <Text style={[styles.slaTime, { color: getSLAColor(slaStatus) }]}>
              {formatTimeRemaining(timeRemaining)}
            </Text>
          )}
        </View>
      </View>

      {/* Status & Priority */}
      <View style={styles.badges}>
        <View style={[styles.badge, { backgroundColor: getStatusColor() + '20' }]}>
          <Text style={[styles.badgeText, { color: getStatusColor() }]}>
            {lead.status.replace('_', ' ')}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: getPriorityColor() + '20' }]}>
          <Text style={[styles.badgeText, { color: getPriorityColor() }]}>
            {lead.priority}
          </Text>
        </View>
      </View>

      {/* Customer Info */}
      <View style={styles.section}>
        <Text style={styles.customerName}>{lead.customer_name}</Text>
        {phoneVisible ? (
          <TouchableOpacity onPress={handleCall}>
            <Text style={styles.phone}>📞 {lead.customer_phone}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setPhoneVisible(true)}>
            <Text style={styles.phoneMasked}>
              {maskPhone(lead.customer_phone)} (Tap to reveal)
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Vehicle Info */}
      <View style={styles.section}>
        <Text style={styles.label}>Vehicle</Text>
        <Text style={styles.vehicleNumber}>{lead.vehicle_number}</Text>
        {lead.vehicle_make && (
          <Text style={styles.vehicleModel}>
            {lead.vehicle_make} {lead.vehicle_model}
          </Text>
        )}
      </View>

      {/* Service Info */}
      <View style={styles.section}>
        <Text style={styles.label}>Service Type</Text>
        <Text style={styles.value}>{lead.service_type}</Text>
      </View>

      {lead.estimated_amount && (
        <View style={styles.section}>
          <Text style={styles.label}>Estimated Amount</Text>
          <Text style={styles.amount}>₹{lead.estimated_amount.toFixed(2)}</Text>
        </View>
      )}

      {lead.pickup_required && (
        <View style={styles.pickupBadge}>
          <Text style={styles.pickupText}>📦 Pickup Required</Text>
        </View>
      )}

      {lead.distance_from_workshop && (
        <Text style={styles.distance}>
          📍 {lead.distance_from_workshop.toFixed(1)} km away
        </Text>
      )}

      {/* Actions */}
      {lead.status === 'ASSIGNED' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.acceptButton]}
            onPress={() => onAccept?.(lead.id)}
          >
            <Text style={styles.buttonText}>✓ Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.rejectButton]}
            onPress={() => onReject?.(lead.id)}
          >
            <Text style={styles.buttonText}>✕ Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  headerLeft: {
    flex: 1,
  },
  leadNumber: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: 4,
  },
  timeAgo: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
  },
  slaIndicator: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
  },
  slaStatus: {
    fontSize: FONT_SIZES.xs,
    fontWeight: 'bold',
  },
  slaTime: {
    fontSize: FONT_SIZES.xs,
    fontWeight: 'bold',
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  badgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  section: {
    marginBottom: SPACING.sm,
  },
  customerName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.heading,
    marginBottom: 4,
  },
  phone: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  phoneMasked: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
  },
  label: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[600],
    marginBottom: 2,
  },
  value: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.heading,
    fontWeight: '500',
  },
  vehicleNumber: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.heading,
  },
  vehicleModel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
  },
  amount: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  pickupBadge: {
    backgroundColor: COLORS.warning + '20',
    padding: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.xs,
  },
  pickupText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.warning,
    fontWeight: '600',
  },
  distance: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[600],
    marginTop: SPACING.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: COLORS.success,
  },
  rejectButton: {
    backgroundColor: COLORS.danger,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
  },
});

