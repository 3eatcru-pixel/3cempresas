const config = {
  appId: 'com.threec.store',
  appName: '3C Store OS Tablet',
  webDir: '../store-web/dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    BluetoothPrinter: {
      protocol: 'ESC_POS',
    },
    SplashScreen: {
      launchAutoHide: true,
    },
  },
} as const;

export default config;
