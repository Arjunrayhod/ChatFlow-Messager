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
import { View, StyleSheet, ActivityIndicator, useColorScheme, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '../src/theme/tokens';
import { Text } from '../src/components/atoms/Text';
import { BrandFooter } from '../src/components/atoms/BrandFooter';
import { useAuthStore } from '../src/store/useAuthStore';
import { useHealthStore } from '../src/store/useHealthStore';

const CHATFLOW_LOGO = require('../assets/logo.jpeg');

export default function GatewayScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const { isAuthenticated, isOnboarded, isLoading: isAuthLoading } = useAuthStore();
  const { checkHealth } = useHealthStore();

  useEffect(() => {
    // Probe backend connectivity in background safely
    void checkHealth().catch((err) => {
      console.warn('[Gateway] Health probe error ignored safely:', err);
    });

    // Smooth splash delay for WhatsApp-style brand reveal
    const timer = setTimeout(() => {
      try {
        if (isAuthenticated && isOnboarded) {
          router.replace('/(tabs)/chats');
        } else if (isAuthenticated && !isOnboarded) {
          router.replace('/(auth)/onboarding');
        } else {
          router.replace('/(auth)/sign-in');
        }
      } catch (navErr) {
        console.warn('[Gateway] Navigation transition error ignored safely:', navErr);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isOnboarded, router, checkHealth]);

  return (
    <View style={[styles.splashRoot, { backgroundColor: theme.background }]}>
      {/* WhatsApp-Style Splash Center Logo */}
      <View style={styles.centerBrand}>
        <View style={styles.logoContainer}>
          <Image
            source={CHATFLOW_LOGO}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>
        <Text variant="h1" align="center" style={styles.splashTitle}>
          ChatFlow
        </Text>
        <ActivityIndicator
          size="small"
          color={theme.primary}
          style={{ marginTop: tokens.spacing.lg }}
        />
      </View>

      {/* WhatsApp-Style Splash Footer */}
      <BrandFooter style={styles.splashFooter} showSubtitle={true} />
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
  logoContainer: {
    marginBottom: tokens.spacing.md,
    ...tokens.elevation[4],
  },
  logoImage: {
    width: 130,
    height: 130,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(37, 211, 102, 0.4)',
  },
  splashTitle: {
    letterSpacing: -0.5,
    marginTop: tokens.spacing.xs,
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
