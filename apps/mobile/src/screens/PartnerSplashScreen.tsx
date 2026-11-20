import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StatusBar, StyleSheet, View } from 'react-native';
import { Asset } from 'expo-asset';
import { WebView } from 'react-native-webview';

/** Partner brand blue, shown until the first video frame. */
const SPLASH_BG = '#021E6F';
const VIDEO = require('../../assets/partner-splash.mp4');
/** Leave the splash if the file never starts, instead of blocking login. */
const START_TIMEOUT_MS = 12000;

type Props = {
  onComplete: () => void;
};

type ExpoVideoModule = {
  useVideoPlayer: (
    source: number,
    setup: (player: {
      loop: boolean;
      muted: boolean;
      play: () => void;
      addListener: (event: string, cb: (payload?: { status?: string }) => void) => { remove: () => void };
    }) => void,
  ) => {
    addListener: (event: string, cb: (payload?: { status?: string }) => void) => { remove: () => void };
  };
  VideoView: React.ComponentType<{
    player: unknown;
    style?: object;
    contentFit?: 'cover';
    nativeControls?: boolean;
    allowsFullscreen?: boolean;
    surfaceType?: 'textureView';
  }>;
};

/** This simulator binary was built before ExpoVideo. Do not crash the app on import. */
function loadExpoVideo(): ExpoVideoModule | null {
  try {
    return require('expo-video') as ExpoVideoModule;
  } catch {
    return null;
  }
}

const expoVideo = loadExpoVideo();

function splashHtml(uri: string) {
  const src = uri.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin:0; padding:0; width:100%; height:100%; background:${SPLASH_BG}; overflow:hidden; }
  video { position:fixed; inset:0; width:100%; height:100%; object-fit:cover; background:${SPLASH_BG}; }
</style>
</head>
<body>
<video id="v" autoplay muted playsinline webkit-playsinline src="${src}"></video>
<script>
  var v = document.getElementById('v');
  function done(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
  }
  var reported = false;
  function reportPlaying() {
    if (reported) return;
    reported = true;
    try { v.muted = false; } catch (e) {}
    var ms = Math.round((v.duration || 4) * 1000);
    done('playing:' + ms);
  }
  v.addEventListener('playing', reportPlaying);
  v.addEventListener('timeupdate', function () {
    if (v.currentTime > 0.05) reportPlaying();
  });
  v.addEventListener('ended', function () { done('ended'); });
  v.addEventListener('error', function () { done('error'); });
  function tryPlay() {
    var play = v.play();
    if (play && play.catch) play.catch(function () { done('error'); });
  }
  tryPlay();
</script>
</body>
</html>`;
}

/**
 * Partner intro. Release builds play this with expo-video.
 * The current simulator binary has no ExpoVideo module, so the same file plays in the WebView that is already installed.
 */
export default function PartnerSplashScreen({ onComplete }: Props) {
  if (expoVideo) return <SplashVideo onComplete={onComplete} />;
  return <SplashWeb onComplete={onComplete} />;
}

function SplashWeb({ onComplete }: Props) {
  const done = useRef(false);
  const started = useRef(false);
  const playTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onCompleteRef.current();
  }, []);
  const [page, setPage] = useState<{ html?: string; uri?: string; readUrl?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let fileUri = '';
      try {
        const asset = Asset.fromModule(VIDEO);
        if (!asset.localUri) await asset.downloadAsync();
        fileUri = asset.localUri || asset.uri || '';
      } catch {
        fileUri = '';
      }
      if (!fileUri) fileUri = Image.resolveAssetSource(VIDEO)?.uri || '';
      if (cancelled) return;
      if (!fileUri) {
        finish();
        return;
      }
      // WKWebView only plays a bundled clip when the page base is the file's own folder.
      if (fileUri.startsWith('file://')) {
        const slash = fileUri.lastIndexOf('/') + 1;
        const readUrl = fileUri.slice(0, slash);
        const fileName = fileUri.slice(slash);
        setPage({ html: splashHtml(fileName), readUrl });
        return;
      }
      setPage({ html: splashHtml(fileUri) });
    })();
    return () => {
      cancelled = true;
    };
  }, [finish]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!started.current) finish();
    }, START_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
      if (playTimer.current) clearTimeout(playTimer.current);
    };
  }, [finish]);

  return (
    <View style={styles.root}>
      <StatusBar hidden backgroundColor={SPLASH_BG} barStyle="light-content" />
      {page?.html ? (
        <WebView
          originWhitelist={['*']}
          source={{ html: page.html, baseUrl: page.readUrl }}
          allowingReadAccessToURL={page.readUrl}
          style={styles.video}
          containerStyle={styles.video}
          scrollEnabled={false}
          bounces={false}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          allowsFullscreenVideo={false}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          mixedContentMode="always"
          androidLayerType="hardware"
          setSupportMultipleWindows={false}
          onMessage={(event) => {
            const data = event.nativeEvent.data || '';
            if (data === 'ended' || data === 'error') {
              finish();
              return;
            }
            if (!data.startsWith('playing:') || started.current) return;
            started.current = true;
            const lengthMs = Number(data.slice('playing:'.length)) || 4000;
            if (playTimer.current) clearTimeout(playTimer.current);
            playTimer.current = setTimeout(finish, lengthMs + 250);
          }}
        />
      ) : null}
    </View>
  );
}

function SplashVideo({ onComplete }: Props) {
  const { useVideoPlayer, VideoView } = expoVideo as ExpoVideoModule;
  const done = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onCompleteRef.current();
  }, []);

  const player = useVideoPlayer(VIDEO, (next) => {
    next.loop = false;
    next.muted = false;
    next.play();
  });

  useEffect(() => {
    const endSub = player.addListener('playToEnd', finish);
    const statusSub = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') finish();
    });
    const timer = setTimeout(finish, START_TIMEOUT_MS);
    return () => {
      endSub.remove();
      statusSub.remove();
      clearTimeout(timer);
    };
  }, [finish, player]);

  return (
    <View style={styles.root}>
      <StatusBar hidden backgroundColor={SPLASH_BG} barStyle="light-content" />
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        surfaceType="textureView"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SPLASH_BG,
  },
  video: {
    flex: 1,
    backgroundColor: SPLASH_BG,
  },
});
