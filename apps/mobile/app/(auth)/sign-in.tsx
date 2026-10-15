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

import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  useColorScheme,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../src/theme/tokens';
import { Text } from '../../src/components/atoms/Text';
import { Avatar } from '../../src/components/atoms/Avatar';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const { signInWithGoogle, isLoading, error } = useAuthStore();

  const handleGoogleSignIn = async (email?: string, uid?: string) => {
    const success = await signInWithGoogle(email, uid);
    if (success) {
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

        {/* WhatsApp-Style Circular Hero Illustration */}
        <View style={styles.heroIllustrationContainer}>
          <View
            style={[
              styles.outerCircle,
              {
                backgroundColor: theme.surface,
                borderColor: theme.divider,
              },
            ]}
          >
            {/* Inner Ring with WhatsApp Emerald Accent */}
            <View
              style={[
                styles.innerCircle,
                {
                  backgroundColor: theme.surfaceEmphasized,
                  borderColor: theme.primary,
                },
              ]}
            >
              <Ionicons name="chatbubbles" size={72} color={theme.primary} />
              <View
                style={[
                  styles.lockBadge,
                  {
                    backgroundColor: theme.primary,
                    borderColor: theme.background,
                  },
                ]}
              >
                <Ionicons name="lock-closed" size={16} color={theme.textInverse} />
              </View>
            </View>
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
            onPress={() => void handleGoogleSignIn()}
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

        {/* WhatsApp-Style Footer */}
        <View style={styles.footerContainer}>
          <Text variant="caption" colorRole="disabled" align="center">
            from
          </Text>
          <Text
            variant="caption"
            align="center"
            style={[styles.footerBrand, { color: theme.primary }]}
          >
            CHATFLOW
          </Text>
        </View>
      </ScrollView>
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
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  innerCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    position: 'relative',
  },
  lockBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
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
});
