/**
 * @file Zustand state store for Contacts, Search, and Chat conversations.
 * Enforces RULE 0.1: Identity strictly anchored to @username and Google email.
 * 
 * [HINGLISH GUIDE]:
 * Yeh store ChatFlow ke Contacts, @username Search, aur Chats list ko manage karta hai.
 * Server APIs se contacts sync karta hai aur naye users search karke contact me add karta hai.
 */

import { create } from 'zustand';
import { Contact, UserProfile, ChatMessage } from '@chatflow/shared';
import {
  getContacts,
  searchUsers as searchUsersApi,
  addContact as addContactApi,
  removeContact as removeContactApi,
} from '../services/api';
import { useAuthStore } from './useAuthStore';

export interface ChatState {
  contacts: Contact[];
  isLoadingContacts: boolean;
  contactsError: string | null;

  activeChatId: string | null;
  setActiveChatId: (chatId: string | null) => void;

  searchQuery: string;
  searchResults: UserProfile[];
  isSearching: boolean;
  searchError: string | null;

  isNewChatModalOpen: boolean;

  fetchContacts: (token: string) => Promise<void>;
  updateContactOnMessage: (message: ChatMessage, currentUserId: string) => void;
  markChatAsRead: (contactUserId: string) => void;
  searchUsers: (token: string, query: string) => Promise<void>;
  addContact: (token: string, username: string, nickname?: string) => Promise<{ success: boolean; message?: string }>;
  removeContact: (token: string, contactUserId: string) => Promise<boolean>;
  openNewChatModal: () => void;
  closeNewChatModal: () => void;
  clearSearch: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  contacts: [],
  isLoadingContacts: false,
  contactsError: null,

  activeChatId: null,
  setActiveChatId: (activeChatId) => set({ activeChatId }),

  searchQuery: '',
  searchResults: [],
  isSearching: false,
  searchError: null,

  isNewChatModalOpen: false,

  /**
   * Fetches the user's saved contacts list from backend.
   */
  fetchContacts: async (token: string) => {
    if (!token) return;
    set({ isLoadingContacts: true, contactsError: null });

    const result = await getContacts(token);
    if (result.ok) {
      set({ contacts: result.data, isLoadingContacts: false, contactsError: null });
    } else {
      set({ isLoadingContacts: false, contactsError: result.error.message });
    }
  },

  /**
   * Updates contact with newest incoming/outgoing message snippet,
   * calculates unread count badge, and moves the active conversation to index 0 (TOP).
   */
  updateContactOnMessage: (message: ChatMessage, currentUserId: string) => {
    const { contacts, activeChatId } = get();

    // Determine the peer userId
    const parts = message.chatId.split('_');
    const peerUserId = parts.find((p) => p !== currentUserId) || message.senderId;

    let snippet = message.content;
    if (message.type === 'image') snippet = '📷 Photo';
    else if (message.type === 'video') snippet = '🎥 Video';
    else if (message.type === 'audio') snippet = '🎤 Voice message';
    else if (message.type === 'document') snippet = '📄 Document';
    else if (message.type === 'location') snippet = '📍 Location';

    const isCurrentActiveChat = activeChatId === message.chatId || activeChatId === peerUserId;
    const isFromPeer = message.senderId !== currentUserId;

    const existingIndex = contacts.findIndex(
      (c) => c.contactUserId === peerUserId || c.id === message.chatId || c.id === `conv_${message.chatId}`
    );

    if (existingIndex !== -1) {
      const existing = contacts[existingIndex];
      const unreadCount = isFromPeer && !isCurrentActiveChat
        ? (existing.unreadCount || 0) + 1
        : (isCurrentActiveChat ? 0 : (existing.unreadCount || 0));

      const updatedContact: Contact = {
        ...existing,
        lastMessage: snippet,
        lastMessageTimestamp: message.createdAt,
        unreadCount,
      };

      // Place this conversation at the VERY TOP of the array (WhatsApp pattern)
      const remaining = contacts.filter((_, idx) => idx !== existingIndex);
      set({ contacts: [updatedContact, ...remaining] });
    } else {
      // New conversation from user not yet in local state -> fetch fresh contacts
      const token = useAuthStore.getState().token;
      if (token) {
        void get().fetchContacts(token);
      }
    }
  },

  /**
   * Clears the unread count when a conversation is opened.
   */
  markChatAsRead: (contactUserId: string) => {
    const { contacts } = get();
    const updated = contacts.map((c) => {
      if (
        c.contactUserId === contactUserId ||
        c.id === contactUserId ||
        c.id === `conv_${contactUserId}`
      ) {
        return { ...c, unreadCount: 0 };
      }
      return c;
    });
    set({ contacts: updated });
  },

  /**
   * Searches users live by unique @username or display name.
   */
  searchUsers: async (token: string, query: string) => {
    const clean = query.trim().replace(/^@/, '');
    set({ searchQuery: query });

    if (!clean) {
      set({ searchResults: [], isSearching: false, searchError: null });
      return;
    }

    set({ isSearching: true, searchError: null });
    const result = await searchUsersApi(token, clean);

    if (result.ok) {
      set({ searchResults: result.data, isSearching: false, searchError: null });
    } else {
      set({ searchResults: [], isSearching: false, searchError: result.error.message });
    }
  },

  /**
   * Adds a user to contacts list by @username.
   */
  addContact: async (token: string, username: string, nickname?: string) => {
    if (!token) return { success: false, message: 'Authentication required' };

    const result = await addContactApi(token, username, nickname);
    if (result.ok) {
      const { contacts } = get();
      // Prepend newly added contact
      set({ contacts: [result.data, ...contacts.filter(c => c.contactUserId !== result.data.contactUserId)] });
      return { success: true };
    } else {
      return { success: false, message: result.error.message };
    }
  },

  /**
   * Removes a contact from user's list.
   */
  removeContact: async (token: string, contactUserId: string) => {
    if (!token) return false;

    const result = await removeContactApi(token, contactUserId);
    if (result.ok && result.data.removed) {
      const { contacts } = get();
      set({ contacts: contacts.filter((c) => c.contactUserId !== contactUserId) });
      return true;
    }
    return false;
  },

  openNewChatModal: () => set({ isNewChatModalOpen: true }),
  closeNewChatModal: () => set({ isNewChatModalOpen: false, searchQuery: '', searchResults: [] }),
  clearSearch: () => set({ searchQuery: '', searchResults: [] }),
}));
