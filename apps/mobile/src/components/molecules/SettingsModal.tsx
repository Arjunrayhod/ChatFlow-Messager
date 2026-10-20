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

import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  useColorScheme,
  Alert,
  Linking,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadMedia, checkUsernameAvailability } from '../../services/api';
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

  const { user, token, signOut, updateProfile } = useAuthStore();
  const { latencyMs, isConnected } = useHealthStore();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);

  // Profile & DP Edit State
  const [isUploadingDP, setIsUploadingDP] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean;
    message: string;
  }>({ checking: false, available: true, message: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openEditModal = () => {
    setEditDisplayName(user?.displayName || '');
    setEditUsername(user?.username || '');
    setEditBio(user?.bio || '');
    setUsernameStatus({ checking: false, available: true, message: 'Current username' });
    setIsEditingProfile(true);
  };

  const handleUsernameChange = (text: string) => {
    const clean = text.replace(/^@/, '').toLowerCase().trim();
    setEditUsername(clean);

    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);

    if (!clean || clean.length < 3) {
      setUsernameStatus({ checking: false, available: false, message: 'Username must be at least 3 characters' });
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
      setUsernameStatus({ checking: false, available: false, message: 'Only letters, numbers, and _ (3-20 chars)' });
      return;
    }

    if (clean === user?.username?.toLowerCase()) {
      setUsernameStatus({ checking: false, available: true, message: 'Current username' });
      return;
    }

    setUsernameStatus({ checking: true, available: false, message: 'Checking availability...' });

    checkTimerRef.current = setTimeout(async () => {
      const res = await checkUsernameAvailability(clean);
      if (res.ok && res.data.available) {
        setUsernameStatus({ checking: false, available: true, message: `@${clean} is available! ✨` });
      } else {
        const errorReason = res.ok ? res.data.reason : res.error.message;
        setUsernameStatus({ checking: false, available: false, message: errorReason || `@${clean} is already taken` });
      }
    }, 400);
  };

  const handlePickAvatar = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Needed', 'Gallery se profile picture select karne ke liye permission allow karein.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      setIsUploadingDP(true);

      let base64Data = asset.base64;
      if (!base64Data && asset.uri) {
        const resp = await fetch(asset.uri);
        const blob = await resp.blob();
        base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result as string;
            resolve(res.replace(/^data:[^;]+;base64,/, ''));
          };
          reader.readAsDataURL(blob);
        });
      }

      if (!base64Data) {
        throw new Error('Image data read nahi ho paya');
      }

      const uploadResult = await uploadMedia(
        {
          fileName: asset.fileName || 'profile_avatar.jpg',
          mimeType: asset.mimeType || 'image/jpeg',
          data: base64Data,
          isHD: true,
        },
        token || undefined
      );

      if (!uploadResult.ok) {
        throw new Error(uploadResult.error.message || 'Image upload failed');
      }

      const updateResult = await updateProfile({ avatarUrl: uploadResult.data.url });
      if (updateResult.success) {
        Alert.alert('DP Updated', 'Profile photo successfully change ho gayi hai! 📸');
      } else {
        throw new Error(updateResult.error || 'Failed to update profile');
      }
    } catch (err: any) {
      console.warn('[SettingsModal] handlePickAvatar error:', err);
      Alert.alert('DP Error', err?.message || 'Profile photo update nahi ho payi.');
    } finally {
      setIsUploadingDP(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editDisplayName.trim()) {
      Alert.alert('Required', 'Display name cannot be empty.');
      return;
    }
    if (!usernameStatus.available) {
      Alert.alert('Invalid Username', usernameStatus.message || 'Please choose an available username.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const result = await updateProfile({
        displayName: editDisplayName.trim(),
        username: editUsername,
        bio: editBio.trim(),
      });

      if (result.success) {
        setIsEditingProfile(false);
        Alert.alert('Success', 'Profile aur username successfully save ho gaya!');
      } else {
        Alert.alert('Save Failed', result.error || 'Profile update failed.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

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
            <View style={styles.avatarWrapper}>
              <Avatar
                name={user?.displayName || 'User'}
                uri={user?.avatarUrl}
                size="lg"
                presence="online"
                onPress={handlePickAvatar}
              />
              <Pressable
                onPress={handlePickAvatar}
                disabled={isUploadingDP}
                style={[
                  styles.cameraBadge,
                  { backgroundColor: theme.primary, borderColor: theme.surface },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Change profile picture"
              >
                {isUploadingDP ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={14} color="#FFFFFF" />
                )}
              </Pressable>
            </View>

            <Pressable
              onPress={openEditModal}
              style={styles.profileTextCol}
              accessibilityRole="button"
              accessibilityLabel="Edit profile and username"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text variant="h2" numberOfLines={1}>
                  {user?.displayName || 'ChatFlow User'}
                </Text>
                <Ionicons name="pencil" size={14} color={theme.primary} />
              </View>
              <Text variant="bodyMedium" colorRole="primary" style={styles.usernameText}>
                @{user?.username || 'username'}
              </Text>
              <Text variant="caption" colorRole="secondary" numberOfLines={1}>
                {user?.bio || 'Hey there! I am using ChatFlow.'}
              </Text>
            </Pressable>

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

            {/* Notifications & Calls Item */}
            <Pressable
              onPress={async () => {
                if (typeof window !== 'undefined' && 'Notification' in window) {
                  try {
                    const res = await Notification.requestPermission();
                    if (res === 'granted') {
                      if ('serviceWorker' in navigator) {
                        const reg = await navigator.serviceWorker.ready;
                        await reg.showNotification('Notifications Active 🔔', {
                          body: 'Incoming calls aur messages ke alerts notification bar me aayenge!',
                          icon: '/icon-192.png',
                          badge: '/icon-192.png',
                        });
                      }
                      Alert.alert('Notifications Enabled', 'Call aur message alerts ab phone ke notification bar me show honge!');
                    } else {
                      Alert.alert('Permission Denied', 'Browser settings me jakar Notifications ko Allow karein.');
                    }
                  } catch (e: any) {
                    Alert.alert('Error', e?.message || 'Could not request notification permission.');
                  }
                } else {
                  Alert.alert('Notifications Active', 'Phone notifications configured.');
                }
              }}
              style={({ pressed }) => [
                styles.settingItem,
                {
                  backgroundColor: pressed ? theme.surfaceEmphasized : theme.surface,
                  borderBottomColor: theme.divider,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Notifications & Calls"
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.surfaceEmphasized },
                ]}
              >
                <Ionicons name="notifications-outline" size={22} color={theme.primary} />
              </View>
              <View style={styles.itemTextCol}>
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                  Notifications & Calls
                </Text>
                <Text variant="caption" colorRole="secondary">
                  Tap to enable or test background call & message alerts
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

        {/* WhatsApp-Style Edit Profile Modal */}
        {isEditingProfile && (
          <Modal
            visible={isEditingProfile}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setIsEditingProfile(false)}
          >
            <View style={[styles.modalRoot, { backgroundColor: theme.background }]}>
              {/* Header */}
              <View
                style={[
                  styles.headerBar,
                  {
                    backgroundColor: theme.surface,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.divider,
                    paddingTop: Math.max(insets.top, tokens.spacing.sm),
                  },
                ]}
              >
                <Pressable
                  onPress={() => setIsEditingProfile(false)}
                  style={styles.backButton}
                  accessibilityRole="button"
                >
                  <Ionicons name="close" size={24} color={theme.textPrimary} />
                </Pressable>
                <Text variant="h2" style={[styles.headerTitle, { color: theme.textPrimary }]}>
                  Edit Profile
                </Text>
                <Pressable
                  onPress={() => void handleSaveProfile()}
                  disabled={isSavingProfile || !usernameStatus.available}
                  style={[
                    styles.saveButton,
                    {
                      backgroundColor: usernameStatus.available ? theme.primary : theme.textDisabled,
                      opacity: isSavingProfile ? 0.6 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                >
                  {isSavingProfile ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text variant="bodyMedium" colorRole="inverse" style={{ fontWeight: '700' }}>
                      Save
                    </Text>
                  )}
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={{ padding: tokens.spacing.lg, gap: tokens.spacing.lg }}
                showsVerticalScrollIndicator={false}
              >
                {/* DP Picker Section */}
                <View style={{ alignItems: 'center', marginVertical: tokens.spacing.md }}>
                  <View style={styles.avatarWrapper}>
                    <Avatar
                      name={editDisplayName || user?.displayName || 'User'}
                      uri={user?.avatarUrl}
                      size="xl"
                      presence="online"
                      onPress={handlePickAvatar}
                    />
                    <Pressable
                      onPress={handlePickAvatar}
                      disabled={isUploadingDP}
                      style={[
                        styles.cameraBadgeLarge,
                        { backgroundColor: theme.primary, borderColor: theme.background },
                      ]}
                      accessibilityRole="button"
                    >
                      {isUploadingDP ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons name="camera" size={20} color="#FFFFFF" />
                      )}
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={handlePickAvatar}
                    style={{ marginTop: tokens.spacing.sm, paddingVertical: 4 }}
                  >
                    <Text variant="bodyMedium" colorRole="primary" style={{ fontWeight: '600' }}>
                      {isUploadingDP ? 'Uploading new photo...' : 'Change Profile Picture'}
                    </Text>
                  </Pressable>
                </View>

                {/* Display Name Input */}
                <View style={styles.inputGroup}>
                  <Text variant="caption" colorRole="secondary" style={styles.inputLabel}>
                    YOUR NAME
                  </Text>
                  <TextInput
                    value={editDisplayName}
                    onChangeText={setEditDisplayName}
                    placeholder="Enter your name"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.inputField,
                      {
                        backgroundColor: theme.surface,
                        color: theme.textPrimary,
                        borderColor: theme.divider,
                      },
                    ]}
                    maxLength={50}
                  />
                  <Text variant="caption" colorRole="secondary">
                    This is not your username. This name will be visible to your ChatFlow contacts.
                  </Text>
                </View>

                {/* Username Input with live validation */}
                <View style={styles.inputGroup}>
                  <Text variant="caption" colorRole="secondary" style={styles.inputLabel}>
                    USERNAME
                  </Text>
                  <View
                    style={[
                      styles.usernameInputRow,
                      {
                        backgroundColor: theme.surface,
                        borderColor:
                          usernameStatus.checking
                            ? theme.primary
                            : usernameStatus.available
                            ? theme.success
                            : theme.error,
                      },
                    ]}
                  >
                    <Text variant="bodyMedium" style={{ color: theme.primary, fontWeight: '700', paddingLeft: 12 }}>
                      @
                    </Text>
                    <TextInput
                      value={editUsername}
                      onChangeText={handleUsernameChange}
                      placeholder="username"
                      placeholderTextColor={theme.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={[
                        styles.usernameInputField,
                        { color: theme.textPrimary },
                      ]}
                      maxLength={20}
                    />
                    <View style={{ paddingRight: 12 }}>
                      {usernameStatus.checking ? (
                        <ActivityIndicator size="small" color={theme.primary} />
                      ) : usernameStatus.available ? (
                        <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                      ) : (
                        <Ionicons name="close-circle" size={20} color={theme.error} />
                      )}
                    </View>
                  </View>
                  <Text
                    variant="caption"
                    style={{
                      color: usernameStatus.available ? theme.success : theme.error,
                      marginTop: 2,
                    }}
                  >
                    {usernameStatus.message || 'Unique handle for contacts to find you (3-20 characters)'}
                  </Text>
                </View>

                {/* Bio / About Input */}
                <View style={styles.inputGroup}>
                  <Text variant="caption" colorRole="secondary" style={styles.inputLabel}>
                    ABOUT
                  </Text>
                  <TextInput
                    value={editBio}
                    onChangeText={setEditBio}
                    placeholder="Hey there! I am using ChatFlow."
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.inputField,
                      {
                        backgroundColor: theme.surface,
                        color: theme.textPrimary,
                        borderColor: theme.divider,
                      },
                    ]}
                    maxLength={140}
                  />
                </View>
              </ScrollView>
            </View>
          </Modal>
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
  avatarWrapper: {
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadgeLarge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.pill,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  inputField: {
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    fontSize: 16,
  },
  usernameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: tokens.radii.md,
    borderWidth: 1.5,
  },
  usernameInputField: {
    flex: 1,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
    fontSize: 16,
  },
});
