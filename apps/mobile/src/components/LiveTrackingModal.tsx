import React, { useMemo } from 'react';
import { Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const STEPS = [
  { title: 'Service Booked', desc: 'Your service has been successfully booked and assigned to a technician.', time: '09:30 AM', done: true, icon: 'document-text' as const },
  { title: 'Car Pickup', desc: 'Your car has been picked up by our verified driver and is on its way.', time: '10:15 AM', done: true, icon: 'person' as const },
  { title: 'Reached at Workshop', desc: 'Your vehicle has arrived at the MyFNG partner workshop for inspection.', time: '11:00 AM', done: true, icon: 'home' as const },
  { title: 'Live Updates', desc: 'Photos and videos of your car inspection have been shared on your WhatsApp.', time: '11:45 AM', done: true, icon: 'logo-instagram' as const },
  { title: 'Service In Progress', desc: 'Our expert technicians are currently servicing your vehicle with genuine parts.', time: '12:30 PM', done: true, icon: 'construct' as const },
  { title: 'Service Completed', desc: 'Your car service has been completed successfully. Final quality checks are done.', time: '02:15 PM', done: false, icon: 'checkmark-circle' as const },
  { title: 'Car Out for Delivery', desc: 'Your vehicle is on the way back to your registered address.', time: 'Pending', done: false, icon: 'send' as const },
  { title: 'Car Delivered', desc: 'Your car has been delivered safely. Thank you for choosing MyFNG!', time: 'Pending', done: false, icon: 'gift' as const },
];

export default function LiveTrackingModal({ visible, onClose }: Props) {
  const percentage = useMemo(() => {
    const done = STEPS.filter((s) => s.done).length;
    return Math.round((done / STEPS.length) * 100);
  }, []);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View>
              <View style={styles.headingRow}>
                <View style={styles.greenDot} />
                <Text style={styles.title}>Live Tracking</Text>
              </View>
              <Text style={styles.orderId}>Order ID: #FNG-99283</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.progressTop}>
              <Text style={styles.progressLabel}>SERVICE PROGRESS</Text>
              <Text style={styles.progressPct}>{percentage}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${percentage}%` }]} />
            </View>
          </View>

          <ScrollView style={styles.timeline} contentContainerStyle={styles.timelineContent}>
            {STEPS.map((step) => (
              <View key={step.title} style={styles.stepRow}>
                <View style={[styles.stepIcon, step.done ? styles.stepIconDone : styles.stepIconPending]}>
                  <Ionicons name={step.icon} size={12} color={step.done ? '#FFFFFF' : 'rgba(255,255,255,0.3)'} />
                </View>
                <View style={styles.stepText}>
                  <View style={styles.stepHead}>
                    <Text style={[styles.stepTitle, step.done ? styles.stepTitleDone : styles.stepTitlePending]}>{step.title}</Text>
                    <Text style={[styles.stepTime, step.done ? styles.stepTimeDone : styles.stepTimePending]}>{step.time}</Text>
                  </View>
                  <Text style={[styles.stepDesc, step.done ? styles.stepDescDone : styles.stepDescPending]}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
              <Text style={styles.secondaryBtnText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.whatsAppBtn}
              onPress={() => {
                onClose();
                Linking.openURL('https://wa.me/919152307030');
              }}
            >
              <Ionicons name="logo-whatsapp" size={14} color="#FFFFFF" />
              <Text style={styles.whatsAppBtnText}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '92%',
    borderRadius: 40,
    backgroundColor: '#0A0F1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  orderId: { marginTop: 6, color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  closeBtn: { width: 40, height: 40, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  progressWrap: { paddingHorizontal: 24, paddingTop: 16 },
  progressTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: '#34D399', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  progressPct: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#10B981' },
  timeline: { marginTop: 16, flex: 1 },
  timelineContent: { paddingHorizontal: 24, paddingBottom: 8, gap: 20 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  stepIconDone: { backgroundColor: '#10B981' },
  stepIconPending: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  stepText: { flex: 1 },
  stepHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 2 },
  stepTitle: { fontSize: 13, fontWeight: '800', flex: 1 },
  stepTitleDone: { color: '#FFFFFF' },
  stepTitlePending: { color: 'rgba(255,255,255,0.35)' },
  stepTime: { fontSize: 10, fontWeight: '800' },
  stepTimeDone: { color: '#34D399' },
  stepTimePending: { color: 'rgba(255,255,255,0.25)' },
  stepDesc: { fontSize: 11, lineHeight: 16 },
  stepDescDone: { color: 'rgba(255,255,255,0.55)' },
  stepDescPending: { color: 'rgba(255,255,255,0.2)' },
  footer: { flexDirection: 'row', padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  secondaryBtn: { flex: 1, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  whatsAppBtn: { flex: 1, height: 48, borderRadius: 16, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  whatsAppBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
});
