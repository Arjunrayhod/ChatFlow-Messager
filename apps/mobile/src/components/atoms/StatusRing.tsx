/**
 * @file StatusRing atom component.
 * Displays user avatar with WhatsApp/Instagram-style story status ring:
 * - Unseen status: Emerald green ring (#25D366)
 * - Seen status: Subtle gray ring (#8696A0)
 * - My status: Optional '+' add badge
 * 
 * Strict compliance with RULE 0.7 (Design tokens) & touch target >= 48px.
 */

import React from 'react';
import { View, StyleSheet, Pressable, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { Avatar } from './Avatar';

export interface StatusRingProps {
  name: string;
  avatarUri?: string | null;
  size?: 'sm' | 'md' | 'lg';
  hasUnseen?: boolean;
  hasStories?: boolean;
  showAddBadge?: boolean;
  onPress?: () => void;
  onAddPress?: () => void;
  accessibilityLabel?: string;
}

export const StatusRing: React.FC<StatusRingProps> = ({
  name,
  avatarUri,
  size = 'md',
  hasUnseen = false,
  hasStories = false,
  showAddBadge = false,
  onPress,
  onAddPress,
  accessibilityLabel,
}) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  // Determine ring border color
  const ringColor = hasStories
    ? hasUnseen
      ? theme.secondary // Emerald green for unviewed stories
      : theme.textDisabled // Gray for already viewed
    : 'transparent';

  const ringContent = (
    <View style={styles.pressable}>
      <View
        style={[
          styles.ringWrapper,
          hasStories && {
            borderColor: ringColor,
            borderWidth: 2.5,
            padding: 2,
          },
        ]}
      >
        <Avatar name={name} uri={avatarUri} size={size} />
      </View>

      {showAddBadge && (
        <View
          style={[
            styles.addBadge,
            {
              backgroundColor: theme.primary,
              borderColor: theme.background,
            },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="add" size={14} color={theme.textInverse} />
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            { opacity: pressed ? 0.8 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel || `${name}'s story`}
        >
          {ringContent}
        </Pressable>
      ) : (
        ringContent
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressable: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    minHeight: 48,
  },
  ringWrapper: {
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.elevation[1],
  },
});
