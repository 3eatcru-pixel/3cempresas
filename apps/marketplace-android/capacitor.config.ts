const config = {
  appId: 'com.threec.marketplace',
  appName: '3C Marketplace',
  webDir: '../marketplace-web/dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchAutoHide: true,
    },
  },
} as const;

export default config;
