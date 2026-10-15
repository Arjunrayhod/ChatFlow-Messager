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
  Modal,
  Pressable,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../src/theme/tokens';
import { Text } from '../../src/components/atoms/Text';
import { Button } from '../../src/components/atoms/Button';
import { Avatar } from '../../src/components/atoms/Avatar';
import { TextInputField } from '../../src/components/atoms/TextInputField';
import { ChatListItem } from '../../src/components/molecules/ChatListItem';
import { EmptyState } from '../../src/components/molecules/EmptyState';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useChatStore } from '../../src/store/useChatStore';
import { Contact, UserProfile } from '@chatflow/shared';

export default function ChatsScreen() {
  const router = useRouter();
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

  // Load contacts when screen mounts or user token changes
  useEffect(() => {
    if (token) {
      void fetchContacts(token);
    }
  }, [token, fetchContacts]);

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

  const handleStartChatWithContact = (contact: Contact) => {
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
    if (!token) return;
    setAddingUsername(targetUser.username);

    const result = await addContact(token, targetUser.username);
    setAddingUsername(null);

    if (result.success) {
      closeNewChatModal();
      setModalSearchText('');
      router.push({
        pathname: '/chat/[id]',
        params: {
          id: targetUser.id,
          name: targetUser.displayName,
          username: targetUser.username,
        },
      });
    } else {
      Alert.alert('Notice', result.message || 'Could not add contact');
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
          style={styles.searchInput}
        />
        {inboxFilter.length > 0 && (
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
        )}
      </View>

      {/* Main Conversation / Contact List */}
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
              lastMessage={`@${item.user.username} • Tap to message`}
              timestamp="Active"
              onPress={() => handleStartChatWithContact(item)}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: tokens.spacing.huge * 2 }}
        />
      ) : (
        <EmptyState
          iconName="chatbubbles-outline"
          title={inboxFilter ? 'No Matches Found' : 'No Conversations Yet'}
          description={
            inboxFilter
              ? `No chats found matching "${inboxFilter}". Search an @username to connect.`
              : 'ChatFlow connects you without phone numbers. Tap the button below to discover users by their @username.'
          }
          actionLabel="Start a New Chat"
          onActionPress={openNewChatModal}
        />
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
                <View
                  style={[
                    styles.searchResultItem,
                    {
                      borderBottomColor: theme.divider,
                    },
                  ]}
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
                    label={addingUsername === item.username ? 'Adding...' : 'Chat'}
                    onPress={() => void handleAddAndStartChat(item)}
                    variant="primary"
                    size="sm"
                    isLoading={addingUsername === item.username}
                  />
                </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
});
