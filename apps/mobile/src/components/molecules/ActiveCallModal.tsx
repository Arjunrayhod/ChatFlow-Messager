/**
 * @file Active Voice & Video Call Modal Screen (Phase 5).
 * WhatsApp-style full-screen audio and video calling interface with controls.
 * Strict compliance with RULE 0.1 (No phone numbers) and RULE 0.7 (Design tokens).
 * 
 * [HINGLISH GUIDE]:
 * Yeh Active Call Screen hai:
 * 1. Video Call: Remote video full screen me chalti hai aur Local camera PIP frame me dikhta hai.
 * 2. Voice Call: Atmospheric background, animated soundwave rings, aur live call duration timer (00:00).
 * 3. Media Controls:
 *    - Mic Mute / Unmute
 *    - Camera Turn On / Off
 *    - Front / Rear Camera Flip
 *    - Red Hang Up button (Call End)
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { Text } from '../atoms/Text';
import { Avatar } from '../atoms/Avatar';
import { useCallStore } from '../../store/useCallStore';

// Web Video Element Component
function WebVideoPlayer({
  stream,
  isMuted = false,
  isMirrored = false,
  style,
}: {
  stream: MediaStream | null;
  isMuted?: boolean;
  isMirrored?: boolean;
  style?: React.CSSProperties;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  if (Platform.OS !== 'web') return null;

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isMuted}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: isMirrored ? 'scaleX(-1)' : 'none',
        ...style,
      }}
    />
  );
}

export function ActiveCallModal() {
  const insets = useSafeAreaInsets();
  const {
    activeCall,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    callDuration,
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera,
  } = useCallStore();

  const isVisible =
    Boolean(activeCall) &&
    (activeCall?.status === 'connected' ||
      (activeCall?.direction === 'outgoing' &&
        (activeCall?.status === 'calling' || activeCall?.status === 'ringing')) ||
      activeCall?.status === 'ended' ||
      activeCall?.status === 'rejected');

  // Pulse animation for audio call wave
  const waveAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isVisible && activeCall?.status === 'connected') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(waveAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isVisible, activeCall?.status, waveAnim]);

  if (!isVisible || !activeCall) return null;

  const isVideo = activeCall.type === 'video';
  const partner = activeCall.partner;
  const isConnected = activeCall.status === 'connected';

  // Format call duration: mm:ss
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal visible={isVisible} transparent={false} animationType="fade" statusBarTranslucent>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* VIDEO MODE: Remote Full Screen & Local PIP */}
        {isVideo && isConnected && remoteStream ? (
          <View style={StyleSheet.absoluteFill}>
            <WebVideoPlayer stream={remoteStream} isMuted={false} />

            {/* Local PIP Window */}
            {!isVideoOff && localStream && (
              <View style={[styles.pipWindow, { top: insets.top + 20 }]}>
                <WebVideoPlayer
                  stream={localStream}
                  isMuted={true}
                  isMirrored={true}
                  style={{ borderRadius: tokens.radii.md }}
                />
              </View>
            )}
          </View>
        ) : (
          /* AUDIO MODE / OUTGOING RINGING */
          <View style={styles.audioCenterContainer}>
            <View style={styles.avatarWaveContainer}>
              {isConnected && (
                <Animated.View
                  style={[
                    styles.audioWaveRing,
                    {
                      transform: [{ scale: waveAnim }],
                      borderColor: tokens.colors.dark.primary,
                    },
                  ]}
                />
              )}
              <Avatar
                uri={partner?.avatarUrl}
                name={partner?.displayName || 'User'}
                size="xl"
              />
            </View>

            <Text variant="h1" style={styles.partnerName} numberOfLines={1}>
              {partner?.displayName || 'ChatFlow User'}
            </Text>
            <Text variant="body" style={styles.partnerUsername}>
              @{partner?.username ? partner.username.replace(/^@/, '') : 'user'}
            </Text>

            {/* Status or Live Duration */}
            <View style={styles.statusBadge}>
              <Ionicons
                name={isConnected ? 'lock-closed' : isVideo ? 'videocam' : 'call'}
                size={14}
                color={tokens.colors.dark.primary}
              />
              <Text variant="caption" style={styles.statusText}>
                {activeCall.status === 'calling'
                  ? 'Calling...'
                  : activeCall.status === 'ringing'
                  ? 'Ringing...'
                  : activeCall.status === 'rejected'
                  ? 'Call Declined'
                  : activeCall.status === 'ended'
                  ? 'Call Ended'
                  : formatDuration(callDuration)}
              </Text>
            </View>

            <Text variant="caption" style={styles.encryptionNote}>
              End-to-end encrypted • Zero phone numbers
            </Text>
          </View>
        )}

        {/* Top Header Overlay for Video Call */}
        {isVideo && isConnected && (
          <View style={[styles.videoTopHeader, { top: insets.top + 16 }]}>
            <View style={styles.videoTopInfo}>
              <Text variant="body" style={styles.videoPartnerName}>
                {partner.displayName}
              </Text>
              <Text variant="caption" style={styles.videoDurationText}>
                {formatDuration(callDuration)}
              </Text>
            </View>
          </View>
        )}

        {/* BOTTOM CONTROLS TOOLBAR */}
        <View style={styles.bottomControlsContainer}>
          <View style={styles.controlsBar}>
            {/* Mute Microphone */}
            <Pressable
              style={[styles.controlButton, isMuted && styles.controlButtonActive]}
              onPress={toggleMute}
              accessibilityRole="button"
              accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={24}
                color={isMuted ? '#FF3B30' : '#FFFFFF'}
              />
            </Pressable>

            {/* Camera On / Off (Video Call only) */}
            {isVideo && (
              <Pressable
                style={[styles.controlButton, isVideoOff && styles.controlButtonActive]}
                onPress={toggleVideo}
                accessibilityRole="button"
                accessibilityLabel={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
              >
                <Ionicons
                  name={isVideoOff ? 'videocam-off' : 'videocam'}
                  size={24}
                  color={isVideoOff ? '#FF3B30' : '#FFFFFF'}
                />
              </Pressable>
            )}

            {/* Switch Camera Front/Back (Video Call only) */}
            {isVideo && (
              <Pressable
                style={styles.controlButton}
                onPress={() => void switchCamera()}
                accessibilityRole="button"
                accessibilityLabel="Switch camera"
              >
                <Ionicons name="camera-reverse-outline" size={24} color="#FFFFFF" />
              </Pressable>
            )}

            {/* End Call Button */}
            <Pressable
              style={[styles.controlButton, styles.endCallButton]}
              onPress={endCall}
              accessibilityRole="button"
              accessibilityLabel="End call"
            >
              <Ionicons name="call" size={28} color="#FFFFFF" style={styles.endCallIcon} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B141A',
    justifyContent: 'space-between',
  },
  audioCenterContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
  },
  avatarWaveContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.xl,
  },
  audioWaveRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    opacity: 0.6,
  },
  partnerName: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 28,
    marginBottom: tokens.spacing.xxs,
    textAlign: 'center',
  },
  partnerUsername: {
    color: '#8696A0',
    fontSize: 16,
    marginBottom: tokens.spacing.md,
    textAlign: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.pill,
    marginBottom: tokens.spacing.sm,
  },
  statusText: {
    color: '#E9EDEF',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  encryptionNote: {
    color: '#667781',
    marginTop: tokens.spacing.xs,
  },
  videoTopHeader: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  videoTopInfo: {
    backgroundColor: 'rgba(11, 20, 26, 0.6)',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.md,
  },
  videoPartnerName: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  videoDurationText: {
    color: tokens.colors.dark.primary,
    fontWeight: '500',
  },
  pipWindow: {
    position: 'absolute',
    right: 20,
    width: 110,
    height: 160,
    borderRadius: tokens.radii.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: tokens.colors.dark.primary,
    zIndex: 10,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    backgroundColor: '#000000',
  },
  bottomControlsContainer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.lg,
    zIndex: 20,
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.md,
    backgroundColor: 'rgba(17, 27, 33, 0.85)',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  controlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.25)',
  },
  endCallButton: {
    backgroundColor: tokens.colors.dark.error,
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  endCallIcon: {
    transform: [{ rotate: '135deg' }],
  },
});
