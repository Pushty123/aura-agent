import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.phoenix.aura',
  appName: 'AURA',
  webDir: 'dist',
  // The app is bundled (no remote web URL) and works offline. The account
  // server is called over the network; cleartext is allowed so the demo can
  // use a laptop on the same Wi-Fi. Use an https:// server in production.
  android: { allowMixedContent: true },
  server: { cleartext: true },
  plugins: {
    // Send fetch() through Android's own HTTP stack instead of the WebView, so
    // the WebView's CORS and mixed-content rules cannot block the account and
    // smart-reply calls to the server.
    CapacitorHttp: { enabled: true },
  },
};

export default config;
