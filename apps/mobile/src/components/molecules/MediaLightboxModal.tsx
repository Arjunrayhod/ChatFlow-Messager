/**
 * @file Fullscreen HD Media Lightbox Modal.
 * Displays original uncompressed photos and videos with zoom, playback,
 * file resolution/size inspection, and download capability.
 */

import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { Text } from '../atoms/Text';
import { MessageType } from '@chatflow/shared';
import { resolveMediaUrl } from '../../services/api';

export interface MediaLightboxData {
  url: string;
  type: MessageType;
  metadata?: Record<string, unknown> | null;
  senderName?: string;
  timestamp?: string;
}

export interface MediaLightboxModalProps {
  visible: boolean;
  data: MediaLightboxData | null;
  onClose: () => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MediaLightboxModal: React.FC<MediaLightboxModalProps> = ({
  visible,
  data,
  onClose,
}) => {
  const insets = useSafeAreaInsets();

  if (!data) return null;

  const { url, type, metadata, senderName, timestamp } = data;
  const resolvedUrl = resolveMediaUrl(url);
  const isHD = metadata?.isHD !== false;
  const fileSize = typeof metadata?.fileSize === 'number' ? metadata.fileSize : undefined;
  const fileName = typeof metadata?.fileName === 'string' ? metadata.fileName : 'chatflow_media';
  const width = typeof metadata?.width === 'number' ? metadata.width : undefined;
  const height = typeof metadata?.height === 'number' ? metadata.height : undefined;

  const handleDownload = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = resolvedUrl;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      Alert.alert('Download', `Original file link: ${resolvedUrl}`);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: '#000000' }]}>
        {/* Top Header Bar */}
        <View
          style={[
            styles.headerBar,
            { paddingTop: Math.max(insets.top, tokens.spacing.md) },
          ]}
        >
          <Pressable
            onPress={onClose}
            style={styles.headerIconButton}
            accessibilityRole="button"
            accessibilityLabel="Close lightbox"
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>

          <View style={styles.headerInfoCol}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="bodyMedium" colorRole="inverse" style={{ fontWeight: '700' }}>
                {senderName || 'Media'}
              </Text>
              {isHD && (
                <View style={styles.hdPill}>
                  <Text style={styles.hdPillText}>HD ORIGINAL</Text>
                </View>
              )}
            </View>
            {timestamp && (
              <Text variant="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {timestamp}
              </Text>
            )}
          </View>

          <Pressable
            onPress={handleDownload}
            style={styles.headerIconButton}
            accessibilityRole="button"
            accessibilityLabel="Download original file"
          >
            <Ionicons name="download-outline" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Media Viewport */}
        <View style={styles.contentViewport}>
          {type === 'image' ? (
            <Image
              source={{ uri: resolvedUrl }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          ) : type === 'video' ? (
            Platform.OS === 'web' ? (
              <video
                src={resolvedUrl}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  backgroundColor: '#000000',
                }}
                controls
                autoPlay
              />
            ) : (
              <View style={styles.videoPlaceholder}>
                <Ionicons name="videocam" size={72} color="#FFFFFF" />
              </View>
            )
          ) : (
            <View style={styles.docBox}>
              <Ionicons name="document-text" size={72} color="#008069" />
              <Text variant="h2" colorRole="inverse" style={{ marginTop: 12 }}>
                {fileName}
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Details Footer */}
        <View
          style={[
            styles.footerBar,
            { paddingBottom: Math.max(insets.bottom, tokens.spacing.md) },
          ]}
        >
          <View style={styles.metaRow}>
            <Ionicons name="sparkles" size={16} color="#25D366" />
            <Text variant="caption" colorRole="inverse" style={{ marginLeft: 6, fontWeight: '600' }}>
              Original Uncompressed Quality
            </Text>
            <Text variant="caption" style={{ color: 'rgba(255,255,255,0.7)', marginLeft: 8 }}>
              {width && height ? `${width} × ${height} px • ` : ''}
              {formatBytes(fileSize)}
            </Text>
          </View>
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
    paddingBottom: tokens.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.75)',
    zIndex: 10,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfoCol: {
    flex: 1,
    marginLeft: tokens.spacing.xs,
  },
  hdPill: {
    backgroundColor: '#008069',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: tokens.radii.sm,
    marginLeft: 8,
  },
  hdPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  contentViewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  docBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.xl,
  },
  footerBar: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingTop: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    alignItems: 'center',
    zIndex: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
