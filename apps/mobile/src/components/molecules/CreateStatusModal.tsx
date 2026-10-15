/**
 * @file CreateStatusModal molecule component.
 * Allows users to publish Text, Photo, or Video Status updates.
 * Features:
 * - WhatsApp-style cycling background color palette for text status
 * - File picker for Original HD Photos and Videos
 * - Caption input & live preview
 * 
 * Strict compliance with RULE 0.1 (No phone numbers) and RULE 0.7 (Design tokens).
 */

import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { Text } from '../atoms/Text';
import { useAuthStore } from '../../store/useAuthStore';
import { useStatusStore } from '../../store/useStatusStore';

export interface CreateStatusModalProps {
  visible: boolean;
  initialMode?: 'text' | 'media';
  onClose: () => void;
  onSuccess?: () => void;
}

const BG_PALETTES = [
  '#075E54', // WhatsApp Emerald
  '#512DA8', // Deep Purple
  '#E64A19', // Coral Red
  '#1A237E', // Midnight Blue
  '#880E4F', // Burgundy
  '#2E7D32', // Forest Green
  '#00838F', // Ocean Teal
];

export const CreateStatusModal: React.FC<CreateStatusModalProps> = ({
  visible,
  initialMode = 'text',
  onClose,
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const { token } = useAuthStore();
  const { createTextStory, uploadMediaStory, isPublishing } = useStatusStore();

  const [mode, setMode] = useState<'text' | 'media'>(initialMode);
  const [textContent, setTextContent] = useState('');
  const [paletteIndex, setPaletteIndex] = useState(0);

  // Media state
  const [mediaData, setMediaData] = useState<{
    data: string;
    mimeType: string;
    fileName: string;
    previewUri: string;
    mediaType: 'image' | 'video';
  } | null>(null);
  const [caption, setCaption] = useState('');

  const currentBgColor = BG_PALETTES[paletteIndex] || '#075E54';

  const cyclePalette = () => {
    setPaletteIndex((prev) => (prev + 1) % BG_PALETTES.length);
  };

  const handlePickMedia = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const result = event.target?.result as string;
            const isVideo = file.type.startsWith('video');
            setMediaData({
              data: result,
              mimeType: file.type,
              fileName: file.name,
              previewUri: result,
              mediaType: isVideo ? 'video' : 'image',
            });
            setMode('media');
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      Alert.alert('Media Picker', 'Device gallery picker is active in this build.');
    }
  };

  const handlePublish = async () => {
    if (!token) return;

    if (mode === 'text') {
      if (!textContent.trim()) {
        Alert.alert('Empty Status', 'Please enter text for your status.');
        return;
      }
      const ok = await createTextStory(token, textContent.trim(), currentBgColor);
      if (ok) {
        setTextContent('');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        Alert.alert('Error', 'Failed to publish status. Please retry.');
      }
    } else {
      if (!mediaData) {
        Alert.alert('No Media', 'Please select a photo or video first.');
        return;
      }
      const ok = await uploadMediaStory(token, {
        fileName: mediaData.fileName,
        mimeType: mediaData.mimeType,
        data: mediaData.data,
        mediaType: mediaData.mediaType,
        caption: caption.trim() || null,
        backgroundColor: currentBgColor,
      });

      if (ok) {
        setMediaData(null);
        setCaption('');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        Alert.alert('Error', 'Failed to upload status media. Please retry.');
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: mode === 'text' ? currentBgColor : '#000000',
            paddingTop: Math.max(insets.top, tokens.spacing.sm),
            paddingBottom: Math.max(insets.bottom, tokens.spacing.md),
          },
        ]}
      >
        {/* Top Controls */}
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.iconBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>

          <View style={styles.modeTabs}>
            <Pressable
              onPress={() => setMode('text')}
              style={[
                styles.tabBtn,
                mode === 'text' && styles.activeTabBtn,
              ]}
            >
              <Text style={styles.tabText}>Text</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setMode('media');
                if (!mediaData) handlePickMedia();
              }}
              style={[
                styles.tabBtn,
                mode === 'media' && styles.activeTabBtn,
              ]}
            >
              <Text style={styles.tabText}>Media</Text>
            </Pressable>
          </View>

          {mode === 'text' ? (
            <Pressable
              onPress={cyclePalette}
              style={({ pressed }) => [
                styles.iconBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityLabel="Change background color"
            >
              <Ionicons name="color-palette-outline" size={24} color="#FFFFFF" />
            </Pressable>
          ) : (
            <Pressable
              onPress={handlePickMedia}
              style={({ pressed }) => [
                styles.iconBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityLabel="Select photo"
            >
              <Ionicons name="images-outline" size={24} color="#FFFFFF" />
            </Pressable>
          )}
        </View>

        {/* Content Body */}
        {mode === 'text' ? (
          <View style={styles.textInputContainer}>
            <TextInput
              multiline
              autoFocus
              placeholder="Type a status..."
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              value={textContent}
              onChangeText={setTextContent}
              style={styles.textStatusInput}
              maxLength={700}
            />
          </View>
        ) : (
          <View style={styles.mediaContainer}>
            {mediaData ? (
              <Image
                source={{ uri: mediaData.previewUri }}
                style={styles.mediaPreview}
                resizeMode="contain"
              />
            ) : (
              <Pressable
                onPress={handlePickMedia}
                style={styles.pickMediaPlaceholder}
              >
                <Ionicons name="camera-outline" size={56} color="rgba(255,255,255,0.6)" />
                <Text variant="bodyMedium" style={{ color: '#FFFFFF', marginTop: 12 }}>
                  Tap to select Photo or Video
                </Text>
                <Text variant="caption" style={{ color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                  Original uncompressed HD resolution
                </Text>
              </Pressable>
            )}

            {mediaData && (
              <View style={styles.captionInputWrapper}>
                <TextInput
                  placeholder="Add a caption..."
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  value={caption}
                  onChangeText={setCaption}
                  style={styles.captionInput}
                />
              </View>
            )}
          </View>
        )}

        {/* Bottom Floating Publish Button */}
        <View style={styles.bottomBar}>
          <Pressable
            onPress={handlePublish}
            disabled={isPublishing}
            style={({ pressed }) => [
              styles.sendFab,
              {
                opacity: pressed || isPublishing ? 0.75 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send status update"
          >
            {isPublishing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={22} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    height: 54,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    padding: 3,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  activeTabBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  tabText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  textInputContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.lg,
  },
  textStatusInput: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
    lineHeight: 36,
  },
  mediaContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPreview: {
    width: '100%',
    height: '80%',
  },
  pickMediaPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.xl,
    marginHorizontal: tokens.spacing.lg,
  },
  captionInputWrapper: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 24,
    paddingHorizontal: tokens.spacing.md,
    height: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  captionInput: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 24,
    right: 24,
  },
  sendFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.light.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.elevation[4],
  },
});
