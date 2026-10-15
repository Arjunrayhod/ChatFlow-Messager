/**
 * @file Zustand state store for Contacts, Search, and Chat conversations.
 * Enforces RULE 0.1: Identity strictly anchored to @username and Google email.
 * 
 * [HINGLISH GUIDE]:
 * Yeh store ChatFlow ke Contacts, @username Search, aur Chats list ko manage karta hai.
 * Server APIs se contacts sync karta hai aur naye users search karke contact me add karta hai.
 */

import { create } from 'zustand';
import { Contact, UserProfile } from '@chatflow/shared';
import {
  getContacts,
  searchUsers as searchUsersApi,
  addContact as addContactApi,
  removeContact as removeContactApi,
} from '../services/api';

export interface ChatState {
  contacts: Contact[];
  isLoadingContacts: boolean;
  contactsError: string | null;

  searchQuery: string;
  searchResults: UserProfile[];
  isSearching: boolean;
  searchError: string | null;

  isNewChatModalOpen: boolean;

  fetchContacts: (token: string) => Promise<void>;
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
