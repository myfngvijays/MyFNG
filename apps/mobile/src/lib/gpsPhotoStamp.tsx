import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { isIosSimulator, isAndroidEmulator } from '../config/environment';

export type GpsStampMeta = {
  address: string;
  latitude: number;
  longitude: number;
  localTime: string;
  dateLine: string;
  altitude?: number | null;
};

let pendingStamp: {
  uri: string;
  resolve: (uri: string) => void;
  reject: (err: Error) => void;
} | null = null;

export async function fetchGpsStampMeta(): Promise<GpsStampMeta> {
  const now = new Date();
  const localTime = now.toLocaleTimeString('en-IN', { hour12: false });
  const dateLine = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  let latitude = 0;
  let longitude = 0;
  let altitude: number | null = null;
  let address = 'Location unavailable';

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
      altitude = pos.coords.altitude;

      try {
        const places = await Location.reverseGeocodeAsync({ latitude, longitude });
        const p = places?.[0];
        if (p) {
          const parts = [p.name, p.street, p.district, p.city, p.region, p.postalCode, p.country]
            .filter(Boolean)
            .map(String);
          const unique = [...new Set(parts)];
          if (unique.length) address = unique.join(', ');
        }
      } catch {
        address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      }
    }
  } catch {
    // keep defaults
  }

  return { address, latitude, longitude, localTime, dateLine, altitude };
}

function formatCoord(lat: number, lng: number) {
  return {
    lat: `${Math.abs(lat).toFixed(6)}° ${lat >= 0 ? 'N' : 'S'}`,
    lng: `${Math.abs(lng).toFixed(6)}° ${lng >= 0 ? 'E' : 'W'}`,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildStampHtml(imageDataUrl: string, meta: GpsStampMeta): string {
  const coords = formatCoord(meta.latitude, meta.longitude);
  const altText =
    meta.altitude != null ? `Alt ${Math.round(meta.altitude)} m` : 'MY FNG Pickup';

  return `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;background:#000;">
<script>
  const img = new Image();
  img.onload = function () {
    try {
      const maxW = Math.min(1080, img.width || 1080);
      const scale = maxW / (img.width || maxW);
      const iw = Math.max(1, Math.round((img.width || maxW) * scale));
      const ih = Math.max(1, Math.round((img.height || maxW) * scale));
      const bannerH = 148;
      const canvas = document.createElement('canvas');
      canvas.width = iw;
      canvas.height = ih + bannerH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, iw, ih);
      ctx.fillStyle = 'rgba(0,0,0,0.74)';
      ctx.fillRect(0, ih, iw, bannerH);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(${JSON.stringify(meta.address.slice(0, 120))}, 14, ih + 28);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.fillText('Latitude', 14, ih + 52);
      ctx.fillText('Longitude', iw / 2 + 8, ih + 52);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(${JSON.stringify(coords.lat)}, 14, ih + 72);
      ctx.fillText(${JSON.stringify(coords.lng)}, iw / 2 + 8, ih + 72);
      ctx.font = '12px sans-serif';
      ctx.fillText('Local ${escapeHtml(meta.localTime)}', 14, ih + 96);
      ctx.fillText(${JSON.stringify(altText)}, iw / 2 + 8, ih + 96);
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(${JSON.stringify(meta.dateLine)}, 14, ih + 122);
      window.ReactNativeWebView.postMessage(canvas.toDataURL('image/jpeg', 0.88));
    } catch (e) {
      window.ReactNativeWebView.postMessage('ERROR:' + (e && e.message ? e.message : 'stamp_failed'));
    }
  };
  img.onerror = function () {
    window.ReactNativeWebView.postMessage('ERROR:image_load');
  };
  img.src = ${JSON.stringify(imageDataUrl)};
</script>
</body></html>`;
}

async function uriToDataUrl(uri: string): Promise<string> {
  const lower = uri.toLowerCase();
  if (lower.startsWith('data:')) return uri;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const ext = lower.includes('.png') ? 'png' : 'jpeg';
  return `data:image/${ext};base64,${base64}`;
}

async function dataUrlToFile(dataUrl: string): Promise<string> {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const path = `${FileSystem.cacheDirectory}gps-stamp-${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

export function stampPhotoWithGps(imageUri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (pendingStamp) {
      reject(new Error('Another photo is being stamped'));
      return;
    }
    pendingStamp = { uri: imageUri, resolve, reject };
  });
}

function GpsStampWebJob({
  uri,
  meta,
  onDone,
  onError,
}: {
  uri: string;
  meta: GpsStampMeta;
  onDone: (outUri: string) => void;
  onError: (err: Error) => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const finished = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const dataUrl = await uriToDataUrl(uri);
        if (!cancelled) setHtml(buildStampHtml(dataUrl, meta));
      } catch (e: any) {
        if (!cancelled) onError(e instanceof Error ? e : new Error(String(e)));
      }
    })();
    const timer = setTimeout(() => {
      if (!finished.current) onError(new Error('GPS stamp timed out'));
    }, 20000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [uri, meta, onError]);

  const handleMessage = async (raw: string) => {
    if (finished.current) return;
    if (raw.startsWith('ERROR:')) {
      finished.current = true;
      onError(new Error(raw.replace('ERROR:', '') || 'GPS stamp failed'));
      return;
    }
    try {
      finished.current = true;
      const out = await dataUrlToFile(raw);
      onDone(out);
    } catch (e: any) {
      onError(e instanceof Error ? e : new Error(String(e)));
    }
  };

  if (!html) return null;

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      onMessage={(e) => void handleMessage(e.nativeEvent.data)}
      style={styles.webview}
      javaScriptEnabled
    />
  );
}

export function GpsStampHost() {
  const [job, setJob] = useState<{ uri: string; meta: GpsStampMeta } | null>(null);

  useEffect(() => {
    if (!pendingStamp || job) return;
    void (async () => {
      const current = pendingStamp;
      if (!current) return;
      try {
        const meta = await fetchGpsStampMeta();
        setJob({ uri: current.uri, meta });
      } catch (e: any) {
        current.reject(e instanceof Error ? e : new Error(String(e)));
        pendingStamp = null;
      }
    })();
  }, [job]);

  const finish = useMemo(
    () => ({
      done: (outUri: string) => {
        pendingStamp?.resolve(outUri);
        pendingStamp = null;
        setJob(null);
      },
      fail: (err: Error) => {
        pendingStamp?.reject(err);
        pendingStamp = null;
        setJob(null);
      },
    }),
    [],
  );

  if (!job) return null;

  return (
    <View pointerEvents="none" style={styles.host}>
      <GpsStampWebJob uri={job.uri} meta={job.meta} onDone={finish.done} onError={finish.fail} />
    </View>
  );
}

async function pickFromGallery(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') throw new Error('Gallery permission required');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.92,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return stampPhotoWithGps(result.assets[0].uri);
}

async function pickFromCamera(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') throw new Error('Camera permission required');
  try {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.92,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return stampPhotoWithGps(result.assets[0].uri);
  } catch {
    return pickFromGallery();
  }
}

export async function takeGpsStampedPhoto(): Promise<string | null> {
  if (Platform.OS === 'web' || isIosSimulator() || isAndroidEmulator()) {
    return pickFromGallery();
  }

  return new Promise((resolve) => {
    Alert.alert('Add photo', 'Take a new photo or choose from gallery', [
      {
        text: 'Camera',
        onPress: () => {
          void pickFromCamera().then(resolve).catch(() => resolve(null));
        },
      },
      {
        text: 'Gallery',
        onPress: () => {
          void pickFromGallery().then(resolve).catch(() => resolve(null));
        },
      },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    left: -9999,
    top: 0,
    overflow: 'hidden',
  },
  webview: {
    width: 360,
    height: 640,
    backgroundColor: 'transparent',
  },
});
