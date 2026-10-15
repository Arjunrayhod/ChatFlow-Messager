/**
 * @file WhatsApp-style Settings and Account Modal.
 * Displays user profile, privacy assurances, and authenticated Log Out flow.
 * Strict compliance with RULE 0.1 (Zero phone numbers) and RULE 0.7 (Design tokens).
 * 
 * [HINGLISH GUIDE]:
 * Yeh WhatsApp jaisa Settings & Profile modal hai:
 * 1. User Profile: Avatar, Display Name, unique @username, aur "Hey there! I am using ChatFlow."
 * 2. Privacy & Security: Zero phone number policy ka assurance.
 * 3. Log Out Button: WhatsApp-style confirmation popup ke sath cleanly logout karta hai.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  useColorScheme,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { Text } from '../atoms/Text';
import { Avatar } from '../atoms/Avatar';
import { Button } from '../atoms/Button';
import { BrandFooter } from '../atoms/BrandFooter';
import { useAuthStore } from '../../store/useAuthStore';
import { useHealthStore } from '../../store/useHealthStore';
import { QRCodeModal } from './QRCodeModal';

export interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const { user, signOut } = useAuthStore();
  const { latencyMs, isConnected } = useHealthStore();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);

  const handlePerformLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      setShowLogoutConfirm(false);
      onClose();
      router.replace('/(auth)/sign-in');
    } catch {
      setIsLoggingOut(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalRoot, { backgroundColor: theme.background }]}>
        {/* WhatsApp-style Header Bar */}
        <View
          style={[
            styles.headerBar,
            {
              backgroundColor: theme.primary,
              paddingTop: Math.max(insets.top, tokens.spacing.sm),
            },
          ]}
        >
          <Pressable
            onPress={onClose}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Close settings"
          >
            <Ionicons name="arrow-back" size={24} color={theme.textInverse} />
          </Pressable>
          <Text variant="h2" colorRole="inverse" style={styles.headerTitle}>
            Settings
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + tokens.spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* User Profile Card (WhatsApp Style) */}
          <View
            style={[
              styles.profileCard,
              {
                backgroundColor: theme.surface,
                borderBottomColor: theme.divider,
              },
            ]}
          >
            <Avatar
              name={user?.displayName || 'User'}
              uri={user?.avatarUrl}
              size="lg"
              presence="online"
            />
            <View style={styles.profileTextCol}>
              <Text variant="h2" numberOfLines={1}>
                {user?.displayName || 'ChatFlow User'}
              </Text>
              <Text variant="bodyMedium" colorRole="primary" style={styles.usernameText}>
                @{user?.username || 'username'}
              </Text>
              <Text variant="caption" colorRole="secondary" numberOfLines={1}>
                {user?.bio || 'Hey there! I am using ChatFlow.'}
              </Text>
            </View>
            <Pressable
              onPress={() => setIsQROpen(true)}
              style={({ pressed }) => [
                styles.qrIconButton,
                {
                  backgroundColor: theme.surfaceEmphasized,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="View and scan QR code"
            >
              <Ionicons name="qr-code-outline" size={24} color={theme.primary} />
            </Pressable>
          </View>

          {/* Section: WhatsApp Options List */}
          <View style={styles.sectionContainer}>
            {/* QR Code & Add Friends Item */}
            <Pressable
              onPress={() => setIsQROpen(true)}
              style={({ pressed }) => [
                styles.settingItem,
                {
                  backgroundColor: pressed ? theme.surfaceEmphasized : theme.surface,
                  borderBottomColor: theme.divider,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="QR Code & Add Friends"
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.surfaceEmphasized },
                ]}
              >
                <Ionicons name="qr-code-outline" size={22} color={theme.primary} />
              </View>
              <View style={styles.itemTextCol}>
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                  QR Code & Add Friends
                </Text>
                <Text variant="caption" colorRole="secondary">
                  Share your code or scan friends to chat
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textDisabled} />
            </Pressable>
            {/* Account & Privacy Item */}
            <View
              style={[
                styles.settingItem,
                {
                  backgroundColor: theme.surface,
                  borderBottomColor: theme.divider,
                },
              ]}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.surfaceEmphasized },
                ]}
              >
                <Ionicons name="key-outline" size={22} color={theme.primary} />
              </View>
              <View style={styles.itemTextCol}>
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                  Account & Privacy
                </Text>
                <Text variant="caption" colorRole="secondary">
                  Zero phone numbers • Google UID protected
                </Text>
              </View>
            </View>

            {/* Chats & Encryption Item */}
            <View
              style={[
                styles.settingItem,
                {
                  backgroundColor: theme.surface,
                  borderBottomColor: theme.divider,
                },
              ]}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.surfaceEmphasized },
                ]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.primary} />
              </View>
              <View style={styles.itemTextCol}>
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                  Chats & Real-time Sync
                </Text>
                <Text variant="caption" colorRole="secondary">
                  Socket.IO room architecture • Live message delivery
                </Text>
              </View>
            </View>

            {/* Server Connection Health Item */}
            <View
              style={[
                styles.settingItem,
                {
                  backgroundColor: theme.surface,
                  borderBottomColor: theme.divider,
                },
              ]}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.surfaceEmphasized },
                ]}
              >
                <Ionicons
                  name={isConnected ? 'cloud-done-outline' : 'cloud-offline-outline'}
                  size={22}
                  color={isConnected ? theme.success : theme.error}
                />
              </View>
              <View style={styles.itemTextCol}>
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                  Server Connectivity
                </Text>
                <Text variant="caption" colorRole="secondary">
                  {isConnected ? `Online (${latencyMs ?? 5}ms latency)` : 'Connecting...'}
                </Text>
              </View>
            </View>

            {/* App Info Item */}
            <View
              style={[
                styles.settingItem,
                {
                  backgroundColor: theme.surface,
                  borderBottomColor: theme.divider,
                },
              ]}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.surfaceEmphasized },
                ]}
              >
                <Ionicons name="information-circle-outline" size={22} color={theme.textSecondary} />
              </View>
              <View style={styles.itemTextCol}>
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                  ChatFlow Version
                </Text>
                <Text variant="caption" colorRole="secondary">
                  v1.0.0 (Phase 4 Build)
                </Text>
              </View>
            </View>

            {/* Creator / Cloud Architect Profile */}
            <Pressable
              onPress={() => void Linking.openURL('https://www.linkedin.com/in/arjun-rathod-cloud/')}
              style={({ pressed }) => [
                styles.settingItem,
                {
                  backgroundColor: theme.surface,
                  borderBottomColor: theme.divider,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              accessibilityRole="link"
              accessibilityLabel="Connect with Arjun Rathod on LinkedIn"
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: '#0077B515' },
                ]}
              >
                <Ionicons name="logo-linkedin" size={22} color="#0077B5" />
              </View>
              <View style={styles.itemTextCol}>
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                  Creator & Cloud Architect
                </Text>
                <Text variant="caption" colorRole="secondary">
                  Arjun Rathod • Tap to visit LinkedIn
                </Text>
              </View>
              <Ionicons name="open-outline" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* WhatsApp-Style Log Out Button */}
          <View style={styles.logoutSection}>
            <Pressable
              onPress={() => setShowLogoutConfirm(true)}
              style={({ pressed }) => [
                styles.logoutButtonRow,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.divider,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Log out of ChatFlow"
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: 'rgba(234, 0, 56, 0.1)' },
                ]}
              >
                <Ionicons name="log-out-outline" size={22} color={theme.error} />
              </View>
              <View style={styles.itemTextCol}>
                <Text variant="bodyMedium" colorRole="error" style={{ fontWeight: '700' }}>
                  Log Out
                </Text>
                <Text variant="caption" colorRole="secondary">
                  Sign out of this device
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Footer Branding */}
          <BrandFooter style={styles.footerBrand} showSubtitle={true} />
        </ScrollView>

        {/* WhatsApp-Style Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <View style={[styles.confirmOverlay, { backgroundColor: theme.overlay }]}>
            <View
              style={[
                styles.confirmCard,
                {
                  backgroundColor: theme.surface,
                  borderRadius: tokens.radii.lg,
                  ...tokens.elevation[3],
                },
              ]}
            >
              <View style={styles.confirmHeader}>
                <Ionicons name="log-out" size={32} color={theme.error} />
                <Text variant="h2" align="center" style={{ marginTop: tokens.spacing.xs }}>
                  Log out of ChatFlow?
                </Text>
                <Text
                  variant="body"
                  colorRole="secondary"
                  align="center"
                  style={styles.confirmDescription}
                >
                  You will need to sign in again to send and receive messages with your contacts.
                </Text>
              </View>

              <View style={styles.confirmActionsRow}>
                <Pressable
                  onPress={() => setShowLogoutConfirm(false)}
                  disabled={isLoggingOut}
                  style={[
                    styles.confirmButton,
                    {
                      borderColor: theme.divider,
                      borderWidth: 1,
                      borderRadius: tokens.radii.pill,
                    },
                  ]}
                >
                  <Text variant="bodyMedium" colorRole="secondary">
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => void handlePerformLogout()}
                  disabled={isLoggingOut}
                  style={[
                    styles.confirmButton,
                    {
                      backgroundColor: theme.error,
                      borderRadius: tokens.radii.pill,
                    },
                  ]}
                >
                  <Text variant="bodyMedium" colorRole="inverse" style={{ fontWeight: '700' }}>
                    {isLoggingOut ? 'Logging out...' : 'Log Out'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        <QRCodeModal
          visible={isQROpen}
          onClose={() => setIsQROpen(false)}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  backButton: {
    minWidth: tokens.spacing.huge,
    minHeight: tokens.spacing.huge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingBottom: tokens.spacing.huge * 2,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.lg,
    borderBottomWidth: 1,
    gap: tokens.spacing.md,
  },
  profileTextCol: {
    flex: 1,
    gap: 2,
  },
  qrIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usernameText: {
    fontWeight: '700',
  },
  sectionContainer: {
    marginTop: tokens.spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: tokens.spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextCol: {
    flex: 1,
    gap: 2,
  },
  logoutSection: {
    marginTop: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.md,
  },
  logoutButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    gap: tokens.spacing.md,
  },
  footerBrand: {
    marginTop: tokens.spacing.xxxl,
    alignItems: 'center',
    gap: 2,
  },
  footerMeta: {
    fontWeight: '700',
    letterSpacing: 2,
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
    zIndex: 999,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 340,
    padding: tokens.spacing.xl,
    alignItems: 'center',
    gap: tokens.spacing.lg,
  },
  confirmHeader: {
    alignItems: 'center',
  },
  confirmDescription: {
    marginTop: tokens.spacing.xs,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.md,
  },
});
