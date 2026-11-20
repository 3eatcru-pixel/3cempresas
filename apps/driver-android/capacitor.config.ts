const config = {
  appId: 'com.threec.driver',
  appName: '3C Driver',
  webDir: '../driver-web/dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    BackgroundGeolocation: {
      distanceFilter: 25,
      notificationTitle: '3C Driver — Rastreamento Ativo',
      notificationText: 'Compartilhando localização para entregas em andamento.',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
} as const;

export default config;
