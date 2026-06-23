import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { calculateWalletUsage, fetchWalletVehicleBlocked, formatWalletUsageLimit, getWalletRules } from '../../../lib/wallet';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function CustomerCartScreen({ navigation }: any) {
  const [cart, setCart] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [serviceType, setServiceType] = useState('');
  const [price, setPrice] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [useWallet, setUseWallet] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletVehicleBlocked, setWalletVehicleBlocked] = useState(false);
  const [walletBlockReason, setWalletBlockReason] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicleNumber.trim()) {
      setWalletVehicleBlocked(false);
      setWalletBlockReason(null);
      return;
    }
    let cancelled = false;
    fetchWalletVehicleBlocked(apiFetch, vehicleNumber.trim()).then((res) => {
      if (!cancelled) {
        setWalletVehicleBlocked(res.blocked);
        setWalletBlockReason(res.reason || null);
      }
    });
    return () => { cancelled = true; };
  }, [vehicleNumber]);

  const load = async () => {
    const [res, walletRes] = await Promise.all([
      apiFetch<{ cart: any; items: any[] }>('/api/customer/cart'),
      apiFetch<any>('/api/customer/wallet').catch(() => null),
    ]);
    setCart(res.cart || null);
    setItems(res.items || []);
    setWalletBalance(Number(walletRes?.wallet?.spendable_balance ?? walletRes?.wallet?.current_balance ?? 0));
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  const subtotal = useMemo(() => items.reduce((s, x) => s + Number(x.total_price || 0), 0), [items]);
  const walletUsed = useMemo(
    () => (useWallet && !walletVehicleBlocked ? calculateWalletUsage(subtotal, walletBalance, 'SERVICE', walletVehicleBlocked) : 0),
    [useWallet, subtotal, walletBalance, walletVehicleBlocked],
  );
  const finalAmount = useMemo(() => Math.max(0, subtotal - walletUsed), [subtotal, walletUsed]);

  const addItem = async () => {
    if (!serviceType.trim()) return;
    await apiFetch('/api/customer/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_type: serviceType.trim(), unit_price: Number(price || 0), quantity: 1 }),
    });
    setServiceType('');
    setPrice('');
    await load();
  };

  const removeItem = async (itemId: string) => {
    await apiFetch(`/api/customer/cart?item_id=${itemId}`, { method: 'DELETE' });
    await load();
  };

  const checkout = async () => {
    try {
      const res = await apiFetch<{ lead: any }>('/api/customer/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_wallet: useWallet, vehicle_number: vehicleNumber }),
      });
      Alert.alert('Success', `Order created: ${res?.lead?.lead_number || res?.lead?.id || ''}`);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Checkout failed');
    }
  };

  return (
    <View style={styles.container}>
      <DashboardHeader title="Cart" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>Current Subtotal</Text>
            <Text style={styles.summaryValue}>₹{subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryIconWrap}>
            <Ionicons name="cart-outline" size={22} color={COLORS.primary} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Add Item</Text>
          <TextInput style={styles.input} placeholder="Service type" value={serviceType} onChangeText={setServiceType} />
          <TextInput style={styles.input} placeholder="Unit price" value={price} onChangeText={setPrice} keyboardType="numeric" />
          <TouchableOpacity style={styles.btn} onPress={addItem}><Text style={styles.btnText}>Add to Cart</Text></TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Cart Items</Text>
          {items.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.itemIconWrap}>
                  <Ionicons name="build-outline" size={14} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.service_type}</Text>
                  <Text style={styles.itemSub}>₹{Number(item.total_price || 0).toFixed(2)}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => removeItem(item.id)}>
                <Text style={styles.remove}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
          {items.length === 0 && <Text style={styles.empty}>Cart is empty</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Checkout</Text>
          <TextInput style={styles.input} placeholder="Vehicle number (optional)" value={vehicleNumber} onChangeText={setVehicleNumber} />
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Use Wallet (Get up to {formatWalletUsageLimit('SERVICE')})</Text>
              <Text style={styles.walletHint}>Available ₹{walletBalance.toLocaleString('en-IN')}</Text>
              {walletVehicleBlocked ? (
                <Text style={styles.walletBlocked}>
                  {walletBlockReason || 'Wallet cannot be used — this vehicle is linked to another account.'}
                </Text>
              ) : null}
            </View>
            <Switch
              value={useWallet && !walletVehicleBlocked}
              onValueChange={setUseWallet}
              disabled={walletVehicleBlocked}
            />
          </View>
          <Text style={styles.total}>Subtotal: ₹{subtotal.toFixed(2)}</Text>
          {walletUsed > 0 ? <Text style={styles.walletUsed}>Wallet: -₹{walletUsed.toFixed(2)}</Text> : null}
          <Text style={styles.finalTotal}>Payable: ₹{finalAmount.toFixed(2)}</Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.success }]} onPress={checkout}>
            <Text style={styles.btnText}>Checkout</Text>
          </TouchableOpacity>
          {cart && <Text style={styles.meta}>Status: {cart.status}</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  summaryCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: { color: COLORS.textSecondary, fontSize: SIZES.sm, fontWeight: '700' },
  summaryValue: { color: COLORS.textHeading, fontWeight: '800', fontSize: 28, marginTop: 4 },
  summaryIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { backgroundColor: COLORS.white, borderRadius: 10, padding: SPACING.md, marginBottom: SPACING.md },
  label: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading, marginBottom: SPACING.sm },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, height: 44, paddingHorizontal: SPACING.md, color: COLORS.text, marginBottom: SPACING.sm },
  btn: { backgroundColor: COLORS.primary, borderRadius: 8, alignItems: 'center', paddingVertical: 12 },
  btnText: { color: '#FFF', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  itemIconWrap: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF' },
  itemTitle: { color: COLORS.textHeading, fontWeight: '600' },
  itemSub: { color: COLORS.textSecondary, fontSize: SIZES.xs },
  remove: { color: COLORS.danger, fontWeight: '700' },
  empty: { color: COLORS.textSecondary },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  switchLabel: { color: COLORS.textHeading, fontWeight: '600' },
  walletHint: { color: COLORS.textSecondary, fontSize: SIZES.xs, marginTop: 2 },
  walletBlocked: { color: COLORS.danger, fontSize: SIZES.xs, marginTop: 4, lineHeight: 16, fontWeight: '600' },
  total: { color: COLORS.textHeading, fontWeight: '700', marginBottom: SPACING.sm },
  walletUsed: { color: COLORS.success, fontWeight: '700', marginBottom: 4 },
  finalTotal: { color: COLORS.textHeading, fontWeight: '800', marginBottom: SPACING.sm },
  meta: { marginTop: SPACING.sm, color: COLORS.textSecondary, fontSize: SIZES.xs },
});

