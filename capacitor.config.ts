import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.podoprev.app',
  appName: 'PodoPrev',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_podoprev',
      iconColor: '#1565C0',
    },
  },
};

export default config;
