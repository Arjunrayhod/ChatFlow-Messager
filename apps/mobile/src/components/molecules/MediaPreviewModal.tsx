/**
 * @file WhatsApp-Style Media Preview and Send Modal.
 * Features:
 * - [ HD ] Original Resolution Toggle (preserves 100% resolution without compression)
 * - File info pill showing exact dimensions (width x height) and size (MB/KB)
 * - Caption input with WhatsApp emerald send button
 * - Upload progress indicator
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  Platform,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { Text } from '../atoms/Text';
import { TextInputField } from '../atoms/TextInputField';

export interface SelectedMediaFile {
  file: File | Blob;
  previewUrl: string;
  dataUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
  type: 'image' | 'video' | 'document';
}

export interface MediaPreviewModalProps {
  visible: boolean;
  media: SelectedMediaFile | null;
  isUploading: boolean;
  onClose: () => void;
  onSend: (media: SelectedMediaFile, caption: string, isHD: boolean) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  visible,
  media,
  isUploading,
  onClose,
  onSend,
}) => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const [caption, setCaption] = useState('');
  const [isHD, setIsHD] = useState(true); // Default to Original HD Quality!

  if (!media) return null;

  const handleSendPress = () => {
    if (isUploading) return;
    onSend(media, caption, isHD);
    setCaption('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: '#0B141A' }]}>
        {/* Top Header Bar */}
        <View
          style={[
            styles.headerBar,
            { paddingTop: Math.max(insets.top, tokens.spacing.md) },
          ]}
        >
          <Pressable
            onPress={onClose}
            disabled={isUploading}
            style={styles.headerIconButton}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>

          {/* WhatsApp [ HD ] Quality Toggle Button */}
          <Pressable
            onPress={() => setIsHD((prev) => !prev)}
            disabled={isUploading}
            style={({ pressed }) => [
              styles.hdToggleBtn,
              isHD ? styles.hdToggleBtnActive : styles.hdToggleBtnInactive,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Toggle HD Original Resolution"
          >
            <Ionicons
              name={isHD ? 'checkmark-circle' : 'sparkles-outline'}
              size={16}
              color={isHD ? '#FFFFFF' : 'rgba(255,255,255,0.7)'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.hdToggleText,
                { color: isHD ? '#FFFFFF' : 'rgba(255,255,255,0.7)' },
              ]}
            >
              HD {isHD ? 'Quality' : 'Standard'}
            </Text>
          </Pressable>

          <View style={styles.headerIconButton} />
        </View>

        {/* HD Quality Status Subtitle */}
        <View style={styles.qualityBanner}>
          <Text variant="caption" style={styles.qualityBannerText}>
            {isHD
              ? '✨ Original HD: Zero compression, full resolution preserved'
              : '⚡ Standard: Compressed for low-bandwidth networks'}
          </Text>
        </View>

        {/* Center Media Viewport */}
        <View style={styles.mediaViewport}>
          {media.type === 'image' ? (
            <Image
              source={{ uri: media.previewUrl }}
              style={styles.imagePreview}
              resizeMode="contain"
            />
          ) : media.type === 'video' ? (
            Platform.OS === 'web' ? (
              <video
                src={media.previewUrl}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  borderRadius: tokens.radii.lg,
                  backgroundColor: '#000000',
                }}
                controls
                autoPlay
              />
            ) : (
              <View style={styles.videoPlaceholder}>
                <Ionicons name="videocam" size={64} color="#FFFFFF" />
              </View>
            )
          ) : (
            <View style={styles.documentPreviewBox}>
              <Ionicons name="document-text" size={72} color={theme.primary} />
              <Text variant="h2" colorRole="inverse" style={{ marginTop: 12 }}>
                {media.fileName}
              </Text>
            </View>
          )}

          {/* Resolution & File Size Pill */}
          <View style={styles.infoPill}>
            <Text style={styles.infoPillText}>
              {media.width && media.height ? `${media.width} × ${media.height} • ` : ''}
              {formatBytes(media.fileSize)} • {media.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
            </Text>
          </View>
        </View>

        {/* Bottom Bar: Caption & Send Button */}
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, tokens.spacing.md) },
          ]}
        >
          <View style={styles.captionInputWrapper}>
            <TextInputField
              placeholder="Add a caption..."
              value={caption}
              onChangeText={setCaption}
              editable={!isUploading}
              style={{
                color: '#FFFFFF',
                fontSize: 16,
              }}
            />
          </View>

          <Pressable
            onPress={handleSendPress}
            disabled={isUploading}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: theme.primary,
                opacity: isUploading ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send HD Media"
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={22} color="#FFFFFF" style={{ marginLeft: 2 }} />
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.xs,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hdToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: tokens.radii.pill,
    borderWidth: 1.5,
  },
  hdToggleBtnActive: {
    backgroundColor: '#008069',
    borderColor: '#25D366',
  },
  hdToggleBtnInactive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  hdToggleText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  qualityBanner: {
    alignItems: 'center',
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  qualityBannerText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
  },
  mediaViewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.md,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentPreviewBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoPill: {
    position: 'absolute',
    bottom: tokens.spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: tokens.radii.pill,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  infoPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    backgroundColor: '#1F2C34',
    gap: tokens.spacing.sm,
  },
  captionInputWrapper: {
    flex: 1,
  },
  sendButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
