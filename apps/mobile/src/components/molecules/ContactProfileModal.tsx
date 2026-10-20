/**
 * @file WhatsApp-Style Contact Profile Modal (Contact Info Screen).
 * Displays full contact information, high-resolution DP, @username, About / bio,
 * and personal QR code for direct friend adding.
 * 
 * Strict compliance with RULE 0.1 (No phone numbers) and RULE 0.7 (Design tokens).
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  Clipboard,
  Platform,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'qrcode';

import { tokens } from '../../theme/tokens';
import { Text } from '../atoms/Text';
import { Avatar } from '../atoms/Avatar';
import { MediaLightboxModal, MediaLightboxData } from './MediaLightboxModal';

export interface ContactProfileUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
}

export interface ContactProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: ContactProfileUser;
  onStartCall?: (type: 'audio' | 'video') => void;
}

export const ContactProfileModal: React.FC<ContactProfileModalProps> = ({
  visible,
  onClose,
  user,
  onStartCall,
}) => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [lightboxData, setLightboxData] = useState<MediaLightboxData | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  const cleanUsername = (user.username || '').replace(/^@/, '');

  // Generate friend QR code whenever modal opens
  useEffect(() => {
    if (!visible || !cleanUsername) return;

    let isMounted = true;
    setIsGeneratingQR(true);

    const payload = `chatflow:user:@${cleanUsername}`;

    QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 260,
      color: {
        dark: '#008069',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setIsGeneratingQR(false);
        }
      })
      .catch((err) => {
        console.warn('[ContactProfileModal] QR generation error:', err);
        if (isMounted) {
          setIsGeneratingQR(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [visible, cleanUsername]);

  const handleCopyUsername = () => {
    try {
      Clipboard.setString(`@${cleanUsername}`);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 3000);
    } catch {
      Alert.alert('Copied', `@${cleanUsername}`);
    }
  };

  const handleViewAvatarFull = () => {
    if (user.avatarUrl) {
      setLightboxData({
        url: user.avatarUrl,
        type: 'image',
        metadata: { fileName: `${cleanUsername}_dp.jpg` },
        senderName: user.displayName || cleanUsername,
      });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: colorScheme === 'dark' ? '#0B141A' : '#F0F2F5',
            paddingTop: Platform.OS === 'ios' ? Math.max(insets.top, 16) : 0,
          },
        ]}
      >
        {/* WhatsApp-Style Top Header Bar */}
        <View
          style={[
            styles.headerBar,
            {
              backgroundColor: theme.surface,
              borderBottomColor: theme.divider,
            },
          ]}
        >
          <Pressable
            onPress={onClose}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Close Profile"
          >
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text variant="h2" style={{ flex: 1, marginLeft: tokens.spacing.sm }}>
            Contact Info
          </Text>
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 40) }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Profile Card */}
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: theme.surface,
                borderBottomColor: theme.divider,
              },
            ]}
          >
            <Pressable onPress={handleViewAvatarFull} style={styles.avatarContainer}>
              <Avatar
                name={user.displayName || cleanUsername || 'User'}
                uri={user.avatarUrl}
                size="xxl"
                presence="online"
              />
              {user.avatarUrl ? (
                <View style={styles.zoomBadge}>
                  <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
                </View>
              ) : null}
            </Pressable>

            <Text variant="h1" align="center" style={styles.displayNameText}>
              {user.displayName || 'ChatFlow User'}
            </Text>
            <Text variant="body" colorRole="secondary" align="center" style={styles.usernameText}>
              @{cleanUsername}
            </Text>

            {/* Quick Action Pills: Audio Call, Video Call, QR Code */}
            <View style={styles.actionRow}>
              {onStartCall ? (
                <>
                  <Pressable
                    onPress={() => {
                      onClose();
                      onStartCall('audio');
                    }}
                    style={[styles.actionPill, { backgroundColor: colorScheme === 'dark' ? '#1F2C34' : '#E7FCE3' }]}
                    accessibilityRole="button"
                    accessibilityLabel="Voice Call"
                  >
                    <Ionicons name="call" size={20} color={theme.primary} />
                    <Text variant="caption" style={{ color: theme.primary, fontWeight: '700' }}>
                      Audio
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      onClose();
                      onStartCall('video');
                    }}
                    style={[styles.actionPill, { backgroundColor: colorScheme === 'dark' ? '#1F2C34' : '#E7FCE3' }]}
                    accessibilityRole="button"
                    accessibilityLabel="Video Call"
                  >
                    <Ionicons name="videocam" size={20} color={theme.primary} />
                    <Text variant="caption" style={{ color: theme.primary, fontWeight: '700' }}>
                      Video
                    </Text>
                  </Pressable>
                </>
              ) : null}

              <Pressable
                onPress={handleCopyUsername}
                style={[styles.actionPill, { backgroundColor: colorScheme === 'dark' ? '#1F2C34' : '#E7FCE3' }]}
                accessibilityRole="button"
                accessibilityLabel="Copy Username"
              >
                <Ionicons name="copy-outline" size={20} color={theme.primary} />
                <Text variant="caption" style={{ color: theme.primary, fontWeight: '700' }}>
                  {copiedNotice ? 'Copied!' : 'Share'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* About Section */}
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.surface,
                borderTopColor: theme.divider,
                borderBottomColor: theme.divider,
              },
            ]}
          >
            <Text variant="caption" colorRole="secondary" style={styles.sectionHeader}>
              ABOUT & USERNAME
            </Text>
            <View style={styles.infoRow}>
              <Ionicons name="information-circle-outline" size={22} color={theme.primary} style={styles.rowIcon} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                  {user.bio || 'Hey there! I am using ChatFlow.'}
                </Text>
                <Text variant="caption" colorRole="secondary" style={{ marginTop: 2 }}>
                  About
                </Text>
              </View>
            </View>

            <View style={[styles.infoRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider }]}>
              <Ionicons name="at-outline" size={22} color={theme.primary} style={styles.rowIcon} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                  @{cleanUsername}
                </Text>
                <Text variant="caption" colorRole="secondary" style={{ marginTop: 2 }}>
                  Username (Permanent ID)
                </Text>
              </View>
              <Pressable onPress={handleCopyUsername} style={styles.copyButton}>
                <Ionicons name="copy-outline" size={18} color={theme.primary} />
              </Pressable>
            </View>
          </View>

          {/* WhatsApp-Style Direct Friend QR Code Card */}
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.surface,
                borderTopColor: theme.divider,
                borderBottomColor: theme.divider,
                alignItems: 'center',
                paddingVertical: tokens.spacing.lg,
              },
            ]}
          >
            <View style={styles.qrTitleRow}>
              <Ionicons name="qr-code" size={20} color={theme.primary} />
              <Text variant="h3">
                Friend QR Code
              </Text>
            </View>
            <Text variant="caption" colorRole="secondary" align="center" style={styles.qrSubtext}>
              Scan this QR code from ChatFlow scanner to directly add @{cleanUsername} as a friend!
            </Text>

            <View style={styles.qrBoxWrapper}>
              {isGeneratingQR ? (
                <View style={styles.qrLoadingBox}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text variant="caption" colorRole="secondary" style={{ marginTop: 8 }}>
                    Generating QR Code...
                  </Text>
                </View>
              ) : qrDataUrl ? (
                <Image
                  source={{ uri: qrDataUrl }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.qrLoadingBox}>
                  <Text variant="caption" colorRole="secondary">
                    QR code unavailable
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={handleCopyUsername}
              style={[styles.copyPill, { backgroundColor: theme.primary }]}
              accessibilityRole="button"
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
              <Text variant="caption" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                {copiedNotice ? 'Username Copied to Clipboard!' : `Copy @${cleanUsername}`}
              </Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* DP Lightbox Modal */}
        <MediaLightboxModal
          visible={Boolean(lightboxData)}
          data={lightboxData}
          onClose={() => setLightboxData(null)}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  scrollContent: {
    flex: 1,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: tokens.spacing.sm,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: tokens.spacing.md,
  },
  zoomBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#008069',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  displayNameText: {
    fontWeight: '700',
    marginBottom: 2,
  },
  usernameText: {
    marginBottom: tokens.spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
  },
  actionPill: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 16,
    minWidth: 76,
    gap: 4,
  },
  sectionCard: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: tokens.spacing.sm,
  },
  sectionHeader: {
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: tokens.spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
  },
  rowIcon: {
    marginRight: tokens.spacing.md,
  },
  copyButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  qrSubtext: {
    maxWidth: 280,
    marginBottom: tokens.spacing.md,
  },
  qrBoxWrapper: {
    padding: tokens.spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#008069',
    ...tokens.elevation[2],
    marginBottom: tokens.spacing.md,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  qrLoadingBox: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: tokens.radii.pill,
  },
});
