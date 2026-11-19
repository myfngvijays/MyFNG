import React, { useCallback, useEffect, useRef } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

/** Partner brand blue, shown until the first video frame. */
const SPLASH_BG = '#021E6F';
const VIDEO = require('../../assets/partner-splash.mp4');
/** Leave the splash if the file never starts, instead of blocking login. */
const START_TIMEOUT_MS = 8000;

type Props = {
  onComplete: () => void;
};

/**
 * Partner intro. The release APK plays this with the native player.
 * A WebView cannot load the bundled file, which left testers on a blue screen.
 */
export default function PartnerSplashScreen({ onComplete }: Props) {
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
