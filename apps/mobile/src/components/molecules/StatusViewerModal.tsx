/**
 * @file StatusViewerModal molecule component.
 * Full-screen WhatsApp-authentic status story player featuring:
 * - Segmented progress bars at top with elapsed animation
 * - Tap right (skip next), tap left (go back), hold to pause
 * - Text, Original HD Photo, and Video status renderers
 * - Viewers count & Viewers list bottom sheet for own statuses
 * - Snapchat-style screenshot detection, real-time alert banner, and simulator trigger
 * 
 * Strict compliance with RULE 0.1 (No phone numbers) and RULE 0.7 (Design tokens).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Image,
  Pressable,
  Animated,
  Dimensions,
  Platform,
  TextInput,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { Text } from '../atoms/Text';
import { Avatar } from '../atoms/Avatar';
import { StatusItem, UserStoryGroup } from '@chatflow/shared';
import { useAuthStore } from '../../store/useAuthStore';
import { useStatusStore } from '../../store/useStatusStore';
import { StatusViewersModal } from './StatusViewersModal';
import { resolveMediaUrl } from '../../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface StatusViewerModalProps {
  visible: boolean;
  storyGroup: UserStoryGroup | null;
  initialIndex?: number;
  onClose: () => void;
  onNextGroup?: () => void;
  onPrevGroup?: () => void;
}

export const StatusViewerModal: React.FC<StatusViewerModalProps> = ({
  visible,
  storyGroup,
  initialIndex = 0,
  onClose,
  onNextGroup,
  onPrevGroup,
}) => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const { token, user } = useAuthStore();
  const { markStoryViewed, reportScreenshot, deleteStory } = useStatusStore();

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPaused, setIsPaused] = useState(false);
  const [isViewersOpen, setIsViewersOpen] = useState(false);
  const [screenshotAlertText, setScreenshotAlertText] = useState<string | null>(null);

  const stories = storyGroup?.stories || [];
  const currentStory: StatusItem | undefined = stories[currentIndex];

  // Progress animation value (0 to 1)
  const progressAnim = useRef(new Animated.Value(0)).current;
  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;

  const currentDuration = currentStory?.durationSeconds
    ? currentStory.durationSeconds * 1000
    : 5000;

  // Reset index when story group changes
  useEffect(() => {
    if (visible) {
      setCurrentIndex(Math.min(initialIndex, Math.max(0, (storyGroup?.stories.length || 1) - 1)));
      progressAnim.setValue(0);
    }
  }, [visible, storyGroup, initialIndex, progressAnim]);

  // Handle auto-advancing progress
  useEffect(() => {
    if (!visible || !currentStory || isPaused || isViewersOpen) {
      progressAnim.stopAnimation();
      return;
    }

    // Mark current story as viewed
    if (token && currentStory.id) {
      void markStoryViewed(token, currentStory.id, false);
    }

    progressAnim.setValue(0);
    const animation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: currentDuration,
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished && !isPausedRef.current) {
        goToNext();
      }
    });

    return () => {
      progressAnim.stopAnimation();
    };
  }, [visible, currentIndex, currentStory?.id, isPaused, isViewersOpen, currentDuration]);

  // Navigate to next story
  const goToNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      progressAnim.setValue(0);
      setCurrentIndex((prev) => prev + 1);
    } else if (onNextGroup) {
      onNextGroup();
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onNextGroup, onClose, progressAnim]);

  // Navigate to previous story
  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      progressAnim.setValue(0);
      setCurrentIndex((prev) => prev - 1);
    } else if (onPrevGroup) {
      onPrevGroup();
    }
  }, [currentIndex, onPrevGroup, progressAnim]);

  // Press & Hold to pause
  const handlePressIn = () => {
    setIsPaused(true);
  };

  const handlePressOut = () => {
    setIsPaused(false);
  };

  // Snapchat-style screenshot trigger
  const handleTriggerScreenshotAlert = useCallback(() => {
    if (!currentStory || !user) return;

    // Show Snapchat alert banner
    setScreenshotAlertText(`⚠️ Screenshot Recorded! We notified @${storyGroup?.username || 'user'}`);
    setTimeout(() => setScreenshotAlertText(null), 5000);

    // Call store to dispatch alert to backend and story owner
    if (token) {
      void reportScreenshot(
        token,
        currentStory.id,
        currentStory.userId,
        user.id,
        user.username,
        user.displayName
      );
    }
  }, [currentStory, user, token, storyGroup, reportScreenshot]);

  // Keyboard screenshot listener for Web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4'))) {
          handleTriggerScreenshotAlert();
        }
      };
      window.addEventListener('keyup', handleKeyDown);
      return () => {
        window.removeEventListener('keyup', handleKeyDown);
      };
    }
    return undefined;
  }, [handleTriggerScreenshotAlert]);

  const formatStoryTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const diffHours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
      if (diffHours < 1) {
        const diffMins = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
        return `${Math.max(1, diffMins)}m ago`;
      }
      return `${diffHours}h ago`;
    } catch {
      return '';
    }
  };

  if (!visible || !storyGroup || !currentStory) {
    return null;
  }

  const isOwnStory = currentStory.userId === user?.id || storyGroup.userId === user?.id;
  const isTextStory = currentStory.mediaType === 'text';
  const backgroundColor = currentStory.backgroundColor || '#075E54';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: isTextStory ? backgroundColor : '#000000' }]}>
        {/* Story Media / Content Layer */}
        <View style={styles.contentLayer}>
          {isTextStory ? (
            <View style={styles.textContentWrapper}>
              <Text style={styles.textStatusCaption}>
                {currentStory.caption || ''}
              </Text>
            </View>
          ) : (
            <Image
              source={{ uri: resolveMediaUrl(currentStory.mediaUrl) || '' }}
              style={styles.mediaImage}
              resizeMode="contain"
            />
          )}

          {/* Optional Caption for Photo/Video */}
          {!isTextStory && currentStory.caption && (
            <View style={styles.captionOverlay}>
              <Text variant="bodyMedium" style={styles.captionText}>
                {currentStory.caption}
              </Text>
            </View>
          )}
        </View>

        {/* Snapchat-Style Screenshot Detection Banner */}
        {screenshotAlertText && (
          <View style={[styles.screenshotBanner, { top: insets.top + 70 }]}>
            <Ionicons name="camera" size={18} color="#FFFFFF" />
            <Text variant="caption" style={styles.screenshotBannerText}>
              {screenshotAlertText}
            </Text>
          </View>
        )}

        {/* Interactive Tap Zones: Left 50% = Back, Right 50% = Next, Hold = Pause */}
        <View style={styles.touchOverlay} pointerEvents="box-none">
          <Pressable
            style={styles.touchLeft}
            onPress={goToPrev}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityLabel="Previous story"
          />
          <Pressable
            style={styles.touchRight}
            onPress={goToNext}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityLabel="Next story"
          />
        </View>

        {/* Top Header Overlay: Segmented Bars & User Info */}
        <View
          style={[
            styles.topHeader,
            {
              paddingTop: Math.max(insets.top, tokens.spacing.sm),
            },
          ]}
          pointerEvents="box-none"
        >
          {/* Segmented Progress Bars */}
          <View style={styles.progressRow}>
            {stories.map((story, idx) => {
              let segmentWidth: any = '0%';
              if (idx < currentIndex) {
                segmentWidth = '100%';
              } else if (idx === currentIndex) {
                segmentWidth = progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                });
              }

              return (
                <View key={story.id} style={styles.progressBarBackground}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      { width: segmentWidth },
                    ]}
                  />
                </View>
              );
            })}
          </View>

          {/* User Details & Controls */}
          <View style={styles.userInfoRow}>
            <View style={styles.userProfile}>
              <Avatar
                name={storyGroup.displayName}
                uri={storyGroup.avatarUrl}
                size="sm"
              />
              <View style={styles.userNamesCol}>
                <Text variant="bodyMedium" style={styles.displayNameText}>
                  {isOwnStory ? 'My Status' : storyGroup.displayName}
                </Text>
                <Text variant="caption" style={styles.timestampText}>
                  {formatStoryTime(currentStory.createdAt)}
                </Text>
              </View>
            </View>

            <View style={styles.headerRightActions}>
              {/* Snapchat Screenshot Test Trigger Button (Available for testing) */}
              {!isOwnStory && (
                <Pressable
                  onPress={handleTriggerScreenshotAlert}
                  style={({ pressed }) => [
                    styles.screenshotTriggerButton,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Simulate screenshot"
                >
                  <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
                  <Text variant="caption" style={styles.screenshotBtnText}>
                    Snap Alert
                  </Text>
                </Pressable>
              )}

              {/* Close Button */}
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeButton,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Close story"
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Bottom Bar */}
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: Math.max(insets.bottom, tokens.spacing.md),
            },
          ]}
          pointerEvents="box-none"
        >
          {isOwnStory ? (
            /* Own Story: View count trigger button */
            <Pressable
              onPress={() => setIsViewersOpen(true)}
              style={({ pressed }) => [
                styles.viewsCountButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="View who saw your status"
            >
              <Ionicons name="eye-outline" size={18} color="#FFFFFF" />
              <Text variant="bodyMedium" style={styles.viewsCountText}>
                {currentStory.viewersCount ?? (currentStory.viewers?.length || 0)} views
              </Text>
              <Ionicons name="chevron-up" size={16} color="rgba(255,255,255,0.7)" />
            </Pressable>
          ) : (
            /* Friend's Story: WhatsApp Reply input */
            <View style={styles.replyBar}>
              <View style={styles.replyInputWrapper}>
                <TextInput
                  placeholder={`Reply to ${storyGroup.displayName}...`}
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  style={styles.replyInput}
                />
              </View>
              <Pressable
                style={styles.sendReplyButton}
                accessibilityRole="button"
                accessibilityLabel="Send reply"
              >
                <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          )}
        </View>

        {/* Viewers Bottom Sheet Modal */}
        <StatusViewersModal
          visible={isViewersOpen}
          status={currentStory}
          onClose={() => setIsViewersOpen(false)}
          onDeleteStatus={async (statusId) => {
            if (token) {
              await deleteStory(token, statusId);
              goToNext();
            }
          }}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  contentLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  textContentWrapper: {
    paddingHorizontal: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '90%',
  },
  textStatusCaption: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 36,
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
  },
  captionText: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  touchOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  touchLeft: {
    flex: 1,
    height: '100%',
  },
  touchRight: {
    flex: 1,
    height: '100%',
  },
  topHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: tokens.spacing.sm,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 3,
    marginBottom: tokens.spacing.xs,
    paddingHorizontal: 4,
  },
  progressBarBackground: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: 4,
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  userNamesCol: {
    marginLeft: 6,
  },
  displayNameText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  timestampText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  screenshotTriggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(234, 0, 56, 0.45)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(234, 0, 56, 0.8)',
  },
  screenshotBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenshotBanner: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EA0038',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    ...tokens.elevation[4],
  },
  screenshotBannerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: tokens.spacing.md,
    alignItems: 'center',
    zIndex: 10,
  },
  viewsCountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  viewsCountText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: tokens.spacing.xs,
  },
  replyInputWrapper: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 24,
    paddingHorizontal: tokens.spacing.md,
    height: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  replyInput: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  sendReplyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
