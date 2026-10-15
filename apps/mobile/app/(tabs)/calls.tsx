/**
 * @file Calls log screen (Phase 5: WebRTC 1-on-1 Voice & Video Calling).
 * Route: /(tabs)/calls
 * Features real call logs, call direction indicators (incoming, outgoing, missed),
 * duration, instant call-back button, and clear history options.
 * Strict compliance with RULE 0.1 (No phone numbers) and RULE 0.7 (Design tokens).
 * 
 * [HINGLISH GUIDE]:
 * Yeh Calls Tab Screen hai:
 * 1. Backend API se user ke real call logs load karta hai.
 * 2. Incoming (Green Arrow), Outgoing (Green Arrow), aur Missed (Red Arrow) calls display karta hai.
 * 3. Quick Call Back button se instant audio/video call lagai ja sakti hai.
 * 4. Call duration aur timestamps dikhata hai.
 * 5. Pull-to-refresh aur "Clear History" support karta hai.
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  useColorScheme,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { tokens } from '../../src/theme/tokens';
import { Text } from '../../src/components/atoms/Text';
import { Avatar } from '../../src/components/atoms/Avatar';
import { EmptyState } from '../../src/components/molecules/EmptyState';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useCallStore } from '../../src/store/useCallStore';
import { CallRecord } from '@chatflow/shared';

function formatCallTimestamp(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  } catch {
    return dateStr;
  }
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `(${secs}s)`;
  return `(${mins}m ${secs}s)`;
}

export default function CallsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const { token, user } = useAuthStore();
  const {
    callLogs,
    isLoadingLogs,
    fetchCallLogs,
    deleteCallLog,
    clearCallLogs,
    startCall,
  } = useCallStore();

  const loadLogs = useCallback(() => {
    if (token) {
      void fetchCallLogs(token);
    }
  }, [token, fetchCallLogs]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleClearHistory = () => {
    if (!token) return;
    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm('Do you want to clear your entire call history?')) {
        void clearCallLogs(token);
      }
    } else {
      Alert.alert(
        'Clear Call History',
        'Do you want to delete all call logs?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', style: 'destructive', onPress: () => void clearCallLogs(token) },
        ]
      );
    }
  };

  const handleCallBack = (item: CallRecord) => {
    const isCaller = item.callerId === user?.id;
    const peer = {
      id: isCaller ? item.receiverId : item.callerId,
      username: isCaller ? item.receiverUsername : item.callerUsername,
      displayName: isCaller ? item.receiverDisplayName : item.callerDisplayName,
      avatarUrl: isCaller ? item.receiverAvatarUrl : item.callerAvatarUrl,
    };
    void startCall(peer, item.type);
  };

  const renderCallItem = ({ item }: { item: CallRecord }) => {
    const isCaller = item.callerId === user?.id;
    const isMissed = item.status === 'missed' || item.status === 'rejected';

    const peerName = isCaller ? item.receiverDisplayName : item.callerDisplayName;
    const peerUsername = isCaller ? item.receiverUsername : item.callerUsername;
    const peerAvatar = isCaller ? item.receiverAvatarUrl : item.callerAvatarUrl;

    return (
      <View
        style={[
          styles.callItem,
          {
            borderBottomColor: theme.divider,
            backgroundColor: theme.surface,
          },
        ]}
      >
        {/* Avatar */}
        <Avatar
          uri={peerAvatar}
          name={peerName}
          size="md"
        />

        {/* Call Info */}
        <View style={styles.callDetails}>
          <Text
            variant="body"
            style={[
              styles.callerName,
              { color: isMissed && !isCaller ? theme.error : theme.textPrimary },
            ]}
            numberOfLines={1}
          >
            {peerName}
          </Text>

          <View style={styles.callMetaRow}>
            {/* Direction Icon */}
            {isCaller ? (
              <Ionicons
                name="arrow-up"
                size={14}
                color={theme.primary}
                style={styles.arrowIconOutgoing}
              />
            ) : (
              <Ionicons
                name="arrow-down"
                size={14}
                color={isMissed ? theme.error : theme.primary}
                style={styles.arrowIconIncoming}
              />
            )}

            <Text variant="caption" colorRole="secondary">
              {formatCallTimestamp(item.startedAt)}
            </Text>

            {item.durationSeconds > 0 && (
              <Text variant="caption" colorRole="secondary" style={styles.durationText}>
                {formatDuration(item.durationSeconds)}
              </Text>
            )}
          </View>
        </View>

        {/* Quick Call-Back Action */}
        <Pressable
          style={[styles.callBackButton, { backgroundColor: theme.surfaceEmphasized }]}
          onPress={() => handleCallBack(item)}
          accessibilityRole="button"
          accessibilityLabel={`Call ${peerName}`}
        >
          <Ionicons
            name={item.type === 'video' ? 'videocam' : 'call'}
            size={20}
            color={theme.primary}
          />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Banner: Start a New Call */}
      <View
        style={[
          styles.topBanner,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.divider,
          },
        ]}
      >
        <View style={[styles.topBannerIconBox, { backgroundColor: theme.primary }]}>
          <Ionicons name="link-outline" size={22} color="#FFFFFF" />
        </View>
        <View style={styles.topBannerTextBox}>
          <Text variant="h3">WebRTC Voice & Video</Text>
          <Text variant="caption" colorRole="secondary">
            End-to-end encrypted • Zero phone numbers
          </Text>
        </View>
      </View>

      {/* Recent Header */}
      {callLogs.length > 0 && (
        <View style={styles.sectionHeader}>
          <Text variant="caption" style={styles.sectionTitle}>
            RECENT
          </Text>
          <Pressable onPress={handleClearHistory} hitSlop={10}>
            <Text variant="caption" style={[styles.clearText, { color: theme.error }]}>
              Clear History
            </Text>
          </Pressable>
        </View>
      )}

      {/* Calls List or Empty State */}
      <FlatList
        data={callLogs}
        keyExtractor={(item) => item.id}
        renderItem={renderCallItem}
        contentContainerStyle={callLogs.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingLogs}
            onRefresh={loadLogs}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            iconName="call-outline"
            title="No Recent Calls"
            description="To start a private audio or video call, open any conversation and tap the call or video icon at the top right."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: tokens.spacing.md,
  },
  topBannerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBannerTextBox: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.xs,
  },
  sectionTitle: {
    fontWeight: '700',
    color: '#8696A0',
    letterSpacing: 0.8,
  },
  clearText: {
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: tokens.spacing.xxl,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: tokens.spacing.sm + 4,
  },
  callDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  callerName: {
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 2,
  },
  callMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  arrowIconOutgoing: {
    transform: [{ rotate: '45deg' }],
  },
  arrowIconIncoming: {
    transform: [{ rotate: '45deg' }],
  },
  durationText: {
    marginLeft: 4,
    fontWeight: '500',
  },
  callBackButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
