import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { COLORS } from '../../constants/theme';

type Props = {
  navigation: any;
  route: any;
};

export default function SmartToolWebScreen({ navigation, route }: Props) {
  const title: string = route?.params?.title || 'Smart Tool';
  const baseUrl: string = route?.params?.url || 'https://myfng.in';
  const useLocation: boolean = route?.params?.useLocation === true;
  const [url, setUrl] = useState(baseUrl);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!useLocation) {
      setUrl(baseUrl);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const { latitude, longitude } = loc.coords;
          setUrl(`https://www.google.com/maps/search/parking+near+me/@${latitude},${longitude},15z`);
        } else {
          setUrl('https://www.google.com/maps/search/parking+near+me');
        }
      } catch {
        setUrl('https://www.google.com/maps/search/parking+near+me');
      } finally {
        setLoading(false);
      }
    })();
  }, [useLocation, baseUrl]);

  const openExternal = () => {
    Linking.openURL(url).catch(() => null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={20} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <TouchableOpacity style={styles.extBtn} onPress={openExternal}>
          <Ionicons name="open-outline" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loaderText}>Loading...</Text>
        </View>
      ) : failed ? (
        <View style={styles.loader}>
          <Ionicons name="cloud-offline-outline" size={42} color="#9CA3AF" />
          <Text style={styles.failTitle}>Unable to load in app</Text>
          <TouchableOpacity style={styles.openBtn} onPress={openExternal}>
            <Text style={styles.openBtnText}>Open in Browser</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          source={{ uri: url }}
          style={styles.web}
          startInLoadingState
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          setSupportMultipleWindows={false}
          originWhitelist={['https://*', 'http://*']}
          userAgent={
            Platform.OS === 'ios'
              ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
              : 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
          }
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
          renderLoading={() => (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 17, fontWeight: '900', color: '#111827' },
  extBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  web: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loaderText: { fontSize: 13, fontWeight: '600', color: COLORS.gray[600] },
  failTitle: { fontSize: 15, fontWeight: '800', color: '#374151' },
  openBtn: { marginTop: 8, backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  openBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
});
