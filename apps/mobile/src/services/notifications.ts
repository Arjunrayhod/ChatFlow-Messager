import { AppState, Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { registerPushToken, unregisterPushToken } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => {
    const inForeground = AppState.currentState === 'active';
    return {
      shouldShowAlert: !inForeground,
      shouldPlaySound: !inForeground,
      shouldSetBadge: false,
    };
  },
});

/** Registers this native device for Expo's FCM-backed push delivery. */
export async function registerForIncomingCallPush(authToken: string): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('incoming-calls', {
      name: 'Incoming calls',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500],
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') {
    console.warn('[Push] Notification permission was not granted');
    return;
  }

  const projectId = getEasProjectId();
  if (!projectId) {
    console.warn('[Push] EAS project ID is missing; link the project before building the APK');
    return;
  }

  const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await registerPushToken(authToken, pushToken, Platform.OS as 'ios' | 'android');
  console.log('[Push] Incoming-call notifications registered');
}

export async function unregisterIncomingCallPush(authToken: string): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  const projectId = getEasProjectId();
  if (!projectId) return;
  const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await unregisterPushToken(authToken, pushToken);
}

function getEasProjectId(): string | undefined {
  return Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId || process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
}
