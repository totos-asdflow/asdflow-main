import { Platform } from 'react-native';

let _Notifications: any = null;
let _Device: any = null;
function loadModules(): { Notifications: any; Device: any } | null {
  if (Platform.OS === 'web') return null;
  try {
    if (!_Notifications) _Notifications = require('expo-notifications');
    if (!_Device) _Device = require('expo-device');
    return { Notifications: _Notifications, Device: _Device };
  } catch {
    return null;
  }
}

export type PushResult = {
  token: string | null;
  reason?: 'web' | 'no-device' | 'denied' | 'expo-go-limit' | 'error';
};

export async function registerForPushNotifications(): Promise<PushResult> {
  if (Platform.OS === 'web') return { token: null, reason: 'web' };
  const mods = loadModules();
  if (!mods) return { token: null, reason: 'error' };
  const { Notifications, Device } = mods;

  if (!Device.isDevice) return { token: null, reason: 'no-device' };

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('sos', {
        name: 'SOS',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D98A6C',
        sound: 'default',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;
    if (existing.status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
    }
    if (finalStatus !== 'granted') return { token: null, reason: 'denied' };

    const tokenData = await Notifications.getExpoPushTokenAsync();
    return { token: tokenData.data };
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes('Expo Go') || msg.includes('development build')) {
      return { token: null, reason: 'expo-go-limit' };
    }
    console.log('push token err', msg);
    return { token: null, reason: 'error' };
  }
}

export function configureNotificationHandler() {
  const mods = loadModules();
  if (!mods) return;
  try {
    mods.Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowAlert: true,
      } as any),
    });
  } catch {}
}
