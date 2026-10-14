/**
 * @file Form text input atom enforcing design system tokens and accessibility.
 * Strict compliance with RULE 0.7.
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  useColorScheme,
  TextInputProps,
} from 'react-native';
import { tokens } from '../../theme/tokens';
import { Text } from './Text';

export interface TextInputFieldProps extends TextInputProps {
  label?: string;
  prefix?: string;
  errorMessage?: string | null;
  isValid?: boolean;
  helperText?: string;
}

/**
 * Standard text input field atom supporting prefix, error, and validation states.
 */
export const TextInputField: React.FC<TextInputFieldProps> = ({
  label,
  prefix,
  errorMessage,
  isValid = false,
  helperText,
  value,
  onChangeText,
  placeholder,
  autoFocus,
  maxLength,
  style,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const resolveBorderColor = () => {
    if (errorMessage) return theme.error;
    if (isValid) return theme.success;
    if (isFocused) return theme.primary;
    return theme.divider;
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text variant="caption" colorRole="secondary" style={styles.label}>
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: theme.surface,
            borderColor: resolveBorderColor(),
            borderRadius: tokens.radii.md,
            minHeight: tokens.spacing.huge, // 48dp min touch target
          },
        ]}
      >
        {prefix && (
          <View style={styles.prefixContainer}>
            <Text variant="bodyMedium" colorRole="secondary">
              {prefix}
            </Text>
          </View>
        )}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textDisabled}
          autoFocus={autoFocus}
          maxLength={maxLength}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            styles.nativeInput,
            tokens.typography.body,
            { color: theme.textPrimary },
            style,
          ]}
          {...rest}
        />

        {isValid && !errorMessage && (
          <View style={styles.indicatorContainer}>
            <Text variant="caption" colorRole="success">
              ✓
            </Text>
          </View>
        )}
      </View>

      {errorMessage ? (
        <Text variant="caption" colorRole="error" style={styles.feedbackText}>
          {errorMessage}
        </Text>
      ) : helperText ? (
        <Text variant="caption" colorRole="secondary" style={styles.feedbackText}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: tokens.spacing.xxs,
  },
  label: {
    marginBottom: tokens.spacing.xxs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    paddingHorizontal: tokens.spacing.md,
  },
  prefixContainer: {
    marginRight: tokens.spacing.xxs,
  },
  nativeInput: {
    flex: 1,
    paddingVertical: tokens.spacing.sm,
    outlineStyle: 'none',
  } as any, // outlineStyle for web clean rendering
  indicatorContainer: {
    marginLeft: tokens.spacing.xs,
  },
  feedbackText: {
    marginTop: tokens.spacing.xxs,
  },
});
