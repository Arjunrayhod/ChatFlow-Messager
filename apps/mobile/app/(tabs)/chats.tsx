/**
 * @file Main Chat Inbox Screen (Phase 3).
 * Route: /(tabs)/chats
 * Displays active conversations, search, empty state, and new chat discovery modal.
 * Strict compliance with RULE 0.1 (No phone numbers) and RULE 0.7 (Design tokens).
 * 
 * [HINGLISH GUIDE]:
 * Yeh ChatFlow ka MAIN CHAT INBOX hai:
 * 1. Contacts & Conversations list dikhata hai.
 * 2. Search bar se chats aur contacts filter hote hain.
 * 3. Agar koi chat na ho to Empty State widget dikhta hai.
 * 4. FAB (+) button dabane par modal khulta hai jaha kisi bhi @username ko search karke naya chat start kar sakte hain.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  Modal,
  Pressable,
  Platform,
  useColorScheme,
  ActivityIndicator,
  Alert,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../src/theme/tokens';
import { Text } from '../../src/components/atoms/Text';
import { Button } from '../../src/components/atoms/Button';
import { Avatar } from '../../src/components/atoms/Avatar';
import { TextInputField } from '../../src/components/atoms/TextInputField';
import { ChatListItem } from '../../src/components/molecules/ChatListItem';
import { EmptyState } from '../../src/components/molecules/EmptyState';
import { QRCodeModal } from '../../src/components/molecules/QRCodeModal';
import { StoriesTray } from '../../src/components/molecules/StoriesTray';
import { StatusViewerModal } from '../../src/components/molecules/StatusViewerModal';
import { CreateStatusModal } from '../../src/components/molecules/CreateStatusModal';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useChatStore } from '../../src/store/useChatStore';
import { useStatusStore } from '../../src/store/useStatusStore';
import { searchUsers as searchUsersApi } from '../../src/services/api';
import { getSocket } from '../../src/services/socket';
import { Contact, UserProfile, UserStoryGroup } from '@chatflow/shared';

function formatWhatsAppTime(timestamp?: string | null): string | null {
  if (!timestamp) return null;
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;

    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return 'Yesterday';
    }

    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7 && diffDays > 0) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }

    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return null;
  }
}

export default function ChatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const { token, user, isAuthenticated } = useAuthStore();
  const {
    contacts,
    isLoadingContacts,
    fetchContacts,
    searchUsers,
    searchResults,
    isSearching,
    addContact,
    isNewChatModalOpen,
    openNewChatModal,
    closeNewChatModal,
  } = useChatStore();

  const [inboxFilter, setInboxFilter] = useState('');
  const [modalSearchText, setModalSearchText] = useState('');
  const [addingUsername, setAddingUsername] = useState<string | null>(null);

  // QR Modal States
  const [isQROpen, setIsQROpen] = useState(false);
  const [qrModalInitialTab, setQrModalInitialTab] = useState<'my_code' | 'scan_code'>('scan_code');

  const openQRModal = (tab: 'my_code' | 'scan_code' = 'scan_code') => {
    setQrModalInitialTab(tab);
    setIsQROpen(true);
  };

  // Status / Stories State
  const {
    myStories,
    contactStories,
    fetchFeed,
    activeScreenshotNotice,
    setScreenshotNotice,
  } = useStatusStore();
  const [activeStoryGroup, setActiveStoryGroup] = useState<UserStoryGroup | null>(null);
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false);
  const [isStatusCreatorOpen, setIsStatusCreatorOpen] = useState(false);

  // Load contacts and stories when screen mounts or user token changes
  useEffect(() => {
    if (token) {
      void fetchContacts(token);
      void fetchFeed(token);
    }
  }, [token, fetchContacts, fetchFeed]);

  // Real-time Snapchat Screenshot alerts, stories feed, and instant message arrival
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onScreenshot = (payload: {
      targetType: 'status' | 'chat';
      targetId: string;
      takerUserId: string;
      takerUsername: string;
      takerDisplayName: string;
      timestamp: string;
    }) => {
      setScreenshotNotice(payload);
    };

    const onFeedUpdate = () => {
      if (token) void fetchFeed(token);
    };

    socket.on('screenshot_detected', onScreenshot);
    socket.on('status_feed_update', onFeedUpdate);

    return () => {
      socket.off('screenshot_detected', onScreenshot);
      socket.off('status_feed_update', onFeedUpdate);
    };
  }, [token, fetchFeed, setScreenshotNotice]);

  // Prevent back navigation from logging out / popping to sign-in screen
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backAction = () => {
        BackHandler.exitApp();
        return true;
      };
      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onPopState = () => {
        if (useAuthStore.getState().isAuthenticated) {
          window.history.pushState(null, '', window.location.href);
        }
      };
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', onPopState);
      return () => window.removeEventListener('popstate', onPopState);
    }
  }, []);

  // Debounced search inside modal
  useEffect(() => {
    if (!token || !isNewChatModalOpen) return;

    const handler = setTimeout(() => {
      if (modalSearchText.trim()) {
        void searchUsers(token, modalSearchText.trim());
      }
    }, 350);

    return () => clearTimeout(handler);
  }, [modalSearchText, isNewChatModalOpen, token, searchUsers]);

  // Filter local contacts by search input
  const filteredContacts = useMemo(() => {
    if (!inboxFilter.trim()) return contacts;
    const q = inboxFilter.toLowerCase().trim().replace(/^@/, '');
    return contacts.filter(
      (c) =>
        c.user.username.toLowerCase().includes(q) ||
        c.user.displayName.toLowerCase().includes(q)
    );
  }, [contacts, inboxFilter]);

  // Global search state for top search bar (Direct search on Desktop & Mobile)
  const [globalResults, setGlobalResults] = useState<UserProfile[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);

  // Debounced global user search from top search bar
  useEffect(() => {
    const q = inboxFilter.trim().replace(/^@/, '');
    if (!token || q.length < 1) {
      setGlobalResults([]);
      setIsSearchingGlobal(false);
      return;
    }

    setIsSearchingGlobal(true);
    const handler = setTimeout(async () => {
      try {
        const res = await searchUsersApi(token, q);
        if (res.ok) {
          const contactUserIds = new Set(contacts.map((c) => c.contactUserId));
          const filtered = res.data.filter(
            (u) => u.id !== user?.id && !contactUserIds.has(u.id)
          );
          setGlobalResults(filtered);
        } else {
          setGlobalResults([]);
        }
      } catch {
        setGlobalResults([]);
      } finally {
        setIsSearchingGlobal(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [inboxFilter, token, contacts, user?.id]);

  const handleStartChatWithContact = (contact: Contact) => {
    // Clear unread count for this conversation
    useChatStore.getState().markChatAsRead(contact.contactUserId);

    // Navigate to chat room (Phase 4 route)
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: contact.contactUserId,
        name: contact.user.displayName,
        username: contact.user.username,
      },
    });
  };

  const handleAddAndStartChat = async (targetUser: UserProfile) => {
    closeNewChatModal();
    setModalSearchText('');
    setInboxFilter('');

    // Open chat room immediately!
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: targetUser.id,
        name: targetUser.displayName,
        username: targetUser.username,
      },
    });

    // In background, ensure they are saved to contacts list
    if (token) {
      void addContact(token, targetUser.username);
    }
  };

  const handleTopSearchSubmit = () => {
    if (filteredContacts.length > 0) {
      handleStartChatWithContact(filteredContacts[0]);
    } else if (globalResults.length > 0) {
      void handleAddAndStartChat(globalResults[0]);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Search Header Bar */}
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.divider,
          },
        ]}
      >
        <Ionicons
          name="search-outline"
          size={tokens.iconSizes.sm}
          color={theme.textSecondary}
          style={styles.searchIcon}
        />
        <TextInputField
          placeholder="Search by name or @username..."
          value={inboxFilter}
          onChangeText={setInboxFilter}
          onSubmitEditing={handleTopSearchSubmit}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {inboxFilter.length > 0 ? (
          <Pressable
            onPress={() => setInboxFilter('')}
            style={styles.clearButton}
            accessibilityLabel="Clear search"
          >
            <Ionicons
              name="close-circle"
              size={tokens.iconSizes.sm}
              color={theme.textSecondary}
            />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => openQRModal('scan_code')}
            style={styles.qrScanButton}
            accessibilityRole="button"
            accessibilityLabel="Scan QR code"
          >
            <Ionicons name="qr-code-outline" size={20} color={theme.primary} />
          </Pressable>
        )}
      </View>

      {/* Snapchat-Style Top Screenshot Detection Notification Banner */}
      {activeScreenshotNotice && (
        <View style={styles.topScreenshotNotice}>
          <Ionicons name="camera" size={16} color="#FFFFFF" />
          <Text variant="caption" style={styles.topScreenshotText}>
            Alert: @{activeScreenshotNotice.takerUsername} took a screenshot of your {activeScreenshotNotice.targetType}!
          </Text>
        </View>
      )}

      {inboxFilter.trim().length > 0 ? (
        /* Instant Search View for Desktop & Mobile */
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: tokens.spacing.huge * 2 }}
        >
          {filteredContacts.length > 0 && (
            <View>
              <Text
                variant="caption"
                colorRole="secondary"
                style={[styles.sectionHeader, { color: theme.textSecondary }]}
              >
                Chats ({filteredContacts.length})
              </Text>
              {filteredContacts.map((item) => (
                <ChatListItem
                  key={item.id}
                  id={item.id}
                  displayName={item.nickname || item.user.displayName}
                  username={item.user.username}
                  avatarUri={item.user.avatarUrl}
                  presence={item.user.presenceStatus}
                  lastMessage={item.lastMessage || `@${item.user.username} • Tap to message`}
                  timestamp={formatWhatsAppTime(item.lastMessageTimestamp || item.createdAt)}
                  unreadCount={item.unreadCount || 0}
                  onPress={() => handleStartChatWithContact(item)}
                />
              ))}
            </View>
          )}

          {isSearchingGlobal && (
            <View style={styles.searchingGlobalRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text variant="caption" colorRole="secondary" style={{ marginLeft: tokens.spacing.xs }}>
                Searching ChatFlow directory for "{inboxFilter.trim()}"...
              </Text>
            </View>
          )}

          {globalResults.length > 0 && (
            <View>
              <Text
                variant="caption"
                colorRole="secondary"
                style={[styles.sectionHeader, { color: theme.textSecondary }]}
              >
                ChatFlow Users ({globalResults.length})
              </Text>
              {globalResults.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => void handleAddAndStartChat(item)}
                  style={({ pressed }) => [
                    styles.searchResultItem,
                    {
                      borderBottomColor: theme.divider,
                      backgroundColor: pressed ? theme.surfaceEmphasized : 'transparent',
                      cursor: (Platform.OS === 'web' ? 'pointer' : undefined) as any,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Chat with ${item.displayName}`}
                >
                  <Avatar
                    name={item.displayName}
                    uri={item.avatarUrl}
                    size="md"
                    presence={item.presenceStatus}
                  />
                  <View style={styles.searchResultInfo}>
                    <Text variant="h4">{item.displayName}</Text>
                    <Text variant="caption" colorRole="primary">
                      @{item.username}
                    </Text>
                    {item.bio && (
                      <Text variant="caption" colorRole="secondary" numberOfLines={1}>
                        {item.bio}
                      </Text>
                    )}
                  </View>
                  <Button
                    label="Chat"
                    onPress={() => void handleAddAndStartChat(item)}
                    variant="primary"
                    size="sm"
                  />
                </Pressable>
              ))}
            </View>
          )}

          {!isSearchingGlobal && filteredContacts.length === 0 && globalResults.length === 0 && (
            <EmptyState
              iconName="person-remove-outline"
              title="No User Found"
              description={`No ChatFlow user found matching "${inboxFilter}". Double check the spelling or start a new chat.`}
              actionLabel="Search in New Chat"
              onActionPress={() => {
                setModalSearchText(inboxFilter);
                openNewChatModal();
              }}
            />
          )}
        </ScrollView>
      ) : (
        /* Regular Home View: Stories Tray + Conversations List */
        <>
          <StoriesTray
            myStories={myStories}
            contactStories={contactStories}
            onOpenMyStatus={() => {
              if (myStories.length > 0) {
                setActiveStoryGroup({
                  userId: user?.id || 'me',
                  username: user?.username || 'me',
                  displayName: user?.displayName || 'My Status',
                  avatarUrl: user?.avatarUrl,
                  hasUnseen: false,
                  lastUpdated: myStories[myStories.length - 1].createdAt,
                  stories: myStories,
                });
                setIsStoryViewerOpen(true);
              } else {
                setIsStatusCreatorOpen(true);
              }
            }}
            onAddNewStatus={() => setIsStatusCreatorOpen(true)}
            onOpenContactStory={(group) => {
              setActiveStoryGroup(group);
              setIsStoryViewerOpen(true);
            }}
          />

          {isLoadingContacts && contacts.length === 0 ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text variant="caption" colorRole="secondary" style={styles.loadingText}>
                Loading conversations...
              </Text>
            </View>
          ) : filteredContacts.length > 0 ? (
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ChatListItem
                  id={item.id}
                  displayName={item.nickname || item.user.displayName}
                  username={item.user.username}
                  avatarUri={item.user.avatarUrl}
                  presence={item.user.presenceStatus}
                  lastMessage={item.lastMessage || `@${item.user.username} • Tap to message`}
                  timestamp={formatWhatsAppTime(item.lastMessageTimestamp || item.createdAt)}
                  unreadCount={item.unreadCount || 0}
                  onPress={() => handleStartChatWithContact(item)}
                />
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: tokens.spacing.huge * 2 }}
            />
          ) : (
            <EmptyState
              iconName="chatbubbles-outline"
              title="No Conversations Yet"
              description="ChatFlow connects you without phone numbers. Tap the button below to discover users by their @username."
              actionLabel="Start a New Chat"
              onActionPress={openNewChatModal}
            />
          )}
        </>
      )}

      {/* Floating Action Button (FAB) */}
      <Pressable
        onPress={openNewChatModal}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Start a new chat"
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: theme.primary,
            opacity: pressed ? 0.85 : 1,
            ...tokens.elevation[3],
          },
        ]}
      >
        <Ionicons name="chatbubble-ellipses" size={26} color={theme.textInverse} />
      </Pressable>

      {/* New Chat & User Discovery Modal */}
      <Modal
        visible={isNewChatModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeNewChatModal}
      >
        <View style={[styles.modalRoot, { backgroundColor: theme.background }]}>
          {/* Modal Header */}
          <View
            style={[
              styles.modalHeader,
              {
                backgroundColor: theme.primary,
                paddingTop: Math.max(insets.top, tokens.spacing.md),
              },
            ]}
          >
            <View style={styles.modalHeaderTitleRow}>
              <Text variant="h2" colorRole="inverse">
                New Conversation
              </Text>
              <Pressable
                onPress={closeNewChatModal}
                style={styles.modalCloseButton}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={theme.textInverse} />
              </Pressable>
            </View>
            <Text variant="caption" colorRole="inverse" style={{ opacity: 0.9 }}>
              Discover users strictly by their @username (Zero Phone Numbers)
            </Text>
          </View>

          {/* Quick Action: QR Code & Scanner */}
          <View style={styles.modalQuickActions}>
            <Pressable
              onPress={() => {
                closeNewChatModal();
                openQRModal('scan_code');
              }}
              style={({ pressed }) => [
                styles.modalQuickActionItem,
                {
                  backgroundColor: pressed ? theme.surfaceEmphasized : theme.surface,
                  borderColor: theme.divider,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Scan QR Code"
            >
              <View style={[styles.modalQuickIconCircle, { backgroundColor: theme.primary }]}>
                <Ionicons name="scan-outline" size={20} color={theme.textInverse} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                  Scan QR Code
                </Text>
                <Text variant="caption" colorRole="secondary">
                  Scan a friend's code to start chatting
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textDisabled} />
            </Pressable>

            <Pressable
              onPress={() => {
                closeNewChatModal();
                openQRModal('my_code');
              }}
              style={({ pressed }) => [
                styles.modalQuickActionItem,
                {
                  backgroundColor: pressed ? theme.surfaceEmphasized : theme.surface,
                  borderColor: theme.divider,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="My QR Code"
            >
              <View style={[styles.modalQuickIconCircle, { backgroundColor: theme.surfaceEmphasized }]}>
                <Ionicons name="qr-code-outline" size={20} color={theme.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                  My QR Code
                </Text>
                <Text variant="caption" colorRole="secondary">
                  Display your personal code for friends
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textDisabled} />
            </Pressable>
          </View>

          {/* Modal Search Input */}
          <View
            style={[
              styles.modalSearchBox,
              {
                backgroundColor: theme.surface,
                borderBottomColor: theme.divider,
              },
            ]}
          >
            <TextInputField
              label="Search @username or name"
              prefix="@"
              placeholder="e.g. alexrivers"
              value={modalSearchText}
              onChangeText={setModalSearchText}
              onSubmitEditing={() => {
                if (searchResults.length > 0) {
                  void handleAddAndStartChat(searchResults[0]);
                }
              }}
              returnKeyType="search"
              autoFocus={true}
              autoCapitalize="none"
              helperText={
                isSearching
                  ? 'Searching users...'
                  : modalSearchText.length > 0
                  ? `Showing results for "@${modalSearchText.replace(/^@/, '')}"`
                  : 'Enter at least 1 letter to search registered users'
              }
            />
          </View>

          {/* Search Results List */}
          {isSearching ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingVertical: tokens.spacing.xs }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => void handleAddAndStartChat(item)}
                  style={({ pressed }) => [
                    styles.searchResultItem,
                    {
                      borderBottomColor: theme.divider,
                      backgroundColor: pressed ? theme.surfaceEmphasized : 'transparent',
                      cursor: (Platform.OS === 'web' ? 'pointer' : undefined) as any,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Chat with ${item.displayName}`}
                >
                  <Avatar
                    name={item.displayName}
                    uri={item.avatarUrl}
                    size="md"
                    presence={item.presenceStatus}
                  />
                  <View style={styles.searchResultInfo}>
                    <Text variant="h4">{item.displayName}</Text>
                    <Text variant="caption" colorRole="primary">
                      @{item.username}
                    </Text>
                    {item.bio && (
                      <Text variant="caption" colorRole="secondary" numberOfLines={1}>
                        {item.bio}
                      </Text>
                    )}
                  </View>
                  <Button
                    label="Chat"
                    onPress={() => void handleAddAndStartChat(item)}
                    variant="primary"
                    size="sm"
                  />
                </Pressable>
              )}
            />
          ) : modalSearchText.trim().length > 0 ? (
            <View style={styles.noResultsBox}>
              <Ionicons
                name="person-remove-outline"
                size={40}
                color={theme.textDisabled}
              />
              <Text variant="h3" align="center" style={{ marginTop: tokens.spacing.sm }}>
                No User Found
              </Text>
              <Text variant="body" colorRole="secondary" align="center">
                No ChatFlow account matching "@{modalSearchText.replace(/^@/, '')}". Make sure the username is spelled correctly.
              </Text>
            </View>
          ) : (
            <View style={styles.modalHintBox}>
              <Ionicons
                name="search-outline"
                size={48}
                color={theme.primary}
              />
              <Text variant="h3" align="center" style={{ marginTop: tokens.spacing.sm }}>
                Instant @Username Search
              </Text>
              <Text variant="body" colorRole="secondary" align="center">
                Search friends or colleagues by their handle. No phone numbers are exchanged or needed.
              </Text>
            </View>
          )}
        </View>
      </Modal>

      {/* QR Code and Scanner Modal */}
      <QRCodeModal
        visible={isQROpen}
        onClose={() => setIsQROpen(false)}
        initialTab={qrModalInitialTab}
      />

      {/* Full-Screen Status Story Viewer Modal */}
      <StatusViewerModal
        visible={isStoryViewerOpen}
        storyGroup={activeStoryGroup}
        onClose={() => {
          setIsStoryViewerOpen(false);
          setActiveStoryGroup(null);
        }}
      />

      {/* Status Creator Modal */}
      <CreateStatusModal
        visible={isStatusCreatorOpen}
        onClose={() => setIsStatusCreatorOpen(false)}
        onSuccess={() => {
          if (token) void fetchFeed(token);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topScreenshotNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EA0038',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    marginHorizontal: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
    borderRadius: tokens.radii.md,
    ...tokens.elevation[2],
  },
  topScreenshotText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderBottomWidth: 1,
  },
  searchIcon: {
    marginRight: tokens.spacing.xs,
  },
  searchInput: {
    flex: 1,
  },
  clearButton: {
    padding: tokens.spacing.xs,
    minWidth: tokens.spacing.huge,
    minHeight: tokens.spacing.huge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrScanButton: {
    padding: tokens.spacing.xs,
    minWidth: tokens.spacing.huge,
    minHeight: tokens.spacing.huge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
  },
  loadingText: {
    marginTop: tokens.spacing.xs,
  },
  fab: {
    position: 'absolute',
    bottom: tokens.spacing.xl,
    right: tokens.spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRoot: {
    flex: 1,
  },
  modalHeader: {
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    gap: tokens.spacing.xxs,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCloseButton: {
    minWidth: tokens.spacing.huge,
    minHeight: tokens.spacing.huge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchBox: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    gap: tokens.spacing.md,
  },
  searchResultInfo: {
    flex: 1,
    gap: tokens.spacing.xxs,
  },
  noResultsBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
  },
  modalHintBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
    gap: tokens.spacing.xs,
  },
  modalQuickActions: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  modalQuickActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    minHeight: tokens.spacing.huge,
  },
  modalQuickIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.xs,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  searchingGlobalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
});
