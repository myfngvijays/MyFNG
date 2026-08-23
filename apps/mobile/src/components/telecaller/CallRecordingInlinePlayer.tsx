import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { supabase } from '../../lib/supabase';
import { ENV } from '../../config/environment';
import { COLORS } from '../../constants/theme';

/**
 * In-row call recording player (Activity timeline).
 * Loads audio via authenticated recording URL inside a compact WebView —
 * plays on this screen instead of opening an external browser.
 */
export default function CallRecordingInlinePlayer({
  callLogId,
  onClose,
}: {
  callLogId: string;
  onClose: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(true);
  const [webError, setWebError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingToken(true);
      setAuthError(null);
      setWebError(null);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        let access = session?.access_token || null;
        if (!access) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          access = refreshed.session?.access_token || null;
        }
        if (!cancelled) {
          if (!access) setAuthError('Sign in required to play recording.');
          setToken(access);
        }
      } catch {
        if (!cancelled) setAuthError('Could not load recording.');
      } finally {
        if (!cancelled) setLoadingToken(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [callLogId]);

  const srcUrl = useMemo(() => {
    if (!token || !callLogId) return null;
    return `${ENV.API_URL}/api/telecaller/calls/recording/${encodeURIComponent(
      callLogId,
    )}?access_token=${encodeURIComponent(token)}`;
  }, [token, callLogId]);

  const html = useMemo(() => {
    if (!srcUrl) return '';
    const safe = srcUrl
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  body { display: flex; align-items: center; justify-content: center; min-height: 44px; }
  audio { width: 100%; height: 40px; }
</style>
</head>
<body>
  <audio id="rec" controls autoplay playsinline preload="auto" src="${safe}"></audio>
  <script>
    var a = document.getElementById('rec');
    if (a) {
      a.addEventListener('error', function () {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage('error');
      });
    }
  </script>
</body>
</html>`;
  }, [srcUrl]);

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Text style={styles.label}>Recording</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.close}>Close</Text>
        </TouchableOpacity>
      </View>
      {loadingToken ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 8 }} />
      ) : authError ? (
        <Text style={styles.error}>{authError}</Text>
      ) : webError ? (
        <Text style={styles.error}>{webError}</Text>
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          style={styles.web}
          scrollEnabled={false}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          allowsFullscreenVideo={false}
          mixedContentMode="always"
          onMessage={(e) => {
            if (String(e?.nativeEvent?.data || '') === 'error') {
              setWebError('Recording play failed. Try again.');
            }
          }}
          onHttpError={() => setWebError('Recording load failed.')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5B21B6',
  },
  close: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  web: {
    height: 48,
    width: '100%',
    backgroundColor: 'transparent',
  },
  error: {
    fontSize: 12,
    color: '#B91C1C',
    marginVertical: 6,
  },
});
