import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS, SIZES, SPACING } from '../../constants/theme';
import type { PickupBoyOption } from '../../lib/fetchWorkshopPickupBoys';

type Props = {
  visible: boolean;
  leadLabel?: string;
  pickupBoys: PickupBoyOption[];
  loading?: boolean;
  saving?: boolean;
  onSelect: (boy: PickupBoyOption) => void;
  onClose: () => void;
};

export default function PickupAssignModal({
  visible,
  leadLabel,
  pickupBoys,
  loading = false,
  saving = false,
  onSelect,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <View style={styles.card}>
          <Text style={styles.title}>Assign pickup</Text>
          {leadLabel ? <Text style={styles.subtitle}>{leadLabel}</Text> : null}

          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
          ) : (
            pickupBoys.map((boy) => (
              <TouchableOpacity
                key={boy.id}
                style={styles.row}
                disabled={saving}
                onPress={() => onSelect(boy)}
              >
                <Text style={styles.rowText}>{boy.full_name}</Text>
              </TouchableOpacity>
            ))
          )}

          {!loading && pickupBoys.length === 0 ? (
            <Text style={styles.empty}>
              No pickup boys in this workshop. Ask owner to link pickup staff to this workshop.
            </Text>
          ) : null}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    maxHeight: '70%',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 14, color: COLORS.gray[600], marginTop: 4, marginBottom: 12 },
  row: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  rowText: { fontSize: 16, fontWeight: '700', color: '#023D95' },
  empty: { fontSize: 14, color: COLORS.gray[500], marginVertical: 12, lineHeight: 20 },
  cancelBtn: { paddingVertical: 16, alignItems: 'center' },
  cancelTxt: { fontSize: 15, fontWeight: '700', color: COLORS.gray[500] },
});
