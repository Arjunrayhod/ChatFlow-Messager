/**
 * @file Authentication layout handling sign-in and onboarding screen routing.
 * 
 * [HINGLISH GUIDE]:
 * Yeh (auth) route group ka layout hai.
 * Yahan 2 main screens hain:
 * 1. sign-in: Google Sign-In screen (no header)
 * 2. onboarding: Profile Setup screen (Back button enabled)
 */

import React from 'react';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { tokens } from '../../src/theme/tokens';

export default function AuthLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.background,
        },
        headerTintColor: theme.textPrimary,
        headerTitleStyle: {
          ...tokens.typography.h2,
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: theme.background,
        },
      }}
    >
      <Stack.Screen
        name="sign-in"
        options={{
          headerShown: false,
          title: 'Sign In',
        }}
      />
      <Stack.Screen
        name="onboarding"
        options={{
          title: 'Profile Setup',
          headerBackTitle: 'Back',
        }}
      />
    </Stack>
  );
}
