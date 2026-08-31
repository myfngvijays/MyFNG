import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES } from '../../../constants/theme';
import { buildPickupMapsUrl } from '../../../lib/pickupNavigation';

export default function PickupInAppNavigateScreen(props: any) {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const hideChrome = !!(props as any)?.hideChrome;

  const params = route?.params || {};
  const mapsUrl =
    params.mapsUrl ||
    buildPickupMapsUrl({
      latitude: params.latitude,
      longitude: params.longitude,
      address: params.address,
    });

  const title = params.title || 'Navigation';

  const header = useMemo(
    () => (
      <View style={[styles.header, { paddingTop: hideChrome ? 8 : insets.top + 8 }]}>
        <TouchableOpacity onPress={() => (navigation as any).goBack?.()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {params.address ? (
            <Text style={styles.sub} numberOfLines={1}>
              {params.address}
            </Text>
          ) : null}
        </View>
      </View>
    ),
    [hideChrome, insets.top, navigation, params.address, title],
  );

  if (!mapsUrl) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <Text style={styles.errTitle}>Address missing</Text>
          <Text style={styles.errSub}>No location available for navigation.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <WebView
        source={{ uri: mapsUrl }}
        style={styles.web}
        startInLoadingState
        geolocationEnabled
        javaScriptEnabled
        domStorageEnabled
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loaderTxt}>Loading maps…</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  backBtn: { paddingVertical: 6, paddingRight: 8 },
  backTxt: { color: COLORS.primary, fontWeight: '800', fontSize: FONT_SIZES.md },
  title: { fontSize: FONT_SIZES.lg, fontWeight: '800', color: COLORS.heading },
  sub: { fontSize: FONT_SIZES.xs, color: COLORS.bodyText, marginTop: 2 },
  web: { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  loaderTxt: { marginTop: 8, color: COLORS.bodyText, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errTitle: { fontSize: 18, fontWeight: '800', color: COLORS.heading },
  errSub: { marginTop: 6, color: COLORS.bodyText, textAlign: 'center' },
});
