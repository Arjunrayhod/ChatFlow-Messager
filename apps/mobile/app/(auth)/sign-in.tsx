/**
 * @file WhatsApp-authentic Welcome & Google Sign-In Screen.
 * Replicates WhatsApp's iconic onboarding visual design:
 * - Circular branded illustration
 * - "Welcome to ChatFlow" header
 * - Terms of Service & Privacy Policy acceptance
 * - Full-width "Agree and continue" emerald pill button
 * - Multi-account switcher (for testing)
 * Strict compliance with RULE 0.1 (Zero phone numbers) and RULE 0.7 (Design system tokens).
 * 
 * [HINGLISH GUIDE]:
 * Yeh WhatsApp jaisa authentic Welcome Screen hai:
 * 1. Hero Circle: WhatsApp jaisa circular graphic aur brand logo.
 * 2. Privacy Policy & Terms acceptance note.
 * 3. "Agree and continue with Google" ka rounded pill button.
 * 4. Multi-account switch chip taaki do users aapas me bina kisi glitch ke test kar sakein.
 * 5. Bottom "from CHATFLOW" footer.
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  useColorScheme,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../src/theme/tokens';
import { Text } from '../../src/components/atoms/Text';
import { Avatar } from '../../src/components/atoms/Avatar';
import { BrandFooter } from '../../src/components/atoms/BrandFooter';
import { useAuthStore } from '../../src/store/useAuthStore';
import { isFirebaseConfigured } from '../../src/services/firebase';

const CHATFLOW_LOGO = require('../../assets/logo.jpeg');

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const { signInWithGoogle, isLoading, error, isAuthenticated, isOnboarded } = useAuthStore();
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [gmailInput, setGmailInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isAuthenticated && isOnboarded) {
      router.replace('/(tabs)/chats');
    }
  }, [isAuthenticated, isOnboarded, router]);

  const handleGoogleButtonClick = async () => {
    setValidationError(null);
    setIsGoogleModalOpen(true);
  };

  const handleGoogleSignIn = async (email?: string) => {
    setValidationError(null);
    const targetEmail = email || gmailInput.trim();

    if (!isFirebaseConfigured() && !targetEmail) {
      setValidationError('Please enter your personal Gmail address');
      return;
    }

    if (targetEmail) {
      const clean = targetEmail.trim().toLowerCase();
      if (!clean.endsWith('@gmail.com') && !clean.endsWith('@googlemail.com')) {
        setValidationError('Only real personal @gmail.com accounts are permitted');
        return;
      }
    }

    const success = await signInWithGoogle(targetEmail || undefined);
    if (success) {
      setIsGoogleModalOpen(false);
      const { isOnboarded } = useAuthStore.getState();
      if (!isOnboarded) {
        router.replace('/(auth)/onboarding');
      } else {
        router.replace('/(tabs)/chats');
      }
    }
  };


  return (
    <View
      style={[
        styles.safeArea,
        {
          backgroundColor: theme.background,
          paddingTop: Math.max(insets.top, tokens.spacing.md),
          paddingBottom: Math.max(insets.bottom, tokens.spacing.md),
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Title */}
        <View style={styles.topHeader}>
          <Text variant="h1" align="center" style={styles.welcomeTitle}>
            Welcome to ChatFlow
          </Text>
        </View>

        {/* WhatsApp-Style Circular Hero Illustration with Custom Logo */}
        <View style={styles.heroIllustrationContainer}>
          <View
            style={[
              styles.outerCircle,
              {
                backgroundColor: theme.surface,
                borderColor: theme.divider,
                ...tokens.elevation[3],
              },
            ]}
          >
            <Image
              source={CHATFLOW_LOGO}
              style={styles.heroLogoImage}
              resizeMode="cover"
            />
          </View>
        </View>

        {/* Middle Section: WhatsApp Terms & Privacy Notice */}
        <View style={styles.termsContainer}>
          <Text
            variant="body"
            colorRole="secondary"
            align="center"
            style={styles.termsText}
          >
            Read our{' '}
            <Text variant="body" style={[styles.linkText, { color: theme.primary }]}>
              Privacy Policy
            </Text>
            . Tap "Agree and continue" to accept the{' '}
            <Text variant="body" style={[styles.linkText, { color: theme.primary }]}>
              Terms of Service
            </Text>
            .
          </Text>

          {/* Privacy Guarantee Pill */}
          <View
            style={[
              styles.privacyPill,
              {
                backgroundColor: theme.surface,
                borderColor: theme.divider,
                borderRadius: tokens.radii.pill,
              },
            ]}
          >
            <Ionicons name="shield-checkmark" size={16} color={theme.primary} />
            <Text variant="caption" colorRole="secondary" style={styles.privacyPillText}>
              No phone numbers. Secured with Google & @username.
            </Text>
          </View>

          {/* Error Message Feedback */}
          {error && (
            <View
              style={[
                styles.errorCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.error,
                  borderRadius: tokens.radii.md,
                },
              ]}
            >
              <Ionicons name="alert-circle" size={18} color={theme.error} />
              <Text variant="caption" colorRole="error" style={{ flex: 1 }}>
                {error}
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons Area */}
        <View style={styles.actionsContainer}>
          {/* Main WhatsApp "Agree and continue" Pill Button */}
          <Pressable
            onPress={() => void handleGoogleButtonClick()}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.agreeButton,
              {
                backgroundColor: theme.primary,
                borderRadius: tokens.radii.pill,
                opacity: pressed || isLoading ? 0.85 : 1,
                ...tokens.elevation[2],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Agree and continue with Google"
          >
            {isLoading ? (
              <ActivityIndicator color={theme.textInverse} size="small" />
            ) : (
              <View style={styles.buttonContentRow}>
                <Ionicons name="logo-google" size={20} color={theme.textInverse} />
                <Text
                  variant="bodyMedium"
                  colorRole="inverse"
                  style={styles.agreeButtonText}
                >
                  Agree and continue with Google
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* WhatsApp-Style Footer with Creator Branding */}
        <BrandFooter style={styles.footerContainer} showSubtitle={true} />
      </ScrollView>

      {/* Google Account Sign-In Modal */}
      <Modal
        visible={isGoogleModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsGoogleModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setIsGoogleModalOpen(false)}
          />
          <View
            style={[
              styles.googleModalCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.divider,
                borderRadius: tokens.radii.lg,
                ...tokens.elevation[4],
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.googleModalHeader}>
              <View
                style={[
                  styles.googleIconBadge,
                  {
                    backgroundColor: theme.surfaceEmphasized,
                    borderColor: theme.divider,
                  },
                ]}
              >
                <Ionicons name="logo-google" size={28} color="#4285F4" />
              </View>
              <Text variant="h2" align="center" style={styles.googleModalTitle}>
                Sign in with Google
              </Text>
              <Text variant="caption" colorRole="secondary" align="center">
                Enter your real Gmail account to continue to ChatFlow
              </Text>
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text variant="caption" colorRole="secondary" style={styles.inputLabel}>
                Gmail Address
              </Text>
              <View
                style={[
                  styles.textInputWrapper,
                  {
                    backgroundColor: theme.background,
                    borderColor: validationError ? theme.error : theme.divider,
                    borderRadius: tokens.radii.sm,
                  },
                ]}
              >
                <Ionicons name="mail-outline" size={18} color={theme.textSecondary} style={{ marginLeft: 12 }} />
                <TextInput
                  value={gmailInput}
                  onChangeText={(text) => {
                    setGmailInput(text);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="name@gmail.com"
                  placeholderTextColor={theme.textDisabled}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.textInputField,
                    {
                      color: theme.textPrimary,
                    },
                  ]}
                />
              </View>

              {(validationError || error) && (
                <View style={styles.validationErrorRow}>
                  <Ionicons name="alert-circle" size={14} color={theme.error} />
                  <Text variant="caption" colorRole="error" style={{ flex: 1 }}>
                    {validationError || error}
                  </Text>
                </View>
              )}

              <Text variant="caption" colorRole="disabled" style={styles.privacyGuaranteeText}>
                No phone numbers collected. Account strictly verified via Google & @username.
              </Text>
            </View>

            {/* Modal Action Buttons */}
            <View style={styles.modalActionButtons}>
              <Pressable
                onPress={() => setIsGoogleModalOpen(false)}
                disabled={isLoading}
                style={[
                  styles.modalCancelButton,
                  {
                    borderColor: theme.divider,
                    borderRadius: tokens.radii.pill,
                  },
                ]}
              >
                <Text variant="body" colorRole="secondary">
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void handleGoogleSignIn()}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.modalSubmitButton,
                  {
                    backgroundColor: theme.primary,
                    borderRadius: tokens.radii.pill,
                    opacity: pressed || isLoading ? 0.85 : 1,
                  },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color={theme.textInverse} size="small" />
                ) : (
                  <Text variant="bodyMedium" colorRole="inverse" style={{ fontWeight: '600' }}>
                    Continue
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.lg,
  },
  topHeader: {
    alignItems: 'center',
    marginTop: tokens.spacing.lg,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  heroIllustrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: tokens.spacing.xl,
  },
  outerCircle: {
    width: 210,
    height: 210,
    borderRadius: 105,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
  },
  heroLogoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 105,
  },
  termsContainer: {
    alignItems: 'center',
    gap: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.sm,
  },
  termsText: {
    lineHeight: 20,
    maxWidth: 320,
  },
  linkText: {
    fontWeight: '600',
  },
  privacyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderWidth: 1,
    gap: tokens.spacing.xs,
  },
  privacyPillText: {
    fontSize: 12,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing.sm,
    borderWidth: 1,
    gap: tokens.spacing.xs,
    width: '100%',
  },
  actionsContainer: {
    marginTop: tokens.spacing.xl,
    gap: tokens.spacing.md,
    width: '100%',
  },
  agreeButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
  },
  buttonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  agreeButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  accountSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderWidth: 1,
    gap: tokens.spacing.md,
  },
  accountSwitchTextCol: {
    flex: 1,
    gap: 1,
  },
  footerContainer: {
    marginTop: tokens.spacing.xxl,
    alignItems: 'center',
    gap: 2,
  },
  footerBrand: {
    fontWeight: '700',
    letterSpacing: 2.5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  googleModalCard: {
    width: '100%',
    maxWidth: 420,
    padding: tokens.spacing.xl,
    borderWidth: 1,
    gap: tokens.spacing.lg,
  },
  googleModalHeader: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  googleIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: tokens.spacing.xs,
  },
  googleModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  inputContainer: {
    gap: tokens.spacing.xs,
  },
  inputLabel: {
    fontWeight: '600',
    fontSize: 13,
  },
  textInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    minHeight: 48,
  },
  textInputField: {
    flex: 1,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
    fontSize: 16,
  },
  validationErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.xs,
  },
  privacyGuaranteeText: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: tokens.spacing.xs,
  },
  modalActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.sm,
  },
  modalCancelButton: {
    minHeight: 42,
    paddingHorizontal: tokens.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalSubmitButton: {
    minHeight: 42,
    paddingHorizontal: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
