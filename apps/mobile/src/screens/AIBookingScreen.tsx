import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { ENV } from '../config/environment';
import { getCustomerSessionToken } from '../lib/customerSession';
import { trackEvent } from '../lib/trackEvent';

type Props = { navigation: any; route: any };

const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60;
const EXTERNAL_SCHEMES = /^(upi:|tez:|gpay:|phonepe:|paytmmp:|intent:)/i;

function buildMisaUrl(params?: { city?: string; prefill?: string }): string {
  const base = ENV.WEBSITE_URL.replace(/\/$/, '');
  const qs = new URLSearchParams();
  qs.set('app', '1');
  if (params?.city?.trim()) qs.set('city', params.city.trim());
  if (params?.prefill?.trim()) qs.set('prefill', params.prefill.trim());
  return `${base}/misa-ai?${qs.toString()}`;
}

function escapeJsString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

function buildBootstrapScript(token: string | null, city?: string): string {
  const lines: string[] = ['(function(){try{'];
  if (token) {
    lines.push(
      `document.cookie='customer_session=${escapeJsString(token)}; path=/; max-age=${SESSION_MAX_AGE_SEC}; SameSite=Lax';`
    );
  }
  if (city?.trim()) {
    const c = escapeJsString(city.trim());
    lines.push(`localStorage.setItem('detected_city','${c}');`);
    lines.push(`localStorage.setItem('detected_city_timestamp',String(Date.now()));`);
  }
  lines.push("}catch(e){}})();true;");
  return lines.join('');
}

function shouldOpenExternally(url: string): boolean {
  if (EXTERNAL_SCHEMES.test(url)) return true;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const siteHost = new URL(ENV.WEBSITE_URL).hostname.replace(/^www\./, '');
    if (host !== siteHost && /razorpay\.com|pay\.google\.com|phonepe\.com/i.test(host)) return true;
  } catch {
    // ignore malformed URLs
  }
  return false;
}

export default function AIBookingScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [bootReady, setBootReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const city = typeof route?.params?.city === 'string' ? route.params.city : undefined;
  const prefill = typeof route?.params?.prefill === 'string' ? route.params.prefill : undefined;

  const misaUrl = useMemo(() => buildMisaUrl({ city, prefill }), [city, prefill]);
  const bootstrapScript = useMemo(
    () => buildBootstrapScript(sessionToken, city),
    [sessionToken, city]
  );

  useEffect(() => {
    trackEvent('misa_opened');
    let active = true;
    (async () => {
      const token = await getCustomerSessionToken().catch(() => null);
      if (active) {
        setSessionToken(token);
        setBootReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleShouldStartLoad = useCallback((request: { url: string }) => {
    if (shouldOpenExternally(request.url)) {
      Linking.openURL(request.url).catch(() => null);
      return false;
    }
    return true;
  }, []);

  const handleNavChange = useCallback((nav: WebViewNavigation) => {
    if (nav.url && shouldOpenExternally(nav.url)) {
      webRef.current?.stopLoading();
      Linking.openURL(nav.url).catch(() => null);
    }
  }, []);

  const openInBrowser = useCallback(() => {
    Linking.openURL(misaUrl).catch(() => null);
  }, [misaUrl]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#071526" />
      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 8 }]}
        onPress={handleClose}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Close MISA AI"
      >
        <Ionicons name="close" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      {!bootReady ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#22D3EE" />
        </View>
      ) : failed ? (
        <View style={styles.loader}>
          <Ionicons name="cloud-offline-outline" size={44} color="#94A3B8" />
          <TouchableOpacity style={styles.retryBtn} onPress={() => setFailed(false)}>
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.browserBtn} onPress={openInBrowser}>
            <Ionicons name="open-outline" size={16} color="#E2E8F0" />
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          ref={webRef}
          source={{ uri: misaUrl }}
          style={styles.web}
          injectedJavaScriptBeforeContentLoaded={bootstrapScript}
          startInLoadingState
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          geolocationEnabled
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures
          originWhitelist={['https://*', 'http://*']}
          userAgent={
            Platform.OS === 'ios'
              ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 MyFNGApp/1.0'
              : 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 MyFNGApp/1.0'
          }
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          onNavigationStateChange={handleNavChange}
          renderLoading={() => (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#22D3EE" />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071526' },
  web: { flex: 1, backgroundColor: '#071526' },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#071526',
    gap: 16,
  },
  closeBtn: {
    position: 'absolute',
    right: 14,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 21, 38, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  retryBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
  },
  browserBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
});
