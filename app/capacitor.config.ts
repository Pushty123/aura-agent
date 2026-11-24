import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.phoenix.aura',
  appName: 'AURA',
  webDir: 'dist',
  // No remote server URL on purpose: the app is bundled and works offline.
  android: { allowMixedContent: false },
};

export default config;
