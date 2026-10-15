/**
 * @file MessageBubble molecule component for chat messages.
 * Conforms to docs/UI_COMPONENT_CATALOG.md Section 2.2.
 * Strict compliance with RULE 0.7 (Design tokens).
 * 
 * [HINGLISH GUIDE]:
 * Yeh individual chat message bubble hai:
 * - Sent message: Right side me green background (#E7FFDB / dark #005C4B) ke sath dikhta hai.
 * - Received message: Left side me white/surface background ke sath dikhta hai.
 * - Status ticks: Clock (sending), Single check (sent), Double check (delivered/read).
 */

import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { Text } from '../atoms/Text';
import { MessageDeliveryStatus } from '@chatflow/shared';

export interface MessageBubbleProps {
  id: string;
  content: string;
  isSent: boolean;
  timestamp: string;
  status?: MessageDeliveryStatus;
  mediaUrl?: string | null;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  content,
  isSent,
  timestamp,
  status = 'sent',
}) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const renderStatusIcon = () => {
    if (!isSent) return null;

    switch (status) {
      case 'sending':
        return <Ionicons name="time-outline" size={13} color={theme.textDisabled} />;
      case 'sent':
        return <Ionicons name="checkmark" size={14} color={theme.textDisabled} />;
      case 'delivered':
        return <Ionicons name="checkmark-done" size={14} color={theme.textDisabled} />;
      case 'read':
        return <Ionicons name="checkmark-done" size={14} color={theme.primary} />;
      default:
        return <Ionicons name="checkmark" size={14} color={theme.textDisabled} />;
    }
  };

  return (
    <View
      style={[
        styles.row,
        isSent ? styles.sentRow : styles.receivedRow,
      ]}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isSent ? theme.bubbleSent : theme.bubbleReceived,
            borderBottomRightRadius: isSent ? tokens.radii.sm : tokens.radii.lg,
            borderBottomLeftRadius: isSent ? tokens.radii.lg : tokens.radii.sm,
            borderColor: isSent ? 'transparent' : theme.divider,
            borderWidth: isSent ? 0 : 0.5,
            ...tokens.elevation[1],
          },
        ]}
      >
        <Text
          variant="body"
          colorRole="primary"
          style={styles.contentText}
        >
          {content}
        </Text>

        <View style={styles.metaRow}>
          <Text variant="caption" colorRole="secondary" style={styles.timeText}>
            {timestamp}
          </Text>
          {renderStatusIcon()}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: tokens.spacing.xxs,
    paddingHorizontal: tokens.spacing.md,
  },
  sentRow: {
    justifyContent: 'flex-end',
  },
  receivedRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: tokens.spacing.sm,
    paddingTop: tokens.spacing.xs,
    paddingBottom: tokens.spacing.xs,
    borderRadius: tokens.radii.lg,
  },
  contentText: {
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
    marginTop: tokens.spacing.xxs,
    gap: tokens.spacing.xxs,
  },
  timeText: {
    fontSize: 11,
  },
});
