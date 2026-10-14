/**
 * @file Avatar atom component with initials fallback and presence indicator.
 * Strict compliance with RULE 0.7.
 */

import React from 'react';
import { View, Image, StyleSheet, useColorScheme, Pressable } from 'react-native';
import { tokens } from '../../theme/tokens';
import { Text } from './Text';
import { Badge, BadgeVariant } from './Badge';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: AvatarSize;
  presence?: 'online' | 'offline' | 'away' | null;
  onPress?: () => void;
}

/**
 * Renders user avatar or fallback initials with optional presence badge.
 */
export const Avatar: React.FC<AvatarProps> = ({
  name,
  uri,
  size = 'md',
  presence,
  onPress,
}) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const getSizePx = (): number => {
    switch (size) {
      case 'sm':
        return tokens.spacing.xxl; // 32
      case 'lg':
        return tokens.spacing.huge + tokens.spacing.xs; // 56
      case 'xl':
        return tokens.spacing.huge + tokens.spacing.xxl; // 80
      case 'md':
      default:
        return tokens.spacing.xxxl + tokens.spacing.xxs; // 44
    }
  };

  const getInitials = (fullName: string): string => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return 'CF';
    if (parts.length === 1) {
      return (parts[0].slice(0, 2)).toUpperCase();
    }
    const first = parts[0]?.[0] || '';
    const second = parts[1]?.[0] || '';
    return (first + second).toUpperCase();
  };

  const dimension = getSizePx();
  const textVariant = size === 'xl' ? 'display' : size === 'lg' ? 'h2' : size === 'sm' ? 'caption' : 'bodyMedium';

  const avatarContent = (
    <View
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: tokens.radii.pill,
          backgroundColor: theme.primaryVariant,
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={[
            styles.image,
            {
              width: dimension,
              height: dimension,
              borderRadius: tokens.radii.pill,
            },
          ]}
          resizeMode="cover"
        />
      ) : (
        <Text variant={textVariant} colorRole="inverse" align="center">
          {getInitials(name)}
        </Text>
      )}

      {presence && (
        <View style={styles.presenceBadge}>
          <Badge variant={presence as BadgeVariant} />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${name}'s avatar`}
      >
        {avatarContent}
      </Pressable>
    );
  }

  return avatarContent;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  presenceBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
});
