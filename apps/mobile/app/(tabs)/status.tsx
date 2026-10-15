/**
 * @file WhatsApp-authentic Status / Stories Screen.
 * Route: /(tabs)/status
 * Features:
 * - "My Status" card with tap to view or add
 * - "Recent updates" (unviewed contact stories with emerald ring)
 * - "Viewed updates" (viewed contact stories with gray ring)
 * - WhatsApp-style dual floating action buttons (Pencil for Text status, Camera for Media)
 * - Full-screen story player & creator modal integration
 * 
 * Strict compliance with RULE 0.1 (Zero phone numbers) and RULE 0.7 (Design tokens).
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  useColorScheme,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../src/theme/tokens';
import { Text } from '../../src/components/atoms/Text';
import { StatusRing } from '../../src/components/atoms/StatusRing';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useStatusStore } from '../../src/store/useStatusStore';
import { StatusViewerModal } from '../../src/components/molecules/StatusViewerModal';
import { CreateStatusModal } from '../../src/components/molecules/CreateStatusModal';
import { UserStoryGroup } from '@chatflow/shared';

export default function StatusScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const { token, user } = useAuthStore();
  const { myStories, contactStories, isLoadingFeed, fetchFeed } = useStatusStore();

  const [activeStoryGroup, setActiveStoryGroup] = useState<UserStoryGroup | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [creatorMode, setCreatorMode] = useState<'text' | 'media'>('text');

  // Load feed on mount
  useEffect(() => {
    if (token) {
      void fetchFeed(token);
    }
  }, [token, fetchFeed]);

  const onRefresh = () => {
    if (token) {
      void fetchFeed(token);
    }
  };

  const hasMyStories = myStories.length > 0;
  const recentUpdates = contactStories.filter((g) => g.hasUnseen);
  const viewedUpdates = contactStories.filter((g) => !g.hasUnseen);

  const openMyStatus = () => {
    if (hasMyStories) {
      setActiveStoryGroup({
        userId: user?.id || 'me',
        username: user?.username || 'me',
        displayName: user?.displayName || 'My Status',
        avatarUrl: user?.avatarUrl,
        hasUnseen: false,
        lastUpdated: myStories[myStories.length - 1].createdAt,
        stories: myStories,
      });
      setIsViewerOpen(true);
    } else {
      setCreatorMode('media');
      setIsCreatorOpen(true);
    }
  };

  const openContactStory = (group: UserStoryGroup) => {
    setActiveStoryGroup(group);
    setIsViewerOpen(true);
  };

  const formatStoryTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: tokens.spacing.huge * 3 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingFeed}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* My Status Section */}
        <Pressable
          onPress={openMyStatus}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: pressed ? theme.surfaceEmphasized : theme.background,
              borderBottomColor: theme.divider,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="My status update"
        >
          <StatusRing
            name={user?.displayName || 'My Status'}
            avatarUri={user?.avatarUrl}
            size="md"
            hasStories={hasMyStories}
            hasUnseen={hasMyStories}
            showAddBadge={!hasMyStories}
            onPress={openMyStatus}
            onAddPress={() => {
              setCreatorMode('media');
              setIsCreatorOpen(true);
            }}
          />

          <View style={styles.textCol}>
            <Text variant="h3">My status</Text>
            <Text variant="caption" colorRole="secondary">
              {hasMyStories
                ? `${myStories.length} update${myStories.length > 1 ? 's' : ''} • Tap to view`
                : 'Tap to add status update'}
            </Text>
          </View>

          {hasMyStories && (
            <Pressable
              onPress={() => {
                setCreatorMode('media');
                setIsCreatorOpen(true);
              }}
              style={styles.addMoreBtn}
              accessibilityLabel="Add new story"
            >
              <Ionicons name="camera-outline" size={20} color={theme.primary} />
            </Pressable>
          )}
        </Pressable>

        {/* Recent Updates Section */}
        {recentUpdates.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <Text variant="overline" colorRole="secondary">
                Recent updates
              </Text>
            </View>

            {recentUpdates.map((group) => (
              <Pressable
                key={group.userId}
                onPress={() => openContactStory(group)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: pressed ? theme.surfaceEmphasized : theme.background,
                    borderBottomColor: theme.divider,
                  },
                ]}
              >
                <StatusRing
                  name={group.displayName}
                  avatarUri={group.avatarUrl}
                  size="md"
                  hasStories={true}
                  hasUnseen={true}
                  onPress={() => openContactStory(group)}
                />

                <View style={styles.textCol}>
                  <Text variant="bodyMedium" style={{ fontWeight: '700' }}>
                    {group.displayName}
                  </Text>
                  <Text variant="caption" colorRole="secondary">
                    {formatStoryTime(group.lastUpdated)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Viewed Updates Section */}
        {viewedUpdates.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <Text variant="overline" colorRole="secondary">
                Viewed updates
              </Text>
            </View>

            {viewedUpdates.map((group) => (
              <Pressable
                key={group.userId}
                onPress={() => openContactStory(group)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: pressed ? theme.surfaceEmphasized : theme.background,
                    borderBottomColor: theme.divider,
                  },
                ]}
              >
                <StatusRing
                  name={group.displayName}
                  avatarUri={group.avatarUrl}
                  size="md"
                  hasStories={true}
                  hasUnseen={false}
                  onPress={() => openContactStory(group)}
                />

                <View style={styles.textCol}>
                  <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                    {group.displayName}
                  </Text>
                  <Text variant="caption" colorRole="disabled">
                    {formatStoryTime(group.lastUpdated)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Empty State */}
        {!hasMyStories && recentUpdates.length === 0 && viewedUpdates.length === 0 && (
          <View style={styles.emptyStatus}>
            <Ionicons name="radio-outline" size={44} color={theme.textDisabled} />
            <Text
              variant="body"
              colorRole="secondary"
              align="center"
              style={{ marginTop: tokens.spacing.sm, fontWeight: '600' }}
            >
              No status updates yet
            </Text>
            <Text
              variant="caption"
              colorRole="disabled"
              align="center"
              style={{ marginTop: 4, maxWidth: 260 }}
            >
              Share photos, videos or text that disappear after 24 hours.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Action Buttons (WhatsApp Dual FAB) */}
      <View style={styles.fabContainer} pointerEvents="box-none">
        {/* Pencil FAB (Text Status) */}
        <Pressable
          onPress={() => {
            setCreatorMode('text');
            setIsCreatorOpen(true);
          }}
          style={({ pressed }) => [
            styles.pencilFab,
            {
              backgroundColor: theme.surfaceEmphasized,
              opacity: pressed ? 0.8 : 1,
              ...tokens.elevation[2],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Create text status"
        >
          <Ionicons name="pencil" size={20} color={theme.textPrimary} />
        </Pressable>

        {/* Camera FAB (Media Status) */}
        <Pressable
          onPress={() => {
            setCreatorMode('media');
            setIsCreatorOpen(true);
          }}
          style={({ pressed }) => [
            styles.cameraFab,
            {
              backgroundColor: theme.primary,
              opacity: pressed ? 0.85 : 1,
              ...tokens.elevation[4],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Create photo status"
        >
          <Ionicons name="camera" size={24} color={theme.textInverse} />
        </Pressable>
      </View>

      {/* Full-Screen Status Viewer */}
      <StatusViewerModal
        visible={isViewerOpen}
        storyGroup={activeStoryGroup}
        onClose={() => {
          setIsViewerOpen(false);
          setActiveStoryGroup(null);
        }}
      />

      {/* Status Creator Modal */}
      <CreateStatusModal
        visible={isCreatorOpen}
        initialMode={creatorMode}
        onClose={() => setIsCreatorOpen(false)}
        onSuccess={() => {
          if (token) void fetchFeed(token);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 0.5,
    minHeight: 74,
    gap: tokens.spacing.md,
  },
  textCol: {
    flex: 1,
    gap: 3,
  },
  addMoreBtn: {
    padding: tokens.spacing.sm,
    borderRadius: 20,
  },
  sectionHeader: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.xs,
  },
  emptyStatus: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.huge,
    paddingHorizontal: tokens.spacing.xl,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    alignItems: 'center',
    gap: 14,
  },
  pencilFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
