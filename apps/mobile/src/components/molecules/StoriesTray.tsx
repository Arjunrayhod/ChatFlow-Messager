/**
 * @file StoriesTray molecule component.
 * WhatsApp & Instagram-style horizontal scrollable list of user avatars
 * with colored unviewed rings and gray viewed rings.
 * Placed prominently at the top of the chat inbox.
 * 
 * Strict compliance with RULE 0.1 (No phone numbers) and RULE 0.7 (Design tokens).
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  useColorScheme,
  Pressable,
} from 'react-native';
import { tokens } from '../../theme/tokens';
import { Text } from '../atoms/Text';
import { StatusRing } from '../atoms/StatusRing';
import { StatusItem, UserStoryGroup } from '@chatflow/shared';
import { useAuthStore } from '../../store/useAuthStore';

export interface StoriesTrayProps {
  myStories: StatusItem[];
  contactStories: UserStoryGroup[];
  onOpenMyStatus: () => void;
  onAddNewStatus: () => void;
  onOpenContactStory: (group: UserStoryGroup) => void;
}

export const StoriesTray: React.FC<StoriesTrayProps> = ({
  myStories,
  contactStories,
  onOpenMyStatus,
  onAddNewStatus,
  onOpenContactStory,
}) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;
  const { user } = useAuthStore();

  const hasMyStories = myStories.length > 0;
  const myStoriesUnseen = false; // Owner's own stories don't count as unseen for owner

  return (
    <View style={[styles.container, { borderBottomColor: theme.divider }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* "My Status" Item */}
        <View style={styles.storyItem}>
          <StatusRing
            name={user?.displayName || 'My Status'}
            avatarUri={user?.avatarUrl}
            size="md"
            hasStories={hasMyStories}
            hasUnseen={hasMyStories}
            showAddBadge={!hasMyStories}
            onPress={hasMyStories ? onOpenMyStatus : onAddNewStatus}
            onAddPress={onAddNewStatus}
            accessibilityLabel="My Status"
          />
          <Text
            variant="caption"
            colorRole={hasMyStories ? 'primary' : 'secondary'}
            numberOfLines={1}
            style={styles.label}
          >
            {hasMyStories ? 'My Status' : 'Add Status'}
          </Text>
        </View>

        {/* Contacts' Stories */}
        {contactStories.map((group) => (
          <View key={group.userId} style={styles.storyItem}>
            <StatusRing
              name={group.displayName}
              avatarUri={group.avatarUrl}
              size="md"
              hasStories={true}
              hasUnseen={group.hasUnseen}
              showAddBadge={false}
              onPress={() => onOpenContactStory(group)}
              accessibilityLabel={`${group.displayName}'s status`}
            />
            <Text
              variant="caption"
              colorRole={group.hasUnseen ? 'primary' : 'secondary'}
              numberOfLines={1}
              style={[
                styles.label,
                group.hasUnseen && { fontWeight: '700' },
              ]}
            >
              {group.displayName.split(' ')[0] || `@${group.username}`}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingVertical: tokens.spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.md,
    alignItems: 'center',
  },
  storyItem: {
    alignItems: 'center',
    width: 68,
    gap: 4,
  },
  label: {
    fontSize: 11,
    textAlign: 'center',
    maxWidth: 68,
  },
});
