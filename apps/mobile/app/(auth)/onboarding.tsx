/**
 * @file Profile Onboarding & Username Setup Screen.
 * Enforces RULE 0.1: Identity strictly via @username and Google email.
 * Enforces RULE 0.7: All components import from theme/tokens.ts.
 * 
 * [HINGLISH GUIDE]:
 * Yeh Onboarding Screen hai jaha new user apna account setup karta hai:
 * 1. Display Name: Jo naam chats me doosro ko dikhega.
 * 2. Unique @username: Har user ka unique handle (jaise @alex, @rahul).
 *    - Isme 400ms ka debounce laga hai: type karte hi server se check hota hai ki username available hai ya nahi.
 * 3. Bio / About: Optional status message.
 * Setup complete hote hi user backend database me register ho jata hai.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '../../src/theme/tokens';
import { Text } from '../../src/components/atoms/Text';
import { Button } from '../../src/components/atoms/Button';
import { Avatar } from '../../src/components/atoms/Avatar';
import { TextInputField } from '../../src/components/atoms/TextInputField';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('Hey there! I am using ChatFlow.');

  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameValid, setIsUsernameValid] = useState(false);
  const [usernameFeedback, setUsernameFeedback] = useState<string | null>(null);

  const { checkUsername, onboardUser, isLoading, error } = useAuthStore();

  // Debounced username availability validation
  const validateUsername = useCallback(
    async (rawName: string) => {
      const clean = rawName.trim().replace(/^@/, '');
      if (clean.length < 3) {
        setIsUsernameValid(false);
        setUsernameFeedback(
          clean.length > 0
            ? 'Username must be at least 3 characters'
            : null
        );
        return;
      }

      setIsCheckingUsername(true);
      const result = await checkUsername(clean);
      setIsCheckingUsername(false);

      if (result.available) {
        setIsUsernameValid(true);
        setUsernameFeedback(null);
      } else {
        setIsUsernameValid(false);
        setUsernameFeedback(result.reason || 'Username is already taken');
      }
    },
    [checkUsername]
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      if (username) {
        void validateUsername(username);
      } else {
        setIsUsernameValid(false);
        setUsernameFeedback(null);
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [username, validateUsername]);

  const handleSubmit = async () => {
    if (!displayName.trim() || !username.trim() || !isUsernameValid) {
      return;
    }

    const success = await onboardUser({
      displayName: displayName.trim(),
      username: username.trim().replace(/^@/, ''),
      bio: bio.trim(),
    });

    if (success) {
      router.replace('/(tabs)/chats');
    }
  };

  const isFormValid = displayName.trim().length > 0 && isUsernameValid && !isLoading;

  return (
    <View
      style={[
        styles.safeArea,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top + tokens.spacing.sm,
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
        {/* Header Description */}
        <View style={styles.header}>
          <Text variant="h1">Profile Info</Text>
          <Text variant="body" colorRole="secondary">
            Please provide your display name and choose a unique @username.
          </Text>
        </View>

        {/* Avatar Preview */}
        <View style={styles.avatarSection}>
          <Avatar
            name={displayName || 'CF'}
            size="xl"
          />
          <Text variant="caption" colorRole="primary" style={styles.avatarHint}>
            Generated from your display name
          </Text>
        </View>

        {/* Input Form */}
        <View style={styles.form}>
          <TextInputField
            label="Display Name (Required)"
            placeholder="e.g. Jane Doe"
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={50}
            autoFocus={true}
          />

          <TextInputField
            label="Username (Required)"
            prefix="@"
            placeholder="janedoe"
            value={username}
            onChangeText={(text) => setUsername(text.toLowerCase())}
            errorMessage={usernameFeedback}
            isValid={isUsernameValid}
            helperText={
              isCheckingUsername
                ? 'Checking availability...'
                : isUsernameValid
                ? 'Username available!'
                : '3-20 characters: letters, numbers, underscores'
            }
            maxLength={20}
            autoCapitalize="none"
          />

          <TextInputField
            label="About / Bio (Optional)"
            placeholder="Hey there! I am using ChatFlow."
            value={bio}
            onChangeText={setBio}
            maxLength={140}
          />
        </View>

        {/* Server Error Message */}
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

        {/* Submit Action */}
        <View style={styles.actionSection}>
          <Button
            label={isLoading ? 'Setting up Profile...' : 'Complete Setup'}
            onPress={() => void handleSubmit()}
            variant="primary"
            size="lg"
            isDisabled={!isFormValid}
            isLoading={isLoading}
            fullWidth={true}
          />
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
    paddingVertical: tokens.spacing.md,
    gap: tokens.spacing.xl,
  },
  header: {
    gap: tokens.spacing.xxs,
  },
  avatarSection: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
  },
  avatarHint: {
    marginTop: tokens.spacing.xxs,
  },
  form: {
    gap: tokens.spacing.lg,
  },
  errorCard: {
    borderWidth: 1,
  },
  actionSection: {
    marginTop: tokens.spacing.sm,
  },
});
