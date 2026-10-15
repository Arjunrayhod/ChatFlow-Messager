/**
 * @file Calls log screen (Phase 3 Tab).
 * Route: /(tabs)/calls
 * Strict compliance with RULE 0.7 (Design tokens).
 * 
 * [HINGLISH GUIDE]:
 * Yeh Calls Tab hai jaha user ke recent voice aur video call logs dikhte hain.
 */

import React from 'react';
import { View, StyleSheet, ScrollView, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../src/theme/tokens';
import { Text } from '../../src/components/atoms/Text';
import { EmptyState } from '../../src/components/molecules/EmptyState';

export default function CallsScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <EmptyState
        iconName="call-outline"
        title="No Recent Calls"
        description="To start a private audio or video call, open a conversation and tap the call button."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
