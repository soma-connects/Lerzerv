import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lezerv.app',
  appName: 'Lezerv',
  webDir: 'dist',
  // Load the local bundle over HTTPS scheme so Supabase auth cookies /
  // secure-context APIs behave the same as on the web.
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0f0f0f',
      showSpinner: false,
    },
  },
};

export default config;
