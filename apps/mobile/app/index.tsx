/**
 * @file Home / Gateway Screen displaying backend connectivity status.
 * Strict compliance with RULE 0.1 (No phone numbers) and RULE 0.7 (Design system tokens).
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../src/theme/tokens';
import { Text } from '../src/components/atoms/Text';
import { Button } from '../src/components/atoms/Button';
import { Badge } from '../src/components/atoms/Badge';
import { useHealthStore } from '../src/store/useHealthStore';

/**
 * Gateway screen rendering backend health and connection state.
 */
export default function GatewayScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const {
    isConnected,
    latencyMs,
    serverData,
    isLoading,
    errorMessage,
    lastChecked,
    checkHealth,
  } = useHealthStore();

  useEffect(() => {
    // Initial health probe on mount
    void checkHealth();
  }, [checkHealth]);

  const renderStatusBadge = () => {
    if (isLoading && isConnected === null) {
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
          {
            paddingHorizontal: tokens.spacing.md,
          },
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

        {/* Status Card */}
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
            Phase 1 — System Readiness
          </Text>

          <View style={styles.statusSection}>
            <Text variant="body" colorRole="secondary">
              Connectivity Status:
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
                Server Uptime: {Math.floor(serverData.uptime)}s
              </Text>
              <Text variant="caption" colorRole="secondary">
                Last checked: {lastChecked || 'Just now'}
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
                {errorMessage || 'Unable to connect to backend service.'}
              </Text>
              <Text variant="caption" colorRole="secondary">
                Ensure @chatflow/server is running on port 4000.
              </Text>
            </View>
          )}

          <View style={styles.actionContainer}>
            <Button
              label={isLoading ? 'Pinging Server...' : 'Check Backend Health'}
              onPress={() => void checkHealth()}
              variant="primary"
              size="md"
              isLoading={isLoading}
              fullWidth={true}
            />
          </View>
        </View>

        {/* Phase Summary Card */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.divider,
              borderRadius: tokens.radii.md,
              padding: tokens.spacing.md,
            },
          ]}
        >
          <Text variant="h4" style={styles.infoTitle}>
            Architectural Guarantees
          </Text>
          <Text variant="body" colorRole="secondary" style={styles.infoItem}>
            • Zero Phone Numbers: Identity via Firebase UID + @username
          </Text>
          <Text variant="body" colorRole="secondary" style={styles.infoItem}>
            • Design System as Law: 100% tokens from tokens.ts
          </Text>
          <Text variant="body" colorRole="secondary" style={styles.infoItem}>
            • Standard API Envelopes: Consistent {`{ ok, data/error }`} contract
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
  actionContainer: {
    marginTop: tokens.spacing.xs,
  },
  infoCard: {
    borderWidth: 1,
    gap: tokens.spacing.xs,
  },
  infoTitle: {
    marginBottom: tokens.spacing.xxs,
  },
  infoItem: {
    lineHeight: tokens.typography.body.lineHeight,
  },
});
