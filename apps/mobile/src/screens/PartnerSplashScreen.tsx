import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Image, StatusBar, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

/** First frame of the partner splash video. */
const SPLASH_BG = '#021E6F';
const VIDEO = require('../../assets/partner-splash.mp4');
/** If the file never starts, leave the splash instead of blocking login. */
const START_TIMEOUT_MS = 12000;

type Props = {
  onComplete: () => void;
};

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
<video id="v" autoplay playsinline webkit-playsinline src="${src}"></video>
<script>
  var v = document.getElementById('v');
  function done(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
  }
  var reported = false;
  function reportPlaying() {
    if (reported) return;
    reported = true;
    var ms = Math.round((v.duration || 3.6) * 1000);
    done('playing:' + ms);
  }
  v.addEventListener('playing', reportPlaying);
  v.addEventListener('timeupdate', function () {
    if (v.currentTime > 0.05) reportPlaying();
  });
  v.addEventListener('ended', function () { done('ended'); });
  function tryPlay(allowMute) {
    var play = v.play();
    if (play && play.catch) {
      play.catch(function () {
        if (!allowMute) return;
        v.muted = true;
        tryPlay(false);
      });
    }
  }
  tryPlay(true);
</script>
</body>
</html>`;
}

/**
 * Partner intro. Uses the WebView already in the binary so the current
 * simulator build can play the video without the ExpoVideo native module.
 */
export default function PartnerSplashScreen({ onComplete }: Props) {
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

  const html = useMemo(() => {
    const uri = Image.resolveAssetSource(VIDEO)?.uri || '';
    return splashHtml(uri);
  }, []);

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
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        containerStyle={styles.web}
        scrollEnabled={false}
        bounces={false}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        allowsFullscreenVideo={false}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
        onMessage={(event) => {
          const data = event.nativeEvent.data || '';
          if (data === 'ended') {
            finish();
            return;
          }
          if (!data.startsWith('playing:') || started.current) return;
          started.current = true;
          const lengthMs = Number(data.slice('playing:'.length)) || 3600;
          if (playTimer.current) clearTimeout(playTimer.current);
          playTimer.current = setTimeout(finish, lengthMs + 300);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SPLASH_BG,
  },
  web: {
    flex: 1,
    backgroundColor: SPLASH_BG,
  },
});
