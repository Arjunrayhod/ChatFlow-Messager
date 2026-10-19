import { AppState, Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { CallType } from '@chatflow/shared';
import { registerPushToken, unregisterPushToken } from './api';

let activeTitleInterval: any = null;
let originalDocumentTitle = 'ChatFlow';
const activeWebCallNotifications: Record<string, any> = {};

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

/** Initializes Android channels for max-importance incoming calls and messages. */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('incoming-calls', {
        name: 'Incoming calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch (e) {
      console.warn('[Push] Channel setup failed:', e);
    }
  }
}

/** Requests notification permissions on both Web and Mobile devices. */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') return true;
      if (Notification.permission !== 'denied') {
        const res = await Notification.requestPermission();
        return res === 'granted';
      }
    }
    return false;
  }

  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Registers this native device for Expo's FCM-backed push delivery. */
export async function registerForIncomingCallPush(authToken: string): Promise<void> {
  await setupNotificationChannels();
  const granted = await requestNotificationPermissions();
  if (!granted) {
    console.warn('[Push] Notification permission was not granted');
    return;
  }

  if (Platform.OS === 'web' || !Device.isDevice) return;

  const projectId = getEasProjectId();
  if (!projectId) {
    console.warn('[Push] EAS project ID is missing; link the project before building the APK');
    return;
  }

  try {
    const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await registerPushToken(authToken, pushToken, Platform.OS as 'ios' | 'android');
    console.log('[Push] Incoming-call notifications registered with token');
  } catch (err) {
    console.warn('[Push] Could not obtain push token:', err);
  }
}

export async function unregisterIncomingCallPush(authToken: string): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  const projectId = getEasProjectId();
  if (!projectId) return;
  try {
    const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await unregisterPushToken(authToken, pushToken);
  } catch {
    // Ignore
  }
}

/**
 * Triggers a persistent, high-visibility incoming call alert.
 * Works seamlessly whether the browser tab is hidden or minimized, or the phone screen is locked.
 */
export async function showIncomingCallNotification(payload: {
  callId: string;
  callerName: string;
  callerUsername: string;
  type: CallType;
  avatarUrl?: string | null;
}): Promise<void> {
  const { callId, callerName, callerUsername, type, avatarUrl } = payload;
  const callTypeLabel = type === 'video' ? 'Video' : 'Voice';
  const displayTitle = `📞 Incoming ${callTypeLabel} Call`;
  const displayBody = `${callerName || '@' + callerUsername} is calling you... Tap to answer!`;

  if (Platform.OS === 'web') {
    startTitleFlash(`📞 ${callerName} is calling...`);

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          const notif = new Notification(displayTitle, {
            body: displayBody,
            icon: avatarUrl || undefined,
            tag: `call_${callId}`,
            requireInteraction: true,
          });

          notif.onclick = () => {
            try {
              window.focus();
            } catch {}
            notif.close();
          };

          activeWebCallNotifications[callId] = notif;
        } catch (err) {
          console.warn('[Notification] Web Notification failed:', err);
        }
      }
    }
    return;
  }

  // Native Android/iOS
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: displayTitle,
        body: displayBody,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        channelId: 'incoming-calls',
        data: { type: 'incoming_call', callId },
      } as any,
      trigger: null,
    });
  } catch (err) {
    console.warn('[Notification] Native call notification failed:', err);
  }
}

/**
 * Shows an alert when a new message arrives from a contact while the user is outside that conversation.
 */
export async function showNewMessageNotification(payload: {
  chatId: string;
  senderName: string;
  senderUsername: string;
  content: string;
  type?: string;
}): Promise<void> {
  const { chatId, senderName, senderUsername, content, type } = payload;
  let preview = content;
  if (type === 'image') preview = '📷 Photo';
  else if (type === 'video') preview = '🎥 Video';
  else if (type === 'audio') preview = '🎤 Voice message';
  else if (type === 'document') preview = '📄 Document';
  else if (type === 'location') preview = '📍 Location';

  const title = senderName || `@${senderUsername}`;

  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined' && document.hidden) {
      startTitleFlash(`💬 ${title}: ${preview.substring(0, 20)}...`);
    }

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body: preview,
          tag: `msg_${chatId}`,
        });
        notif.onclick = () => {
          try {
            window.focus();
          } catch {}
          notif.close();
        };
      } catch (e) {
        console.warn('[Notification] Message notification failed:', e);
      }
    }
    return;
  }

  if (AppState.currentState !== 'active') {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: preview,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          channelId: 'messages',
          data: { type: 'chat_message', chatId },
        } as any,
        trigger: null,
      });
    } catch {}
  }
}

/** Dismisses active call notification and stops title flashing. */
export function dismissCallNotification(callId: string): void {
  stopTitleFlash();

  if (Platform.OS === 'web') {
    const notif = activeWebCallNotifications[callId];
    if (notif) {
      try {
        notif.close();
      } catch {}
      delete activeWebCallNotifications[callId];
    }
    return;
  }

  try {
    void Notifications.dismissAllNotificationsAsync();
  } catch {}
}

function startTitleFlash(alertText: string): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  stopTitleFlash();
  originalDocumentTitle = document.title || 'ChatFlow';
  let toggle = false;
  activeTitleInterval = setInterval(() => {
    document.title = toggle ? alertText : originalDocumentTitle;
    toggle = !toggle;
  }, 900);
}

function stopTitleFlash(): void {
  if (activeTitleInterval) {
    clearInterval(activeTitleInterval);
    activeTitleInterval = null;
  }
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.title = originalDocumentTitle;
  }
}

function getEasProjectId(): string | undefined {
  return Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId || process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
}
