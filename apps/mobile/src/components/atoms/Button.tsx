/**
 * @file Interactive Button atom adhering to 48dp touch target and design tokens.
 */

import React from 'react';
import {
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { tokens } from '../../theme/tokens';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  isDisabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * Standard button component enforcing accessibility and token consistency.
 */
export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  isDisabled = false,
  fullWidth = false,
  style,
  accessibilityLabel,
}) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const isInteractive = !isDisabled && !isLoading;

  const getContainerStyle = (pressed: boolean): ViewStyle => {
    let backgroundColor: string = theme.primary;
    let borderColor: string = 'transparent';
    let borderWidth = 0;

    switch (variant) {
      case 'secondary':
        backgroundColor = pressed ? theme.surfaceEmphasized : theme.surface;
        borderColor = theme.divider;
        borderWidth = 1;
        break;
      case 'ghost':
        backgroundColor = pressed ? theme.surfaceEmphasized : 'transparent';
        break;
      case 'danger':
        backgroundColor = pressed ? theme.warning : theme.error;
        break;
      case 'primary':
      default:
        backgroundColor = pressed ? theme.primaryVariant : theme.primary;
        break;
    }

    if (isDisabled) {
      backgroundColor = theme.surfaceEmphasized;
      borderColor = 'transparent';
    }

    const minHeight =
      size === 'sm' ? tokens.spacing.xxl : tokens.spacing.huge; // Min 48dp for standard/lg

    return {
      backgroundColor,
      borderColor,
      borderWidth,
      borderRadius: tokens.radii.md,
      minHeight,
      paddingHorizontal: size === 'sm' ? tokens.spacing.sm : tokens.spacing.md,
      paddingVertical: tokens.spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: isDisabled ? 0.6 : 1,
      width: fullWidth ? '100%' : 'auto',
    };
  };

  const getTextColorRole = () => {
    if (isDisabled) return 'disabled';
    if (variant === 'primary' || variant === 'danger') return 'inverse';
    return 'primary';
  };

  const getSpinnerColor = () => {
    if (variant === 'primary' || variant === 'danger') return theme.textInverse;
    return theme.primary;
  };

  return (
    <Pressable
      onPress={isInteractive ? onPress : undefined}
      disabled={!isInteractive}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !isInteractive, busy: isLoading }}
      style={({ pressed }) => [getContainerStyle(pressed), style]}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={getSpinnerColor()} />
      ) : (
        <Text variant="button" colorRole={getTextColorRole()} align="center">
          {label}
        </Text>
      )}
    </Pressable>
  );
};
