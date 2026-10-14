/**
 * @file Typography atom enforcing design system scales.
 * Strict compliance with RULE 0.7.
 */

import React from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { tokens } from '../../theme/tokens';

export type TextVariant = keyof typeof tokens.typography;
export type TextColorRole =
  | 'primary'
  | 'secondary'
  | 'disabled'
  | 'inverse'
  | 'success'
  | 'error'
  | 'warning';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  colorRole?: TextColorRole;
  align?: 'left' | 'center' | 'right';
  children: React.ReactNode;
}

/**
 * Standard Text component binding typography tokens and theme palette.
 */
export const Text: React.FC<TextProps> = ({
  variant = 'body',
  colorRole = 'primary',
  align = 'left',
  style,
  children,
  ...rest
}) => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const resolveTextColor = () => {
    switch (colorRole) {
      case 'secondary':
        return themeColors.textSecondary;
      case 'disabled':
        return themeColors.textDisabled;
      case 'inverse':
        return themeColors.textInverse;
      case 'success':
        return themeColors.success;
      case 'error':
        return themeColors.error;
      case 'warning':
        return themeColors.warning;
      case 'primary':
      default:
        return themeColors.textPrimary;
    }
  };

  const typographyStyle = tokens.typography[variant];

  return (
    <RNText
      style={[
        styles.base,
        typographyStyle,
        { color: resolveTextColor(), textAlign: align },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});
