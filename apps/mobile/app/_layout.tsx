/**
 * @file Expo Router root layout with theme tokens and safe area wrappers.
 * 
 * [HINGLISH GUIDE]:
 * Yeh poori mobile/web app ka ROOT LAYOUT hai.
 * 1. SafeAreaProvider: Mobile ki notch aur bottom navigation bar se content bachata hai.
 * 2. Theme: User ke system setting ke hisaab se automatic Dark/Light mode set karta hai.
 * 3. Stack Navigation: Expo Router ka stack navigator yahan configure hota hai.
 */

import '../src/utils/startupPatch';
import React, { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, Platform, PermissionsAndroid, View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../src/theme/tokens';
import { useAuthStore } from '../src/store/useAuthStore';
import { useCallStore } from '../src/store/useCallStore';
import { useChatStore } from '../src/store/useChatStore';
import { IncomingCallModal } from '../src/components/molecules/IncomingCallModal';
import { ActiveCallModal } from '../src/components/molecules/ActiveCallModal';
import { MediaPermissionPrompt } from '../src/components/molecules/MediaPermissionPrompt';
import { webrtcService } from '../src/services/webrtc';
import { getSocket, connectSocket } from '../src/services/socket';
import * as Notifications from 'expo-notifications';
import {
  registerForIncomingCallPush,
  showNewMessageNotification,
} from '../src/services/notifications';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Caught render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaProvider>
          <View style={{ flex: 1, backgroundColor: '#121b22', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <Text style={{ color: '#00a884', fontSize: 24, fontWeight: '700', marginBottom: 12 }}>
              ChatFlow
            </Text>
            <Text style={{ color: '#e9edef', fontSize: 16, textAlign: 'center', marginBottom: 8 }}>
              Something went wrong while launching the screen.
            </Text>
            <Text style={{ color: '#8696a0', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>
              {this.state.error?.message || 'Please reopen the app.'}
            </Text>
            {this.state.error?.stack ? (
              <ScrollView style={{ maxHeight: 150, width: '100%', backgroundColor: '#1f2c34', padding: 10, borderRadius: 8, marginBottom: 16 }}>
                <Text style={{ color: '#ff6b6b', fontSize: 10, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier' }}>
                  {this.state.error.stack.split('\n').slice(0, 8).join('\n')}
                </Text>
              </ScrollView>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Pressable
                onPress={() => this.setState({ hasError: false, error: null })}
                style={{ backgroundColor: '#00a884', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24 }}
              >
                <Text style={{ color: '#121b22', fontWeight: '700' }}>Retry</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  this.setState({ hasError: false, error: null });
                  try { router.replace('/(auth)/sign-in'); } catch {}
                }}
                style={{ backgroundColor: '#1f2c34', borderWidth: 1, borderColor: '#00a884', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24 }}
              >
                <Text style={{ color: '#00a884', fontWeight: '700' }}>Open Sign In</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaProvider>
      );
    }
    return this.props.children;
  }
}

/**
 * Root application navigation stack layout.
 * [HINGLISH]: Root stack screens aur unke header styles define karta hai.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const token = useAuthStore((state) => state.token);
  const initCallListeners = useCallStore((state) => state.initCallListeners);
  const handleIncomingCallPush = useCallStore((state) => state.handleIncomingCallPush);

  // Preload vector icons in background safely without blocking UI
  useEffect(() => {
    const loadIcons = async () => {
      try {
        await Font.loadAsync({
          ...Ionicons.font,
        });
      } catch (err) {
        console.warn('[Fonts] Background font preload suppressed:', err);
      }
    };
    void loadIcons();
  }, []);

  // Initialize WebRTC calling socket listeners
  useEffect(() => {
    if (token) {
      initCallListeners(token);
      void registerForIncomingCallPush(token).catch((error) => {
        console.warn('[Push] Could not register this device:', error);
      });
    }
  }, [token, initCallListeners]);

  useEffect(() => {
    if (!token) return;
    const openIncomingCall = (response: Notifications.NotificationResponse | null) => {
      if (response?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const data = response.notification.request.content.data as { type?: string; callId?: string };
      if (data.type === 'incoming_call' && data.callId) {
        void handleIncomingCallPush(token, data.callId);
      }
    };
    let subscription: { remove: () => void } | null = null;
    try {
      subscription = Notifications.addNotificationResponseReceivedListener(openIncomingCall);
      void Notifications.getLastNotificationResponseAsync().then(openIncomingCall).catch(() => {});
    } catch (err) {
      console.warn('[Push] Notification listener setup failed safely:', err);
    }
    return () => {
      try { subscription?.remove(); } catch {}
    };
  }, [token, handleIncomingCallPush]);

  // Global real-time incoming message notification listener
  useEffect(() => {
    if (!token) return;
    const socket = getSocket() || connectSocket(token);
    if (!socket) return;

    const onGlobalMessage = (payload: { message: any }) => {
      const msg = payload?.message;
      if (!msg) return;

      const currentUserId = useAuthStore.getState().user?.id;
      if (!currentUserId) return;

      // Update in-memory chat list ordering and unread badge count
      useChatStore.getState().updateContactOnMessage(msg, currentUserId);

      // If message is from another user, notify if app is hidden or not actively inside this chat
      if (msg.senderId !== currentUserId) {
        const activeChatId = useChatStore.getState().activeChatId;
        const isDifferentChat = activeChatId !== msg.chatId;
        const isPageHidden = Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden;

        if (isDifferentChat || isPageHidden) {
          const contact = useChatStore.getState().contacts.find((c) => c.contactUserId === msg.senderId);
          const senderName = contact?.nickname || contact?.user?.displayName || (contact?.user?.username ? `@${contact.user.username}` : 'New message');
          const senderUsername = contact?.user?.username || '';
          void showNewMessageNotification({
            chatId: msg.chatId,
            senderName,
            senderUsername,
            content: msg.content || '',
            type: msg.type,
          });
        }
      }
    };

    socket.on('message_new', onGlobalMessage);
    return () => {
      socket.off('message_new', onGlobalMessage);
    };
  }, [token]);

  // Ask native users for the camera and microphone permissions once the app
  // session is ready. Web permission requests are handled by a user-tap prompt.
  useEffect(() => {
    if (!token) return;

    const requestNativeMediaPermissions = async () => {
      try {
        if (Platform.OS === 'android') {
          const rationale = {
            title: 'ChatFlow camera and microphone',
            message: 'Voice/video calls and camera features ke liye Camera aur Microphone allow karein.',
            buttonPositive: 'Allow',
            buttonNegative: 'Not now',
          };
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, rationale);
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, rationale);
        } else if (Platform.OS === 'ios') {
          const stream = await webrtcService.getLocalMedia('video');
          stream?.getTracks().forEach((track: any) => track.stop());
        }
      } catch (error) {
        console.warn('[Permissions] Could not request media permissions:', error);
      }
    };

    void requestNativeMediaPermissions();
  }, [token]);

  // [HINGLISH]: Web par zoom, pinch aur double-tap zoom rokne ke liye event listeners
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
      // 0. Update viewport meta tag dynamically to enforce user-scalable=no
      try {
        let meta = document.querySelector('meta[name="viewport"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', 'viewport');
          document.head.appendChild(meta);
        }
        meta.setAttribute(
          'content',
          'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no, viewport-fit=cover'
        );

        // Inject anti-zoom CSS styles
        const styleId = 'chatflow-anti-zoom';
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.innerHTML = `
            html, body {
              touch-action: pan-x pan-y !important;
              -webkit-touch-callout: none !important;
              -webkit-text-size-adjust: 100% !important;
              overscroll-behavior: none !important;
              user-select: none !important;
              -webkit-user-select: none !important;
            }
            input, textarea {
              user-select: text !important;
              -webkit-user-select: text !important;
              font-size: 16px !important;
              touch-action: manipulation !important;
            }
            button {
              touch-action: manipulation !important;
            }
          `;
          document.head.appendChild(style);
        }
      } catch {
        // Fallthrough in SSR
      }

      // 1. Prevent Ctrl/Cmd + MouseWheel zoom
      const handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
        }
      };

      // 2. Prevent Ctrl + '+', '-', '0' keyboard zoom
      const handleKeyDown = (e: KeyboardEvent) => {
        if (
          (e.ctrlKey || e.metaKey) &&
          (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')
        ) {
          e.preventDefault();
        }
      };

      // 3. Prevent Safari / iOS gesture zoom
      const preventGesture = (e: Event) => {
        e.preventDefault();
      };

      // 4. Prevent double-tap zoom on touch screens
      let lastTouchEnd = 0;
      const handleTouchEnd = (e: TouchEvent) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      };

      window.addEventListener('wheel', handleWheel, { passive: false });
      window.addEventListener('keydown', handleKeyDown);
      document.addEventListener('gesturestart', preventGesture, { passive: false });
      document.addEventListener('gesturechange', preventGesture, { passive: false });
      document.addEventListener('gestureend', preventGesture, { passive: false });
      document.addEventListener('touchend', handleTouchEnd, { passive: false });

      return () => {
        window.removeEventListener('wheel', handleWheel);
        window.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('gesturestart', preventGesture);
        document.removeEventListener('gesturechange', preventGesture);
        document.removeEventListener('gestureend', preventGesture);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, []);

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: theme.surface,
            },
            headerTintColor: theme.textPrimary,
            headerTitleStyle: {
              ...tokens.typography.h2,
            },
            contentStyle: {
              backgroundColor: theme.background,
            },
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: 'ChatFlow Gateway',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="(auth)"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="chat/[id]"
            options={{
              headerShown: true,
            }}
          />
        </Stack>
        <IncomingCallModal />
        <ActiveCallModal />
        <MediaPermissionPrompt enabled={Boolean(token)} />
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
