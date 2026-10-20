import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { Text } from '../atoms/Text';

const SESSION_KEY = 'chatflow-media-permission-prompted';

export function MediaPermissionPrompt({ enabled }: { enabled: boolean }) {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSecureContext = typeof window !== 'undefined' && window.isSecureContext;

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined') return;

    let cancelled = false;
    const inspectPermission = async () => {
      try {
        if (window.sessionStorage.getItem(SESSION_KEY)) return;

        const permissions = navigator.permissions;
        let micGranted = false;
        let camGranted = false;
        if (permissions?.query) {
          try {
            const [microphone, camera] = await Promise.all([
              permissions.query({ name: 'microphone' as PermissionName }),
              permissions.query({ name: 'camera' as PermissionName }),
            ]);
            micGranted = microphone.state === 'granted';
            camGranted = camera.state === 'granted';
          } catch {}
        }
        const notifGranted = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission === 'granted' : true;

        if (!cancelled && micGranted && camGranted && notifGranted) {
          window.sessionStorage.setItem(SESSION_KEY, '1');
          return;
        }
      } catch {
        // Some browsers do not expose camera/microphone permission state.
      }

      if (!cancelled) setVisible(true);
    };

    void inspectPermission();
    return () => { cancelled = true; };
  }, [enabled]);

  const dismiss = useCallback(() => {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(SESSION_KEY, '1');
    setVisible(false);
  }, []);

  const requestMedia = useCallback(async () => {
    setError(null);
    if (!isSecureContext) {
      setError('Browser local IP/HTTP par camera aur mic block karta hai. PC par http://localhost:8081 kholen; phone par HTTPS link use karein.');
      return;
    }

    try {
      // 1. Request Notification Permission
      if (typeof window !== 'undefined' && 'Notification' in window) {
        try {
          const res = await Notification.requestPermission();
          console.log('[MediaPermissionPrompt] Notification permission result:', res);
          if (res === 'granted' && 'serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification('ChatFlow Notifications Active 🔔', {
              body: 'Aapko incoming calls aur messages ke alerts phone ke notification bar me milenge!',
              icon: '/icon-192.png',
              badge: '/icon-192.png',
            });
          }
        } catch (notifErr) {
          console.warn('[MediaPermissionPrompt] Notification request failed:', notifErr);
        }
      }

      // 2. Request Camera & Mic
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          stream.getTracks().forEach((track) => track.stop());
        } catch (mediaErr) {
          console.warn('[MediaPermissionPrompt] Media stream request optional error:', mediaErr);
        }
      }

      dismiss();
    } catch (reason) {
      console.warn('[MediaPermissionPrompt] Permission request failed:', reason);
      setError('Permission allow nahi hui. Browser site settings mein Camera, Microphone, aur Notifications ko Allow karein.');
    }
  }, [dismiss, isSecureContext]);

  if (Platform.OS !== 'web') return null;

  return (
    <Modal visible={enabled && visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.iconMark}>
            <Ionicons name="shield-checkmark" size={28} color={tokens.colors.dark.primary} />
          </View>
          <Text variant="h2" style={styles.title}>Permissions for ChatFlow</Text>
          <Text variant="body" style={styles.description}>
            Calls, background alerts, and incoming notifications ke liye in permissions ki zaroorat hai.
          </Text>

          <View style={styles.permissionRow}>
            <Ionicons name="notifications-outline" size={19} color={tokens.colors.dark.primary} />
            <Text variant="body" style={styles.rowText}>Notifications for incoming calls & messages</Text>
          </View>
          <View style={styles.permissionRow}>
            <Ionicons name="mic-outline" size={19} color={tokens.colors.dark.primary} />
            <Text variant="body" style={styles.rowText}>Microphone for voice/video calls</Text>
          </View>
          <View style={styles.permissionRow}>
            <Ionicons name="camera-outline" size={19} color={tokens.colors.dark.primary} />
            <Text variant="body" style={styles.rowText}>Camera for video calls and QR scanner</Text>
          </View>

          {error ? <Text variant="caption" style={styles.error}>{error}</Text> : null}

          {isSecureContext ? (
            <Pressable style={styles.primaryButton} onPress={() => void requestMedia()} accessibilityRole="button">
              <Text variant="bodyMedium" style={styles.primaryButtonText}>Allow permissions</Text>
            </Pressable>
          ) : (
            <Text variant="caption" style={styles.error}>
              PC par http://localhost:8081 kholen; phone par permission ke liye ChatFlow ko HTTPS link se kholen.
            </Text>
          )}
          <Pressable style={styles.laterButton} onPress={dismiss} accessibilityRole="button">
            <Text variant="bodyMedium" style={styles.laterText}>Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: tokens.colors.dark.overlay,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
    borderRadius: 22,
    backgroundColor: tokens.colors.dark.surface,
    borderWidth: 1,
    borderColor: tokens.colors.dark.divider,
  },
  iconMark: {
    width: 56,
    height: 56,
    marginBottom: 18,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.dark.surfaceEmphasized,
  },
  title: { color: tokens.colors.dark.textPrimary, marginBottom: 8 },
  description: { color: tokens.colors.dark.textSecondary, marginBottom: 20 },
  permissionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  rowText: { color: tokens.colors.dark.textPrimary },
  error: { color: tokens.colors.dark.warning, marginTop: 4, marginBottom: 12 },
  primaryButton: {
    minHeight: 48,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: tokens.colors.dark.primary,
  },
  primaryButtonText: { color: tokens.colors.dark.textInverse },
  laterButton: { minHeight: 44, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  laterText: { color: tokens.colors.dark.textSecondary },
});
