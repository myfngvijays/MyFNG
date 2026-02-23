import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function CustomerCartScreen({ navigation }: any) {
  const [cart, setCart] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [serviceType, setServiceType] = useState('');
  const [price, setPrice] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [useWallet, setUseWallet] = useState(true);

  const load = async () => {
    const res = await apiFetch<{ cart: any; items: any[] }>('/api/customer/cart');
    setCart(res.cart || null);
    setItems(res.items || []);
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  const subtotal = useMemo(() => items.reduce((s, x) => s + Number(x.total_price || 0), 0), [items]);

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
      <ScrollView>
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
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.service_type}</Text>
                <Text style={styles.itemSub}>₹{Number(item.total_price || 0).toFixed(2)}</Text>
              </View>
              <TouchableOpacity onPress={() => removeItem(item.id)}><Text style={styles.remove}>Remove</Text></TouchableOpacity>
            </View>
          ))}
          {items.length === 0 && <Text style={styles.empty}>Cart is empty</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Checkout</Text>
          <TextInput style={styles.input} placeholder="Vehicle number (optional)" value={vehicleNumber} onChangeText={setVehicleNumber} />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Use Wallet</Text>
            <Switch value={useWallet} onValueChange={setUseWallet} />
          </View>
          <Text style={styles.total}>Subtotal: ₹{subtotal.toFixed(2)}</Text>
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
  card: { backgroundColor: COLORS.white, margin: SPACING.md, borderRadius: 10, padding: SPACING.md },
  label: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading, marginBottom: SPACING.sm },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, height: 44, paddingHorizontal: SPACING.md, color: COLORS.text, marginBottom: SPACING.sm },
  btn: { backgroundColor: COLORS.primary, borderRadius: 8, alignItems: 'center', paddingVertical: 12 },
  btnText: { color: '#FFF', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemTitle: { color: COLORS.textHeading, fontWeight: '600' },
  itemSub: { color: COLORS.textSecondary, fontSize: SIZES.xs },
  remove: { color: COLORS.danger, fontWeight: '700' },
  empty: { color: COLORS.textSecondary },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  switchLabel: { color: COLORS.textHeading, fontWeight: '600' },
  total: { color: COLORS.textHeading, fontWeight: '700', marginBottom: SPACING.sm },
  meta: { marginTop: SPACING.sm, color: COLORS.textSecondary, fontSize: SIZES.xs },
});

