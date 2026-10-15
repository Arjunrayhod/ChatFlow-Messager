/**
 * @file Home / Gateway Screen displaying backend connectivity status and Auth State.
 * Strict compliance with RULE 0.1 (No phone numbers) and RULE 0.7 (Design system tokens).
 * 
 * [HINGLISH GUIDE]:
 * Yeh ChatFlow ka HOME / GATEWAY Screen hai:
 * 1. Backend Connectivity: Page load hote hi `/health` ko ping karta hai aur status (UP/DOWN, latency) dikhata hai.
 * 2. User State handling:
 *    - Agar user logged in + onboarded hai -> Profile Card dikhta hai
 *    - Agar user logged in hai par @username choose nahi kiya -> Onboarding screen ka prompt aata hai
 *    - Agar user logged out hai -> "Sign In with Google" ka button aata hai
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '../src/theme/tokens';
import { Text } from '../src/components/atoms/Text';
import { Button } from '../src/components/atoms/Button';
import { Badge } from '../src/components/atoms/Badge';
import { Avatar } from '../src/components/atoms/Avatar';
import { useHealthStore } from '../src/store/useHealthStore';
import { useAuthStore } from '../src/store/useAuthStore';

/**
 * Gateway screen rendering backend health and authenticated user state.
 */
export default function GatewayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const {
    isConnected,
    latencyMs,
    serverData,
    isLoading: isCheckingHealth,
    errorMessage: healthError,
    lastChecked,
    checkHealth,
  } = useHealthStore();

  const {
    user,
    isAuthenticated,
    isOnboarded,
    signOut,
  } = useAuthStore();

  useEffect(() => {
    // Initial health probe on mount
    void checkHealth();
  }, [checkHealth]);

  const renderStatusBadge = () => {
    if (isCheckingHealth && isConnected === null) {
      return (
        <View style={styles.badgeRow}>
          <Badge variant="away" label="CHECKING..." />
        </View>
      );
    }
    if (isConnected === true) {
      return (
        <View style={styles.badgeRow}>
          <Badge variant="online" label="BACKEND: UP" />
          {latencyMs !== null && (
            <Text variant="caption" colorRole="secondary" style={styles.latencyText}>
              {latencyMs}ms latency
            </Text>
          )}
        </View>
      );
    }
    return (
      <View style={styles.badgeRow}>
        <Badge variant="away" label="BACKEND: DOWN" />
      </View>
    );
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
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <View
            style={[
              styles.logoCircle,
              {
                backgroundColor: theme.primary,
                borderRadius: tokens.radii.pill,
                width: tokens.spacing.huge + tokens.spacing.xl,
                height: tokens.spacing.huge + tokens.spacing.xl,
              },
            ]}
          >
            <Text variant="display" colorRole="inverse">
              CF
            </Text>
          </View>
          <Text variant="h1" align="center" style={styles.brandTitle}>
            ChatFlow
          </Text>
          <Text
            variant="bodyMedium"
            colorRole="secondary"
            align="center"
            style={styles.brandTagline}
          >
            Private messaging. Your Gmail. No numbers.
          </Text>
        </View>

        {/* Phase 2: Active User Card or Auth CTA */}
        {isAuthenticated && user && isOnboarded ? (
          <View
            style={[
              styles.userCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.divider,
                borderRadius: tokens.radii.lg,
                padding: tokens.spacing.lg,
                ...tokens.elevation[1],
              },
            ]}
          >
            <View style={styles.userHeaderRow}>
              <Avatar
                name={user.displayName}
                uri={user.avatarUrl}
                size="lg"
                presence="online"
              />
              <View style={styles.userMetaCol}>
                <Text variant="h3">{user.displayName}</Text>
                <Text variant="bodyMedium" colorRole="primary">
                  @{user.username}
                </Text>
                <Text variant="caption" colorRole="secondary">
                  {user.email}
                </Text>
              </View>
            </View>

            {user.bio && (
              <View
                style={[
                  styles.bioBox,
                  {
                    backgroundColor: theme.surfaceEmphasized,
                    borderRadius: tokens.radii.sm,
                    padding: tokens.spacing.sm,
                  },
                ]}
              >
                <Text variant="caption" colorRole="secondary">
                  About: {user.bio}
                </Text>
              </View>
            )}

            <View style={styles.authenticatedActions}>
              <Button
                label="Open Chat Inbox"
                onPress={() => router.push('/(tabs)/chats')}
                variant="primary"
                size="md"
                fullWidth={true}
              />
              <View style={{ height: tokens.spacing.xs }} />
              <Button
                label="Sign Out"
                onPress={() => void signOut()}
                variant="secondary"
                size="md"
                fullWidth={true}
              />
            </View>
          </View>
        ) : isAuthenticated && !isOnboarded ? (
          <View
            style={[
              styles.userCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.warning,
                borderRadius: tokens.radii.lg,
                padding: tokens.spacing.lg,
              },
            ]}
          >
            <Text variant="h3">Setup Incomplete</Text>
            <Text variant="body" colorRole="secondary">
              You are signed in with Google, but have not picked your unique @username yet.
            </Text>
            <Button
              label="Complete Onboarding Now"
              onPress={() => router.push('/(auth)/onboarding')}
              variant="primary"
              size="md"
              fullWidth={true}
            />
          </View>
        ) : (
          <View
            style={[
              styles.authCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.divider,
                borderRadius: tokens.radii.lg,
                padding: tokens.spacing.lg,
                ...tokens.elevation[1],
              },
            ]}
          >
            <Text variant="h3">Phase 2 — Authentication</Text>
            <Text variant="body" colorRole="secondary">
              Sign in with your Google account. Zero phone numbers required.
            </Text>
            <Button
              label="Sign In with Google"
              onPress={() => router.push('/(auth)/sign-in')}
              variant="primary"
              size="md"
              fullWidth={true}
            />
          </View>
        )}

        {/* Backend Status Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.divider,
              borderRadius: tokens.radii.lg,
              padding: tokens.spacing.lg,
              ...tokens.elevation[1],
            },
          ]}
        >
          <Text variant="h3" style={styles.cardHeader}>
            Backend Infrastructure Status
          </Text>

          <View style={styles.statusSection}>
            <Text variant="body" colorRole="secondary">
              Liveness Probe:
            </Text>
            {renderStatusBadge()}
          </View>

          {isConnected === true && serverData && (
            <View
              style={[
                styles.detailsBox,
                {
                  backgroundColor: theme.surfaceEmphasized,
                  borderRadius: tokens.radii.md,
                  padding: tokens.spacing.sm,
                },
              ]}
            >
              <Text variant="caption" colorRole="secondary">
                Service: {serverData.service} (v{serverData.version})
              </Text>
              <Text variant="caption" colorRole="secondary">
                Uptime: {Math.floor(serverData.uptime)}s | Last Checked: {lastChecked || 'Just now'}
              </Text>
            </View>
          )}

          {isConnected === false && (
            <View
              style={[
                styles.detailsBox,
                {
                  backgroundColor: theme.surfaceEmphasized,
                  borderRadius: tokens.radii.md,
                  padding: tokens.spacing.sm,
                },
              ]}
            >
              <Text variant="caption" colorRole="error">
                {healthError || 'Unable to connect to backend service.'}
              </Text>
            </View>
          )}

          <Button
            label={isCheckingHealth ? 'Pinging Server...' : 'Check Backend Health'}
            onPress={() => void checkHealth()}
            variant="secondary"
            size="md"
            isLoading={isCheckingHealth}
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
    flexGrow: 1,
    justifyContent: 'center',
    gap: tokens.spacing.lg,
  },
  brandContainer: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  logoCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.xs,
  },
  brandTitle: {
    letterSpacing: -0.5,
  },
  brandTagline: {
    maxWidth: 300,
  },
  authCard: {
    borderWidth: 1,
    gap: tokens.spacing.sm,
  },
  userCard: {
    borderWidth: 1,
    gap: tokens.spacing.md,
  },
  userHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  userMetaCol: {
    flex: 1,
    gap: tokens.spacing.xxs,
  },
  bioBox: {
    marginTop: tokens.spacing.xxs,
  },
  authenticatedActions: {
    marginTop: tokens.spacing.xs,
  },
  card: {
    borderWidth: 1,
    gap: tokens.spacing.md,
  },
  cardHeader: {
    marginBottom: tokens.spacing.xxs,
  },
  statusSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  latencyText: {
    marginLeft: tokens.spacing.xxs,
  },
  detailsBox: {
    gap: tokens.spacing.xxs,
  },
});
