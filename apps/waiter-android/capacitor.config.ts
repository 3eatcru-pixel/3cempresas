const config = {
  appId: 'com.threec.waiter',
  appName: '3C Waiter',
  webDir: '../waiter-web/dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    BarcodeScanner: {
      purpose: 'Pareamento BYOD e leitura de QR Code do 3C Edge Node LAN',
    },
    BluetoothPrinter: {
      protocol: 'ESC_POS',
    },
  },
} as const;

export default config;
