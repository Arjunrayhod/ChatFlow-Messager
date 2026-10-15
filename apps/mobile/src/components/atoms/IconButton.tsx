/**
 * @file IconButton atom component conforming strictly to Mobile UX Standards.
 * Minimum 48x48px touch target constraint enforced via tokens.spacing.huge.
 * 
 * [HINGLISH GUIDE]:
 * Yeh icon button atom hai. Header actions (search, back, options) ya floating action button
 * ke liye use hota hai. Isme minimum 48x48px touch target ensure kiya gaya hai.
 */

import React from 'react';
import { Pressable, StyleSheet, useColorScheme, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';

export type IconButtonSize = 'sm' | 'md' | 'lg';
export type IconButtonVariant = 'standard' | 'filled' | 'tonal';

export interface IconButtonProps {
  name: keyof typeof Ionicons.glyphMap;
  size?: IconButtonSize;
  color?: string;
  variant?: IconButtonVariant;
  accessibilityLabel: string;
  onPress: () => void;
  style?: ViewStyle;
}

export const IconButton: React.FC<IconButtonProps> = ({
  name,
  size = 'md',
  color,
  variant = 'standard',
  accessibilityLabel,
  onPress,
  style,
}) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const getIconSize = (): number => {
    switch (size) {
      case 'sm':
        return tokens.iconSizes.sm; // 20
      case 'lg':
        return tokens.iconSizes.lg; // 28
      case 'md':
      default:
        return tokens.iconSizes.md; // 24
    }
  };

  const getBackgroundColor = (): string => {
    switch (variant) {
      case 'filled':
        return theme.primary;
      case 'tonal':
        return theme.surfaceEmphasized;
      case 'standard':
      default:
        return 'transparent';
    }
  };

  const getIconColor = (): string => {
    if (color) return color;
    if (variant === 'filled') return theme.textInverse;
    return theme.textPrimary;
  };

  return (
    <Pressable
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          opacity: pressed ? 0.75 : 1,
          borderRadius: tokens.radii.pill,
        },
        style,
      ]}
    >
      <Ionicons name={name} size={getIconSize()} color={getIconColor()} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    minWidth: tokens.spacing.huge, // 48dp touch target
    minHeight: tokens.spacing.huge, // 48dp touch target
    alignItems: 'center',
    justifyContent: 'center',
  },
});
