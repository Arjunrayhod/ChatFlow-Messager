/**
 * @file EmptyState molecule component.
 * Displays user-friendly fallback state with icon, title, description, and action button.
 * Strict compliance with RULE 0.7 (Design tokens).
 * 
 * [HINGLISH GUIDE]:
 * Jab kisi list me koi data na ho (jaise no chats, no contacts),
 * yeh clean empty state widget dikhata hai with optional button.
 */

import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { Text } from '../atoms/Text';
import { Button } from '../atoms/Button';

export interface EmptyStateProps {
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  iconName,
  title,
  description,
  actionLabel,
  onActionPress,
}) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: theme.surfaceEmphasized,
            borderRadius: tokens.radii.pill,
          },
        ]}
      >
        <Ionicons name={iconName} size={48} color={theme.primary} />
      </View>

      <Text variant="h2" align="center" style={styles.title}>
        {title}
      </Text>

      <Text
        variant="body"
        colorRole="secondary"
        align="center"
        style={styles.description}
      >
        {description}
      </Text>

      {actionLabel && onActionPress && (
        <View style={styles.actionBox}>
          <Button
            label={actionLabel}
            onPress={onActionPress}
            variant="primary"
            size="md"
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.xxl,
    gap: tokens.spacing.sm,
  },
  iconCircle: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.sm,
  },
  title: {
    letterSpacing: -0.2,
  },
  description: {
    maxWidth: 300,
    lineHeight: 22,
  },
  actionBox: {
    marginTop: tokens.spacing.md,
  },
});
