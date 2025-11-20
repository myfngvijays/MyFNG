module.exports = {
  name: 'MyFNG',
  slug: 'myfng',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  platforms: ['ios', 'android', 'web'],
  splash: {
    resizeMode: 'contain',
    backgroundColor: '#0088E8'
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.myfng.app'
  },
  android: {
    package: 'com.myfng.app',
    adaptiveIcon: {
      backgroundColor: '#0088E8'
    }
  }
};
