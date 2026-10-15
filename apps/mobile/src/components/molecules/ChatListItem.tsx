/**
 * @file ChatListItem molecule component.
 * Renders conversation row in the main chat inbox.
 * Strict compliance with RULE 0.1 (No phone numbers) and RULE 0.7 (Design tokens).
 * 
 * [HINGLISH GUIDE]:
 * Yeh Chat Inbox ki row item hai.
 * Left me user avatar aur presence indicator, beech me display name aur last message snippet,
 * right me timestamp aur unread count badge dikhata hai.
 */

import React from 'react';
import { View, StyleSheet, Pressable, useColorScheme } from 'react-native';
import { tokens } from '../../theme/tokens';
import { Text } from '../atoms/Text';
import { Avatar } from '../atoms/Avatar';
import { Badge } from '../atoms/Badge';

export interface ChatListItemProps {
  id: string;
  displayName: string;
  username: string;
  lastMessage?: string | null;
  timestamp?: string | null;
  unreadCount?: number;
  avatarUri?: string | null;
  presence?: 'online' | 'offline' | 'away' | null;
  onPress: () => void;
}

export const ChatListItem: React.FC<ChatListItemProps> = ({
  displayName,
  username,
  lastMessage,
  timestamp,
  unreadCount = 0,
  avatarUri,
  presence,
  onPress,
}) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const hasUnread = unreadCount > 0;

  return (
    <Pressable
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${displayName}. ${hasUnread ? `${unreadCount} unread messages.` : ''}`}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed ? theme.surfaceEmphasized : theme.background,
          borderBottomColor: theme.divider,
        },
      ]}
    >
      <Avatar
        name={displayName || username}
        uri={avatarUri}
        size="md"
        presence={presence}
      />

      <View style={styles.contentCol}>
        <View style={styles.topRow}>
          <Text
            variant="h4"
            numberOfLines={1}
            style={styles.nameText}
          >
            {displayName}
          </Text>
          {timestamp && (
            <Text
              variant="caption"
              colorRole={hasUnread ? 'primary' : 'secondary'}
              style={styles.timeText}
            >
              {timestamp}
            </Text>
          )}
        </View>

        <View style={styles.bottomRow}>
          <Text
            variant={hasUnread ? 'bodyMedium' : 'body'}
            colorRole={hasUnread ? 'primary' : 'secondary'}
            numberOfLines={1}
            style={styles.messageSnippet}
          >
            {lastMessage || `@${username}`}
          </Text>

          {hasUnread && (
            <Badge variant="counter" count={unreadCount} />
          )}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    minHeight: 72, // Comfortable mobile touch target
    borderBottomWidth: 1,
    gap: tokens.spacing.md,
  },
  contentCol: {
    flex: 1,
    justifyContent: 'center',
    gap: tokens.spacing.xxs,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameText: {
    flex: 1,
    marginRight: tokens.spacing.xs,
  },
  timeText: {
    flexShrink: 0,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageSnippet: {
    flex: 1,
    marginRight: tokens.spacing.xs,
  },
});
