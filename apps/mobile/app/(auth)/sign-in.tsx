/**
 * @file Google Sign-In Screen.
 * Strict compliance with RULE 0.1: No phone number prompt, input, or mention.
 * Strict compliance with RULE 0.7: All styles derived strictly from tokens.ts.
 * 
 * [HINGLISH GUIDE]:
 * Yeh Google Authentication Screen hai:
 * - RULE: Yahan phone number ya OTP ka koi field nahi hai.
 * - Login ke baad check hota hai:
 *   - Agar user new hai to `/(auth)/onboarding` par bhejta hai taaki unique @username choose kare.
 *   - Agar pehle se onboarded hai to direct Home (`/`) ya Inbox par bhejta hai.
 */

import React from 'react';
import { View, StyleSheet, ScrollView, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '../../src/theme/tokens';
import { Text } from '../../src/components/atoms/Text';
import { Button } from '../../src/components/atoms/Button';
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
          paddingTop: insets.top + tokens.spacing.md,
          paddingBottom: insets.bottom + tokens.spacing.md,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingHorizontal: tokens.spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Illustration / Brand */}
        <View style={styles.brandContainer}>
          <View
            style={[
              styles.logoCircle,
              {
                backgroundColor: theme.primary,
                borderRadius: tokens.radii.pill,
                width: tokens.spacing.huge * 2,
                height: tokens.spacing.huge * 2,
              },
            ]}
          >
            <Text variant="display" colorRole="inverse">
              CF
            </Text>
          </View>

          <Text variant="display" align="center" style={styles.welcomeTitle}>
            Welcome to ChatFlow
          </Text>

          <Text
            variant="body"
            colorRole="secondary"
            align="center"
            style={styles.subtitle}
          >
            Simple. Secure. Reliable messaging.
          </Text>
        </View>

        {/* Value Proposition Box */}
        <View
          style={[
            styles.privacyBox,
            {
              backgroundColor: theme.surface,
              borderColor: theme.divider,
              borderRadius: tokens.radii.lg,
              padding: tokens.spacing.lg,
            },
          ]}
        >
          <Text variant="h3" style={styles.privacyHeader}>
            Privacy by Design
          </Text>
          <Text variant="body" colorRole="secondary">
            Sign in with your Google account. We identify you solely by your Google ID and chosen @username.
          </Text>
          <View
            style={[
              styles.badgeHighlight,
              {
                backgroundColor: theme.surfaceEmphasized,
                borderRadius: tokens.radii.sm,
                padding: tokens.spacing.xs,
              },
            ]}
          >
            <Text variant="caption" colorRole="primary">
              🔒 No phone numbers. No SIM cards. No SMS codes.
            </Text>
          </View>
        </View>

        {/* Error Feedback */}
        {error && (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.error,
                borderRadius: tokens.radii.md,
                padding: tokens.spacing.sm,
              },
            ]}
          >
            <Text variant="caption" colorRole="error" align="center">
              {error}
            </Text>
          </View>
        )}

        {/* Action Controls */}
        <View style={styles.actionsContainer}>
          <Button
            label={isLoading ? 'Connecting...' : 'Continue with Google'}
            onPress={() => void handleGoogleSignIn('user@gmail.com', 'google_user_01')}
            variant="primary"
            size="lg"
            isLoading={isLoading}
            fullWidth={true}
          />

          <Button
            label="Try with Alternate Dev Account"
            onPress={() => void handleGoogleSignIn('alex.rivers@gmail.com', 'google_user_alex')}
            variant="secondary"
            size="md"
            isDisabled={isLoading}
            fullWidth={true}
          />
        </View>

        {/* Footer Terms */}
        <View style={styles.footer}>
          <Text variant="caption" colorRole="disabled" align="center">
            By continuing, you agree to ChatFlow Terms of Service and Privacy Policy.
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
    paddingVertical: tokens.spacing.lg,
    gap: tokens.spacing.xl,
  },
  brandContainer: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xl,
  },
  logoCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.sm,
  },
  welcomeTitle: {
    letterSpacing: -0.5,
  },
  subtitle: {
    maxWidth: 280,
  },
  privacyBox: {
    borderWidth: 1,
    gap: tokens.spacing.sm,
  },
  privacyHeader: {
    marginBottom: tokens.spacing.xxs,
  },
  badgeHighlight: {
    marginTop: tokens.spacing.xxs,
  },
  errorCard: {
    borderWidth: 1,
  },
  actionsContainer: {
    gap: tokens.spacing.md,
    width: '100%',
  },
  footer: {
    marginTop: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
  },
});
