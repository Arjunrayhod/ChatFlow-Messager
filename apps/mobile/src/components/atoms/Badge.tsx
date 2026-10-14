/**
 * @file Badge atom for status pills and presence indicators.
 */

import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { tokens } from '../../theme/tokens';
import { Text } from './Text';

export type BadgeVariant = 'online' | 'offline' | 'away' | 'counter';

export interface BadgeProps {
  variant: BadgeVariant;
  count?: number;
  label?: string;
}

/**
 * Renders status indicator dot or unread count pill.
 */
export const Badge: React.FC<BadgeProps> = ({ variant, count, label }) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const getBackgroundColor = () => {
    switch (variant) {
      case 'online':
        return theme.success;
      case 'away':
        return theme.warning;
      case 'offline':
        return theme.textDisabled;
      case 'counter':
      default:
        return theme.secondary;
    }
  };

  if (variant === 'counter' || label) {
    const displayText = label || (count !== undefined ? (count > 99 ? '99+' : count.toString()) : '');

    return (
      <View
        style={[
          styles.pill,
          {
            backgroundColor: getBackgroundColor(),
            borderRadius: tokens.radii.pill,
            paddingHorizontal: tokens.spacing.xs,
            paddingVertical: tokens.spacing.xxs,
          },
        ]}
      >
        <Text variant="caption" colorRole="inverse" align="center">
          {displayText}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.dot,
        {
          backgroundColor: getBackgroundColor(),
          borderRadius: tokens.radii.pill,
          borderColor: theme.background,
          borderWidth: 2,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  pill: {
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 12,
    height: 12,
  },
});
