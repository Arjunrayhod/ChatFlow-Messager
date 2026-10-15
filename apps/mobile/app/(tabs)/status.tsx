/**
 * @file Status updates screen (Phase 3 Tab).
 * Route: /(tabs)/status
 * Strict compliance with RULE 0.7 (Design tokens).
 * 
 * [HINGLISH GUIDE]:
 * Yeh Status Tab hai jaha user apna status update dal sakta hai aur contacts ke updates dekh sakta hai.
 */

import React from 'react';
import { View, StyleSheet, ScrollView, useColorScheme, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../src/theme/tokens';
import { Text } from '../../src/components/atoms/Text';
import { Avatar } from '../../src/components/atoms/Avatar';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function StatusScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;
  const { user } = useAuthStore();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingVertical: tokens.spacing.md }}
    >
      {/* My Status Section */}
      <Pressable
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed ? theme.surfaceEmphasized : theme.background,
            borderBottomColor: theme.divider,
          },
        ]}
      >
        <View style={styles.avatarWrapper}>
          <Avatar
            name={user?.displayName || 'My Status'}
            uri={user?.avatarUrl}
            size="md"
          />
          <View
            style={[
              styles.plusBadge,
              {
                backgroundColor: theme.primary,
                borderColor: theme.background,
              },
            ]}
          >
            <Ionicons name="add" size={14} color={theme.textInverse} />
          </View>
        </View>

        <View style={styles.textCol}>
          <Text variant="h3">My Status</Text>
          <Text variant="caption" colorRole="secondary">
            Tap to add status update
          </Text>
        </View>
      </Pressable>

      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text variant="overline" colorRole="secondary">
          Recent updates
        </Text>
      </View>

      <View style={styles.emptyStatus}>
        <Ionicons name="radio-outline" size={36} color={theme.textDisabled} />
        <Text variant="body" colorRole="secondary" align="center" style={{ marginTop: tokens.spacing.xs }}>
          No status updates from your contacts yet.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    minHeight: 72,
    gap: tokens.spacing.md,
  },
  avatarWrapper: {
    position: 'relative',
  },
  plusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: tokens.spacing.xxs,
  },
  sectionHeader: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.xs,
  },
  emptyStatus: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.xxl,
    paddingHorizontal: tokens.spacing.xl,
  },
});
