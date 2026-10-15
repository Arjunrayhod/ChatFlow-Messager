/**
 * @file Application Gateway / Router Entrypoint.
 * Automatically and seamlessly directs users to:
 * - /(tabs)/chats if already logged in and onboarded.
 * - /(auth)/onboarding if logged in without @username.
 * - /(auth)/sign-in (WhatsApp Welcome Screen) if unauthenticated.
 * Strict compliance with RULE 0.1 (No phone numbers) and RULE 0.7 (Design tokens).
 * 
 * [HINGLISH GUIDE]:
 * Yeh app ka smart router hai:
 * - Logged-in user ko turant main WhatsApp chat inbox (/(tabs)/chats) par bhejta hai.
 * - New user ko Welcome Screen par redirect karta hai.
 * - Koi ugly developer card beech me nahi dikhta.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../src/theme/tokens';
import { Text } from '../src/components/atoms/Text';
import { useAuthStore } from '../src/store/useAuthStore';
import { useHealthStore } from '../src/store/useHealthStore';

export default function GatewayScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const { isAuthenticated, isOnboarded, isLoading: isAuthLoading } = useAuthStore();
  const { checkHealth } = useHealthStore();

  useEffect(() => {
    // Probe backend connectivity in background
    void checkHealth();

    // Small delay to allow Zustand hydration, then route smoothly
    const timer = setTimeout(() => {
      if (isAuthenticated && isOnboarded) {
        router.replace('/(tabs)/chats');
      } else if (isAuthenticated && !isOnboarded) {
        router.replace('/(auth)/onboarding');
      } else {
        router.replace('/(auth)/sign-in');
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isOnboarded, router, checkHealth]);

  return (
    <View style={[styles.splashRoot, { backgroundColor: theme.background }]}>
      {/* WhatsApp-Style Splash Center Logo */}
      <View style={styles.centerBrand}>
        <View
          style={[
            styles.brandIconCircle,
            {
              backgroundColor: theme.surface,
              borderColor: theme.primary,
            },
          ]}
        >
          <Ionicons name="chatbubbles" size={60} color={theme.primary} />
        </View>
        <Text variant="h1" align="center" style={styles.splashTitle}>
          ChatFlow
        </Text>
        <ActivityIndicator
          size="small"
          color={theme.primary}
          style={{ marginTop: tokens.spacing.md }}
        />
      </View>

      {/* Splash Footer */}
      <View style={styles.splashFooter}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  splashRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.huge,
  },
  centerBrand: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  brandIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: tokens.spacing.md,
  },
  splashTitle: {
    letterSpacing: -0.5,
  },
  splashFooter: {
    alignItems: 'center',
    gap: 2,
  },
  footerBrand: {
    fontWeight: '700',
    letterSpacing: 2.5,
  },
});
