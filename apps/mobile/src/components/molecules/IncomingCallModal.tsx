/**
 * @file Incoming Call Notification Modal (Phase 5).
 * WhatsApp-style incoming voice and video call screen with pulse animations.
 * Strict compliance with RULE 0.1 (No phone numbers) and RULE 0.7 (Design tokens).
 * 
 * [HINGLISH GUIDE]:
 * Yeh Incoming Call Popup hai:
 * 1. Jab koi user call karta hai to screen par ringing animation ke sath dikhta hai.
 * 2. Caller ka Name, @username aur Avatar display hota hai.
 * 3. Green "Accept" button se call answer hoti hai.
 * 4. Red "Decline" button se call reject hoti hai.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { Text } from '../atoms/Text';
import { Avatar } from '../atoms/Avatar';
import { useCallStore } from '../../store/useCallStore';

export function IncomingCallModal() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const { activeCall, answerCall, rejectCall } = useCallStore();

  const isVisible =
    Boolean(activeCall) &&
    activeCall?.direction === 'incoming' &&
    activeCall?.status === 'ringing';

  // Pulse animation for avatar ring
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isVisible) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [isVisible, pulseAnim]);

  if (!isVisible || !activeCall) return null;

  const isVideo = activeCall.type === 'video';
  const partner = activeCall.partner;

  return (
    <Modal visible={isVisible} transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.overlay, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
        {/* Top Calling Badge */}
        <View style={styles.topHeader}>
          <Ionicons
            name={isVideo ? 'videocam' : 'call'}
            size={24}
            color={tokens.colors.dark.primary}
          />
          <Text variant="caption" style={styles.callTypeLabel}>
            {isVideo ? 'Incoming WhatsApp Video Call' : 'Incoming WhatsApp Voice Call'}
          </Text>
        </View>

        {/* Center: Pulsing Avatar & Identity */}
        <View style={styles.centerContainer}>
          <View style={styles.pulseContainer}>
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  transform: [{ scale: pulseAnim }],
                  borderColor: tokens.colors.dark.primary,
                },
              ]}
            />
            <Avatar
              uri={partner?.avatarUrl}
              name={partner?.displayName || 'User'}
              size="xl"
            />
          </View>

          <Text variant="h1" style={styles.partnerName} numberOfLines={1}>
            {partner?.displayName || 'Incoming Call'}
          </Text>
          <Text variant="body" style={styles.partnerUsername}>
            @{partner?.username ? partner.username.replace(/^@/, '') : 'user'}
          </Text>
          <Text variant="caption" style={styles.ringingStatus}>
            Ringing...
          </Text>
        </View>

        {/* Bottom Actions: Decline (Red) and Accept (Green) */}
        <View style={styles.actionRow}>
          {/* Decline Button */}
          <View style={styles.actionColumn}>
            <Pressable
              style={[styles.actionButton, styles.declineButton]}
              onPress={() => rejectCall('Call declined by user')}
              accessibilityRole="button"
              accessibilityLabel="Decline Call"
            >
              <Ionicons name="call" size={28} color="#FFFFFF" style={styles.declineIcon} />
            </Pressable>
            <Text variant="caption" style={styles.actionLabel}>
              Decline
            </Text>
          </View>

          {/* Accept Button */}
          <View style={styles.actionColumn}>
            <Pressable
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => void answerCall()}
              accessibilityRole="button"
              accessibilityLabel="Accept Call"
            >
              <Ionicons name={isVideo ? 'videocam' : 'call'} size={28} color="#FFFFFF" />
            </Pressable>
            <Text variant="caption" style={styles.actionLabel}>
              Accept
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 20, 26, 0.96)',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.xl,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.pill,
  },
  callTypeLabel: {
    color: '#E9EDEF',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.lg,
  },
  pulseRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    opacity: 0.5,
  },
  partnerName: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 26,
    marginBottom: tokens.spacing.xxs,
  },
  partnerUsername: {
    color: '#8696A0',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: tokens.spacing.sm,
  },
  ringingStatus: {
    color: tokens.colors.dark.primary,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 320,
  },
  actionColumn: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  actionButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  declineButton: {
    backgroundColor: tokens.colors.dark.error,
  },
  declineIcon: {
    transform: [{ rotate: '135deg' }],
  },
  acceptButton: {
    backgroundColor: tokens.colors.dark.primary,
  },
  actionLabel: {
    color: '#E9EDEF',
    fontWeight: '500',
  },
});
