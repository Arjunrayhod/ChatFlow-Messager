/**
 * @file BrandFooter component.
 * WhatsApp-style "from" signature branding featuring app creator Arjun Rathod
 * with interactive LinkedIn connection link.
 * 
 * Strict compliance with RULE 0.7 (Design tokens).
 */

import React from 'react';
import { View, StyleSheet, Pressable, Linking, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { Text } from './Text';

export interface BrandFooterProps {
  style?: object;
  showSubtitle?: boolean;
}

export const LINKEDIN_URL = 'https://www.linkedin.com/in/arjun-rathod-cloud/';

export const BrandFooter: React.FC<BrandFooterProps> = ({
  style,
  showSubtitle = false,
}) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const handleOpenLinkedIn = () => {
    void Linking.openURL(LINKEDIN_URL);
  };

  return (
    <View style={[styles.container, style]}>
      <Text variant="caption" colorRole="disabled" align="center" style={styles.fromLabel}>
        from
      </Text>

      <Pressable
        onPress={handleOpenLinkedIn}
        style={({ pressed }) => [
          styles.brandRow,
          { opacity: pressed ? 0.75 : 1 },
        ]}
        accessibilityRole="link"
        accessibilityLabel="Arjun Rathod LinkedIn Profile"
      >
        <Ionicons
          name="logo-linkedin"
          size={16}
          color="#0A66C2"
          style={styles.linkedinIcon}
        />
        <Text
          variant="button"
          align="center"
          style={[styles.authorName, { color: theme.textPrimary }]}
        >
          ARJUN RATHOD
        </Text>
      </Pressable>

      {showSubtitle && (
        <Text variant="caption" colorRole="secondary" align="center" style={styles.subtitle}>
          Cloud & DevOps Architect • Connect on LinkedIn
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.md,
  },
  fromLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
    opacity: 0.7,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.xxs,
    paddingHorizontal: tokens.spacing.sm,
  },
  linkedinIcon: {
    marginRight: 6,
  },
  authorName: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
    opacity: 0.8,
  },
});
