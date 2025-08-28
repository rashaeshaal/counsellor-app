import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myapp.counsellor',
  appName: 'counsellor-frontend',
  webDir: 'www',
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['phone']
    },
    Keyboard: {
      resize: 'ionic',
      style: 'default',
    }
  }
};

export default config;
