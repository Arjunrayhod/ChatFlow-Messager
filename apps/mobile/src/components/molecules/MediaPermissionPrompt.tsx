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
        if (permissions?.query) {
          const [microphone, camera] = await Promise.all([
            permissions.query({ name: 'microphone' as PermissionName }),
            permissions.query({ name: 'camera' as PermissionName }),
          ]);
          if (!cancelled && microphone.state === 'granted' && camera.state === 'granted') {
            window.sessionStorage.setItem(SESSION_KEY, '1');
            return;
          }
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

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Is browser mein camera/microphone access available nahi hai.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((track) => track.stop());
      dismiss();
    } catch (reason) {
      console.warn('[MediaPermissionPrompt] Permission request failed:', reason);
      setError('Permission allow nahi hui. Browser site settings mein Camera aur Microphone ko Allow karke phir try karein.');
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
          <Text variant="h2" style={styles.title}>Allow camera and microphone</Text>
          <Text variant="body" style={styles.description}>
            Voice/video calls, camera status, and QR scanning ke liye in permissions ki zaroorat hai.
          </Text>

          <View style={styles.permissionRow}>
            <Ionicons name="mic-outline" size={19} color={tokens.colors.dark.primary} />
            <Text variant="body" style={styles.rowText}>Microphone for calls</Text>
          </View>
          <View style={styles.permissionRow}>
            <Ionicons name="camera-outline" size={19} color={tokens.colors.dark.primary} />
            <Text variant="body" style={styles.rowText}>Camera for video calls and QR</Text>
          </View>

          {error ? <Text variant="caption" style={styles.error}>{error}</Text> : null}

          {isSecureContext ? (
            <Pressable style={styles.primaryButton} onPress={() => void requestMedia()} accessibilityRole="button">
              <Text variant="bodyMedium" style={styles.primaryButtonText}>Allow camera & microphone</Text>
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
