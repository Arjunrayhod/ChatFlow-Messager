/**
 * @file StatusViewersModal molecule component.
 * Displays list of contacts who viewed a user's status story.
 * Shows view count, timestamp, and Snapchat-style screenshot indicators.
 * 
 * Strict compliance with RULE 0.1 (Zero phone numbers) and RULE 0.7 (Design tokens).
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  FlatList,
  Pressable,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { Text } from '../atoms/Text';
import { Avatar } from '../atoms/Avatar';
import { StatusViewer, StatusItem } from '@chatflow/shared';
import * as api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';

export interface StatusViewersModalProps {
  visible: boolean;
  status: StatusItem | null;
  onClose: () => void;
  onDeleteStatus: (statusId: string) => void;
}

export const StatusViewersModal: React.FC<StatusViewersModalProps> = ({
  visible,
  status,
  onClose,
  onDeleteStatus,
}) => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;
  const { token } = useAuthStore();

  const [viewers, setViewers] = useState<StatusViewer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (visible && status && token) {
      setIsLoading(true);
      void api
        .fetchStatusViewers(token, status.id)
        .then((res) => {
          if (res.ok && res.data) {
            setViewers(res.data);
          } else if (status.viewers) {
            setViewers(status.viewers);
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [visible, status, token]);

  const handleDelete = () => {
    if (!status) return;
    Alert.alert(
      'Delete Status Update?',
      'This status will be deleted immediately for everyone before the 24-hour expiration.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            onDeleteStatus(status.id);
            setIsDeleting(false);
            onClose();
          },
        },
      ]
    );
  };

  const formatViewedTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recently';
    }
  };

  if (!status) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.surface,
              paddingBottom: Math.max(insets.bottom, tokens.spacing.md),
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.divider }]}>
            <View style={styles.headerLeft}>
              <Ionicons name="eye-outline" size={20} color={theme.textPrimary} />
              <Text variant="h3" style={styles.headerTitle}>
                Viewed by {viewers.length}
              </Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                onPress={handleDelete}
                style={({ pressed }) => [
                  styles.iconButton,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                accessibilityLabel="Delete status"
              >
                <Ionicons name="trash-outline" size={20} color={theme.error} />
              </Pressable>

              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.iconButton,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                accessibilityLabel="Close viewers"
              >
                <Ionicons name="close" size={22} color={theme.textPrimary} />
              </Pressable>
            </View>
          </View>

          {/* Viewers List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : viewers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="eye-off-outline" size={36} color={theme.textDisabled} />
              <Text variant="bodyMedium" colorRole="secondary" align="center" style={{ marginTop: 8 }}>
                No views yet
              </Text>
              <Text variant="caption" colorRole="disabled" align="center">
                Check back later to see who viewed your status.
              </Text>
            </View>
          ) : (
            <FlatList
              data={viewers}
              keyExtractor={(item) => item.userId}
              renderItem={({ item }) => (
                <View style={[styles.viewerRow, { borderBottomColor: theme.divider }]}>
                  <Avatar
                    name={item.displayName}
                    uri={item.avatarUrl}
                    size="sm"
                  />

                  <View style={styles.viewerDetails}>
                    <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                      {item.displayName}
                    </Text>
                    <Text variant="caption" colorRole="secondary">
                      @{item.username} • {formatViewedTime(item.viewedAt)}
                    </Text>
                  </View>

                  {/* Snapchat-Style Screenshot Detection Badge */}
                  {item.hasScreenshotted && (
                    <View style={styles.screenshotBadge}>
                      <Ionicons name="camera" size={14} color="#EA0038" />
                      <Text variant="caption" style={styles.screenshotText}>
                        Screenshotted
                      </Text>
                    </View>
                  )}
                </View>
              )}
              contentContainerStyle={{ paddingHorizontal: tokens.spacing.md }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    maxHeight: '65%',
    minHeight: 280,
    ...tokens.elevation[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 0.5,
    gap: tokens.spacing.sm,
  },
  viewerDetails: {
    flex: 1,
  },
  screenshotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(234, 0, 56, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(234, 0, 56, 0.25)',
  },
  screenshotText: {
    color: '#EA0038',
    fontSize: 11,
    fontWeight: '700',
  },
  loadingContainer: {
    padding: tokens.spacing.xl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
