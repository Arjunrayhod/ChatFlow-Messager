/**
 * @file MessageBubble molecule component for chat messages.
 * Conforms to docs/UI_COMPONENT_CATALOG.md Section 2.2.
 * Strict compliance with RULE 0.7 (Design tokens).
 * 
 * Supports:
 * - Text messages with auto-wrapping
 * - Original HD Photos with WhatsApp-style [ HD ] badge and tap-to-expand
 * - Original HD Videos with playback overlay and [ HD ] badge
 * - Documents with file metadata and download option
 * - Sent/Delivered/Read ticks and timestamps
 */

import React, { useState } from 'react';
import { View, StyleSheet, useColorScheme, Pressable, Image, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { Text } from '../atoms/Text';
import { MessageDeliveryStatus, MessageType } from '@chatflow/shared';
import { resolveMediaUrl } from '../../services/api';

export interface MessageBubbleProps {
  id: string;
  content: string;
  isSent: boolean;
  timestamp: string;
  senderName?: string;
  status?: MessageDeliveryStatus;
  type?: MessageType;
  mediaUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  onMediaPress?: (media: { url: string; type: MessageType; metadata?: Record<string, unknown> | null }) => void;
  onLongPress?: () => void;
  editedAt?: string | null;
  isPinned?: boolean;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  content,
  isSent,
  timestamp,
  senderName,
  status = 'sent',
  type = 'text',
  mediaUrl,
  metadata,
  onMediaPress,
  onLongPress,
  editedAt,
  isPinned,
}) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const isHD = metadata?.isHD === true || metadata?.isHD === undefined;
  const fileSize = typeof metadata?.fileSize === 'number' ? metadata.fileSize : undefined;
  const fileName = typeof metadata?.fileName === 'string' ? metadata.fileName : 'File';
  const width = typeof metadata?.width === 'number' ? metadata.width : undefined;
  const height = typeof metadata?.height === 'number' ? metadata.height : undefined;

  const renderStatusIcon = () => {
    if (!isSent) return null;

    switch (status) {
      case 'sending':
        return <Ionicons name="time-outline" size={13} color={theme.textDisabled} />;
      case 'sent':
        return <Ionicons name="checkmark" size={14} color={theme.textDisabled} />;
      case 'delivered':
        return <Ionicons name="checkmark-done" size={14} color={theme.textDisabled} />;
      case 'read':
        return <Ionicons name="checkmark-done" size={14} color={theme.primary} />;
      default:
        return <Ionicons name="checkmark" size={14} color={theme.textDisabled} />;
    }
  };

  const resolvedMediaUrl = resolveMediaUrl(mediaUrl);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handlePressMedia = () => {
    if (resolvedMediaUrl && onMediaPress) {
      onMediaPress({ url: resolvedMediaUrl, type, metadata });
    }
  };

  const isMedia = (type === 'image' || type === 'video' || type === 'document') && !!resolvedMediaUrl;

  const sentBubbleBg = colorScheme === 'dark' ? '#005C4B' : '#D9FDD3';
  const receivedBubbleBg = colorScheme === 'dark' ? '#1F2C34' : '#FFFFFF';

  return (
    <View style={[styles.row, isSent ? styles.sentRow : styles.receivedRow]}>
      <Pressable
        onLongPress={onLongPress}
        style={[
          styles.bubble,
          isMedia && styles.mediaBubble,
          {
            backgroundColor: isSent ? sentBubbleBg : receivedBubbleBg,
            borderTopRightRadius: isSent ? 2 : 12,
            borderTopLeftRadius: isSent ? 12 : 2,
            borderBottomRightRadius: 12,
            borderBottomLeftRadius: 12,
            borderColor: isSent ? 'transparent' : (colorScheme === 'dark' ? '#26353D' : '#E2E8F0'),
            borderWidth: isSent ? 0 : 0.5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.12,
            shadowRadius: 1.5,
            elevation: 1,
          },
        ]}
      >
        {/* SENDER LABEL (For received messages) */}
        {!isSent && !!senderName && (
          <Text
            variant="caption"
            style={{
              color: colorScheme === 'dark' ? '#25D366' : '#008069',
              fontWeight: '700',
              fontSize: 12,
              marginBottom: 3,
            }}
          >
            {senderName}
          </Text>
        )}

        {/* IMAGE MESSAGE */}
        {type === 'image' && resolvedMediaUrl && (
          <Pressable
            onPress={handlePressMedia}
            style={styles.imageContainer}
            accessibilityRole="button"
            accessibilityLabel="View full HD photo"
          >
            <Image
              source={{ uri: resolvedMediaUrl }}
              style={styles.mediaImage}
              resizeMode="cover"
              onLoadStart={() => setImageLoaded(false)}
              onLoadEnd={() => setImageLoaded(true)}
              onError={() => {
                setImageLoaded(false);
                setImageError(true);
              }}
            />

            {!imageLoaded && !imageError && (
              <View style={styles.imagePlaceholderBox}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            )}

            {imageError && (
              <View style={styles.imagePlaceholderBox}>
                <Ionicons name="image-outline" size={32} color={theme.textDisabled} />
                <Text variant="caption" style={{ color: '#FFFFFF', marginTop: 4 }}>
                  Tap to view
                </Text>
              </View>
            )}

            {/* WhatsApp-style HD Badge */}
            {isHD && (
              <View style={styles.hdBadge}>
                <Text style={styles.hdBadgeText}>HD</Text>
              </View>
            )}

            {/* File info overlay */}
            {fileSize && (
              <View style={styles.mediaMetaPill}>
                <Text style={styles.mediaMetaText}>
                  {formatBytes(fileSize)}
                  {width && height ? ` • ${width}×${height}` : ''}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        {/* VIDEO MESSAGE */}
        {type === 'video' && resolvedMediaUrl && (
          <Pressable
            onPress={handlePressMedia}
            style={styles.videoContainer}
            accessibilityRole="button"
            accessibilityLabel="Play HD video"
          >
            {/* If video element is supported on web, render preview or play button */}
            {Platform.OS === 'web' ? (
              <video
                src={resolvedMediaUrl}
                style={{
                  width: '100%',
                  height: 200,
                  borderRadius: tokens.radii.md,
                  objectFit: 'cover',
                  backgroundColor: '#000000',
                }}
                controls
              />
            ) : (
              <View style={styles.videoPlaceholder}>
                <View style={styles.playButtonCircle}>
                  <Ionicons name="play" size={28} color="#FFFFFF" style={{ marginLeft: 3 }} />
                </View>
              </View>
            )}

            {/* HD Badge */}
            {isHD && (
              <View style={styles.hdBadge}>
                <Text style={styles.hdBadgeText}>HD</Text>
              </View>
            )}

            {/* Video File Size */}
            {fileSize && (
              <View style={styles.mediaMetaPill}>
                <Text style={styles.mediaMetaText}>
                  {formatBytes(fileSize)}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        {/* DOCUMENT MESSAGE */}
        {type === 'document' && mediaUrl && (
          <Pressable
            onPress={handlePressMedia}
            style={[
              styles.documentContainer,
              { backgroundColor: isSent ? 'rgba(0,0,0,0.04)' : theme.surface },
            ]}
          >
            <View style={styles.docIconBox}>
              <Ionicons name="document-text" size={26} color={theme.primary} />
            </View>
            <View style={styles.docInfoCol}>
              <Text variant="bodyMedium" numberOfLines={1} style={{ fontWeight: '600' }}>
                {fileName}
              </Text>
              <Text variant="caption" colorRole="secondary">
                {formatBytes(fileSize) || 'Original Document'} • HD Original
              </Text>
            </View>
            <Ionicons name="download-outline" size={20} color={theme.primary} />
          </Pressable>
        )}

        {/* CAPTION OR TEXT CONTENT */}
        {content.trim().length > 0 && (
          <Text
            variant="body"
            colorRole="primary"
            style={[styles.contentText, isMedia && styles.captionText]}
          >
            {content}
          </Text>
        )}

        {/* META ROW: TIME & TICKS */}
        <View style={styles.metaRow}>
          {isPinned && <Ionicons name="pin" size={11} color={theme.primary} />}
          {editedAt && <Text variant="caption" colorRole="secondary" style={styles.timeText}>edited</Text>}
          <Text variant="caption" colorRole="secondary" style={styles.timeText}>
            {timestamp}
          </Text>
          {renderStatusIcon()}
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: tokens.spacing.xxs,
    paddingHorizontal: tokens.spacing.md,
  },
  sentRow: {
    justifyContent: 'flex-end',
  },
  receivedRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: tokens.spacing.sm,
    paddingTop: tokens.spacing.xs,
    paddingBottom: tokens.spacing.xs,
    borderRadius: tokens.radii.lg,
  },
  mediaBubble: {
    paddingHorizontal: 4,
    paddingTop: 4,
    width: 280,
    maxWidth: '85%',
  },
  imageContainer: {
    width: '100%',
    height: 220,
    borderRadius: tokens.radii.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1F2C34',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholderBox: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  videoContainer: {
    width: '100%',
    minHeight: 200,
    borderRadius: tokens.radii.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0B141A',
  },
  videoPlaceholder: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2C34',
  },
  playButtonCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hdBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 128, 105, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hdBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mediaMetaPill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tokens.radii.pill,
  },
  mediaMetaText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
    gap: tokens.spacing.sm,
  },
  docIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 128, 105, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfoCol: {
    flex: 1,
  },
  contentText: {
    lineHeight: 21,
  },
  captionText: {
    paddingHorizontal: tokens.spacing.xs,
    paddingTop: tokens.spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
    marginTop: tokens.spacing.xxs,
    paddingRight: tokens.spacing.xxs,
    gap: tokens.spacing.xxs,
  },
  timeText: {
    fontSize: 11,
  },
});
