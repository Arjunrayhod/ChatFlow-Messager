/**
 * @file 1-on-1 Real-time Chat Room (Phase 4).
 * Route: /chat/[id]
 * Features real-time Socket.IO messaging, message bubbles, delivery ticks, and typing indicators.
 * Strict compliance with RULE 0.1 (No phone numbers) and RULE 0.7 (Design tokens).
 * 
 * [HINGLISH GUIDE]:
 * Yeh Real-time 1-on-1 Chat Room screen hai:
 * 1. Socket.IO connection se room join karta hai.
 * 2. Purani message history load karta hai.
 * 3. Naya message type karke send karne par instant 'sending' tick ke sath optimistically dikhta hai,
 *    aur jaise hi socket broadcast karta hai, 'sent' tick me convert ho jata hai.
 * 4. Typing indicator aur privacy guarantee banner display karta hai.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
  ActivityIndicator,
  Pressable,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../src/theme/tokens';
import { Text } from '../../src/components/atoms/Text';
import { Avatar } from '../../src/components/atoms/Avatar';
import { TextInputField } from '../../src/components/atoms/TextInputField';
import { IconButton } from '../../src/components/atoms/IconButton';
import { MessageBubble } from '../../src/components/molecules/MessageBubble';
import { MediaPreviewModal, SelectedMediaFile } from '../../src/components/molecules/MediaPreviewModal';
import { MediaLightboxModal, MediaLightboxData } from '../../src/components/molecules/MediaLightboxModal';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useMessageStore } from '../../src/store/useMessageStore';
import { useCallStore } from '../../src/store/useCallStore';
import { useChatStore } from '../../src/store/useChatStore';
import * as api from '../../src/services/api';
import {
  connectSocket,
  joinRoom,
  leaveRoom,
  getSocket,
} from '../../src/services/socket';
import { ChatMessage } from '@chatflow/shared';
import type { ChatExpense, ChatTask } from '@chatflow/shared';

export default function ChatRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; name?: string; username?: string }>();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const { token, user } = useAuthStore();
  const {
    messagesByChatId,
    isLoadingHistory,
    loadHistory,
    sendMessage,
    receiveMessage,
    setUserTyping,
    updateMessageStatus,
    patchMessage,
    removeMessageLocally,
    startTyping,
    stopTyping,
    typingUsersByChatId,
  } = useMessageStore();

  const startCall = useCallStore((state) => state.startCall);

  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // HD Media States
  const [selectedMedia, setSelectedMedia] = useState<SelectedMediaFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxData, setLightboxData] = useState<MediaLightboxData | null>(null);
  const [chatScreenshotAlert, setChatScreenshotAlert] = useState<string | null>(null);
  const [activeMessage, setActiveMessage] = useState<ChatMessage | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [disappearingSeconds, setDisappearingSeconds] = useState(0);
  const [undoMessage, setUndoMessage] = useState<ChatMessage | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolMode, setToolMode] = useState<'menu' | 'schedule' | 'expenses' | 'tasks'>('menu');
  const [scheduleDraft, setScheduleDraft] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenses, setExpenses] = useState<ChatExpense[]>([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskBody, setTaskBody] = useState('');
  const [assignTaskToPeer, setAssignTaskToPeer] = useState(true);
  const [tasks, setTasks] = useState<ChatTask[]>([]);
  const toolsOpenRef = useRef(toolsOpen);
  const toolModeRef = useRef(toolMode);
  toolsOpenRef.current = toolsOpen;
  toolModeRef.current = toolMode;

  const recipientId = params.id;
  const recipientName = params.name || 'Conversation';
  const recipientUsername = params.username ? `@${params.username.replace(/^@/, '')}` : '';

  // File selection handler
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    const mediaType = isVideo ? 'video' : isImage ? 'image' : 'document';

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;

      if (isImage) {
        const img = new (window as any).Image();
        img.onload = () => {
          setSelectedMedia({
            file,
            previewUrl: dataUrl,
            dataUrl,
            fileName: file.name,
            mimeType: file.type || 'image/jpeg',
            fileSize: file.size,
            width: img.naturalWidth,
            height: img.naturalHeight,
            type: 'image',
          });
        };
        img.src = dataUrl;
      } else if (isVideo) {
        const video = document.createElement('video');
        video.onloadedmetadata = () => {
          setSelectedMedia({
            file,
            previewUrl: dataUrl,
            dataUrl,
            fileName: file.name,
            mimeType: file.type || 'video/mp4',
            fileSize: file.size,
            width: video.videoWidth,
            height: video.videoHeight,
            duration: Math.round(video.duration),
            type: 'video',
          });
        };
        video.src = dataUrl;
      } else {
        setSelectedMedia({
          file,
          previewUrl: dataUrl,
          dataUrl,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
          type: 'document',
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Send original HD media
  const handleSendMedia = async (media: SelectedMediaFile, caption: string, isHD: boolean) => {
    if (!user?.id) return;
    setIsUploading(true);

    try {
      const uploadRes = await api.uploadMedia({
        fileName: media.fileName,
        mimeType: media.mimeType,
        data: media.dataUrl,
        isHD,
        width: media.width,
        height: media.height,
        duration: media.duration,
      });

      const mediaUrl = uploadRes.ok && uploadRes.data ? uploadRes.data.url : media.dataUrl;

      sendMessage(
        chatId,
        caption,
        user.id,
        media.type,
        mediaUrl,
        {
          isHD,
          fileSize: media.fileSize,
          fileName: media.fileName,
          mimeType: media.mimeType,
          width: media.width,
          height: media.height,
          duration: media.duration,
        }
      );

      setSelectedMedia(null);
    } catch {
      // Fallback: send as data URL directly
      sendMessage(
        chatId,
        caption,
        user.id,
        media.type,
        media.dataUrl,
        {
          isHD,
          fileSize: media.fileSize,
          fileName: media.fileName,
          mimeType: media.mimeType,
          width: media.width,
          height: media.height,
        }
      );
      setSelectedMedia(null);
    } finally {
      setIsUploading(false);
    }
  };

  // Deterministic chatId for 1-on-1 direct conversation
  const chatId = useMemo(() => {
    const myId = user?.id || 'me';
    return [myId, recipientId].sort().join('_');
  }, [user?.id, recipientId]);

  const messages: ChatMessage[] = useMemo(() => {
    return messagesByChatId[chatId] || [];
  }, [messagesByChatId, chatId]);

  const typingUsers = typingUsersByChatId[chatId] || [];
  const isRecipientTyping = typingUsers.some((u) => u !== user?.username);

  useEffect(() => {
    if (!token || !chatId) return;
    void api.getChatPreferences(token, chatId).then((result) => {
      if (result.ok) setDisappearingSeconds(result.data.disappearingSeconds);
    });
  }, [chatId, token]);

  useEffect(() => () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }, []);

  const applyDisappearing = async (seconds: number) => {
    if (!token) return;
    const result = await api.setChatDisappearing(token, chatId, seconds);
    if (!result.ok) {
      Alert.alert('Could not update', result.error.message);
      return;
    }
    setDisappearingSeconds(seconds);
    getSocket()?.emit('refresh_chat', { chatId });
    setPreferencesOpen(false);
  };

  const handleEditMessage = async () => {
    if (!activeMessage || !token || !editDraft.trim()) return;
    const result = await api.editChatMessage(token, chatId, activeMessage.id, editDraft.trim());
    if (result.ok) {
      patchMessage(chatId, activeMessage.id, result.data);
      getSocket()?.emit('refresh_chat', { chatId });
      setActiveMessage(null);
    } else {
      Alert.alert('Could not edit', result.error.message);
    }
  };

  const handlePinMessage = async () => {
    if (!activeMessage || !token) return;
    const pinned = !activeMessage.isPinned;
    const result = await api.setMessagePinned(token, chatId, activeMessage.id, pinned);
    if (result.ok) {
      patchMessage(chatId, activeMessage.id, { isPinned: pinned });
      getSocket()?.emit('refresh_chat', { chatId });
    }
    else Alert.alert('Could not update pin', result.error.message);
    setActiveMessage(null);
  };

  const handleHideMessage = async () => {
    if (!activeMessage || !token) return;
    const message = activeMessage;
    const result = await api.setMessageHidden(token, chatId, message.id, true);
    if (!result.ok) {
      Alert.alert('Could not delete', result.error.message);
      setActiveMessage(null);
      return;
    }
    removeMessageLocally(chatId, message.id);
    getSocket()?.emit('refresh_chat', { chatId });
    setUndoMessage(message);
    setActiveMessage(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoMessage(null), 8000);
  };

  const undoHideMessage = async () => {
    if (!undoMessage || !token) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const message = undoMessage;
    const result = await api.setMessageHidden(token, chatId, message.id, false);
    if (result.ok && (!message.expiresAt || Date.parse(message.expiresAt) > Date.now())) receiveMessage(message);
    if (result.ok) getSocket()?.emit('refresh_chat', { chatId });
    else Alert.alert('Undo failed', result.error.message);
    setUndoMessage(null);
  };

  useEffect(() => {
    if (!toolsOpen || !token) return;
    if (toolMode === 'expenses') void api.getChatExpenses(token, chatId).then((result) => { if (result.ok) setExpenses(result.data); });
    if (toolMode === 'tasks') void api.getChatTasks(token, chatId).then((result) => { if (result.ok) setTasks(result.data); });
  }, [chatId, token, toolsOpen, toolMode]);

  const handleScheduleMessage = async () => {
    if (!token || !scheduleDraft.trim() || !scheduleAt.trim()) return;
    const parsedDate = new Date(scheduleAt.trim().replace(' ', 'T'));
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() <= Date.now()) {
      Alert.alert('Choose a future time', 'Enter a future date and time.');
      return;
    }
    const result = await api.scheduleChatMessage(token, chatId, scheduleDraft.trim(), parsedDate.toISOString());
    if (!result.ok) {
      Alert.alert('Could not schedule', result.error.message);
      return;
    }
    setScheduleDraft('');
    setScheduleAt('');
    setToolsOpen(false);
  };

  const handleCreateExpense = async () => {
    if (!token || !user?.id || !expenseTitle.trim() || !Number(expenseAmount)) return;
    const result = await api.createChatExpense(token, chatId, {
      title: expenseTitle.trim(), amount: Number(expenseAmount), paidBy: user.id,
      splitBetween: [...new Set([user.id, recipientId])],
    });
    if (!result.ok) {
      Alert.alert('Could not add expense', result.error.message);
      return;
    }
    setExpenses((current) => [result.data, ...current]);
    getSocket()?.emit('refresh_chat', { chatId });
    setExpenseTitle('');
    setExpenseAmount('');
  };

  const handleCreateTask = async () => {
    if (!token || !taskTitle.trim()) return;
    const result = await api.createChatTask(token, chatId, {
      title: taskTitle.trim(), body: taskBody.trim() || null,
      assignedTo: assignTaskToPeer ? recipientId : user?.id || null,
    });
    if (!result.ok) {
      Alert.alert('Could not add task', result.error.message);
      return;
    }
    setTasks((current) => [result.data, ...current]);
    getSocket()?.emit('refresh_chat', { chatId });
    setTaskTitle('');
    setTaskBody('');
  };

  const toggleTask = async (task: ChatTask) => {
    if (!token) return;
    const result = await api.setChatTaskCompleted(token, chatId, task.id, !task.completedAt);
    if (result.ok) {
      setTasks((current) => current.map((item) => item.id === task.id ? result.data : item));
      getSocket()?.emit('refresh_chat', { chatId });
    }
    else Alert.alert('Could not update task', result.error.message);
  };

  // Setup Socket.IO connection and room lifecycle
  useEffect(() => {
    if (!token || !chatId) return;

    // Connect socket
    const socket = connectSocket(token);
    joinRoom(chatId);
    useChatStore.getState().setActiveChatId(chatId);
    useChatStore.getState().markChatAsRead(params.id || chatId);
    socket.emit('chat_read', { chatId });

    // Initial message history load
    void loadHistory(chatId, token);

    // Attach listeners
    const handleMessageNew = (payload: { message: ChatMessage; clientTempId?: string }) => {
      if (payload.message.chatId === chatId) {
        receiveMessage(payload.message, payload.clientTempId);
      }
      if (user?.id) {
        useChatStore.getState().updateContactOnMessage(payload.message, user.id);
      }
    };

    const handleUserTyping = (payload: { chatId: string; username: string; isTyping: boolean }) => {
      if (payload.chatId === chatId) {
        setUserTyping(chatId, payload.username, payload.isTyping);
      }
    };

    const handleStatusUpdate = (payload: { messageId: string; chatId: string; status: any }) => {
      if (payload.chatId === chatId) {
        updateMessageStatus(payload.messageId, chatId, payload.status);
      }
    };

    const handleChatRefresh = (payload: { chatId: string }) => {
      if (payload.chatId !== chatId) return;
      void loadHistory(chatId, token);
      void api.getChatPreferences(token, chatId).then((result) => {
        if (result.ok) setDisappearingSeconds(result.data.disappearingSeconds);
      });
      if (toolsOpenRef.current && toolModeRef.current === 'expenses') {
        void api.getChatExpenses(token, chatId).then((result) => { if (result.ok) setExpenses(result.data); });
      }
      if (toolsOpenRef.current && toolModeRef.current === 'tasks') {
        void api.getChatTasks(token, chatId).then((result) => { if (result.ok) setTasks(result.data); });
      }
    };

    const handleScreenshotDetected = (payload: {
      targetType: 'status' | 'chat';
      targetId: string;
      takerUserId: string;
      takerUsername: string;
      takerDisplayName: string;
    }) => {
      if (payload.targetId === chatId || payload.targetType === 'chat') {
        setChatScreenshotAlert(`⚠️ @${payload.takerUsername} took a screenshot of this chat!`);
        setTimeout(() => setChatScreenshotAlert(null), 7000);
      }
    };

    socket.on('message_new', handleMessageNew);
    socket.on('user_typing', handleUserTyping);
    socket.on('message_status_update', handleStatusUpdate);
    socket.on('chat_refresh', handleChatRefresh);
    socket.on('screenshot_detected', handleScreenshotDetected);

    return () => {
      leaveRoom(chatId);
      useChatStore.getState().setActiveChatId(null);
      socket.off('message_new', handleMessageNew);
      socket.off('user_typing', handleUserTyping);
      socket.off('message_status_update', handleStatusUpdate);
      socket.off('chat_refresh', handleChatRefresh);
      socket.off('screenshot_detected', handleScreenshotDetected);
    };
  }, [chatId, params.id, token, user?.id, loadHistory, receiveMessage, setUserTyping, updateMessageStatus]);

  // Keyboard shortcut screenshot detection for Web in Chat
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4'))) {
          const socket = getSocket();
          if (socket?.connected && user) {
            socket.emit('screenshot_alert', {
              targetType: 'chat',
              targetId: chatId,
              ownerId: recipientId,
              takerUserId: user.id,
              takerUsername: user.username,
              takerDisplayName: user.displayName,
            });
          }
        }
      };
      window.addEventListener('keyup', handleKeyUp);
      return () => window.removeEventListener('keyup', handleKeyUp);
    }
    return undefined;
  }, [chatId, recipientId, user]);

  const handleSend = () => {
    if (!inputText.trim() || !user) return;

    sendMessage(chatId, inputText.trim(), user.id);
    stopTyping(chatId);
    setInputText('');

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (text.length > 0) {
      startTyping(chatId);
    } else {
      stopTyping(chatId);
    }
  };

  const formatMessageTime = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        { backgroundColor: colorScheme === 'dark' ? '#0B141A' : '#EFEAE2' },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: {
            backgroundColor: theme.primary,
          },
          headerTintColor: theme.textInverse,
          headerTitle: () => (
            <View style={styles.headerTitleRow}>
              <Avatar name={recipientName} size="sm" presence="online" />
              <View style={styles.headerTextCol}>
                <Text variant="h3" colorRole="inverse" numberOfLines={1}>
                  {recipientName}
                </Text>
                <Text variant="caption" colorRole="inverse" style={{ opacity: 0.9 }}>
                  {recipientUsername} • Online
                </Text>
              </View>
            </View>
          ),
          headerRight: () => (
            <View style={styles.headerActions}>
              <IconButton
                name="videocam-outline"
                size="md"
                color={theme.textInverse}
                accessibilityLabel="Video Call"
                onPress={() => {
                  void startCall(
                    {
                      id: recipientId,
                      username: (params.username || 'user').replace(/^@/, ''),
                      displayName: recipientName,
                    },
                    'video'
                  );
                }}
              />
              <IconButton
                name="call-outline"
                size="md"
                color={theme.textInverse}
                accessibilityLabel="Voice Call"
                onPress={() => {
                  void startCall(
                    {
                      id: recipientId,
                      username: (params.username || 'user').replace(/^@/, ''),
                      displayName: recipientName,
                    },
                    'audio'
                  );
                }}
              />
              <IconButton
                name="camera-outline"
                size="md"
                color={theme.textInverse}
                accessibilityLabel="Take Photo with Camera"
                onPress={() => {
                  cameraInputRef.current?.click();
                }}
              />
              <IconButton
                name="ellipsis-horizontal"
                size="md"
                color={theme.textInverse}
                accessibilityLabel="Chat tools"
                onPress={() => { setToolMode('menu'); setToolsOpen(true); }}
              />
            </View>
          ),
        }}
      />

      {/* Snapchat-Style Screenshot Detection Banner */}
      {chatScreenshotAlert && (
        <View style={styles.chatScreenshotBanner}>
          <Ionicons name="camera" size={16} color="#FFFFFF" />
          <Text variant="caption" style={styles.chatScreenshotBannerText}>
            {chatScreenshotAlert}
          </Text>
        </View>
      )}

      {messages.some((message) => message.isPinned) && (
        <Pressable
          onPress={() => {
            const pinned = messages.find((message) => message.isPinned);
            if (pinned) flatListRef.current?.scrollToIndex({ index: messages.findIndex((m) => m.id === pinned.id), animated: true });
          }}
          style={styles.pinnedBanner}
        >
          <Ionicons name="pin" size={16} color={theme.primary} />
          <Text variant="caption" numberOfLines={1} style={styles.pinnedBannerText}>
            Pinned: {messages.find((message) => message.isPinned)?.content || 'Media message'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </Pressable>
      )}

      {/* Messages List Area */}
      {isLoadingHistory && messages.length === 0 ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text variant="caption" colorRole="secondary" style={{ marginTop: tokens.spacing.xs }}>
            Loading conversation...
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View
              style={[
                styles.encryptionBanner,
                {
                  backgroundColor: colorScheme === 'dark' ? '#182229' : '#FFEECD',
                  borderRadius: tokens.radii.md,
                  borderWidth: 0.5,
                  borderColor: colorScheme === 'dark' ? '#2A3942' : '#FFE08A',
                },
              ]}
            >
              <Ionicons
                name="lock-closed"
                size={13}
                color={colorScheme === 'dark' ? '#FFD279' : '#856404'}
              />
              <Text
                variant="caption"
                style={{
                  color: colorScheme === 'dark' ? '#FFD279' : '#664D03',
                  fontSize: 11,
                  textAlign: 'center',
                }}
              >
                Messages are private, end-to-end secured, and anchored to @{params.username || 'username'}. No phone numbers are involved.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyMessagesBox}>
              <Ionicons name="chatbubble-ellipses-outline" size={44} color={theme.textDisabled} />
              <Text variant="h3" align="center" style={{ marginTop: tokens.spacing.sm }}>
                No messages yet
              </Text>
              <Text variant="body" colorRole="secondary" align="center">
                Send a message to start chatting with {recipientName}!
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const cleanRecipientUser = (params.username || '').replace(/^@/, '');

            // Robust multi-identifier matching for sender vs receiver
            const isSent =
              (Boolean(user?.id) && item.senderId === user?.id) ||
              (Boolean(user?.username) && item.senderId === user?.username) ||
              (Boolean((user as any)?.firebaseUid) && item.senderId === (user as any)?.firebaseUid) ||
              (item.senderId !== recipientId && item.senderId !== cleanRecipientUser);

            return (
              <MessageBubble
                id={item.id}
                content={item.content}
                isSent={isSent}
                senderName={isSent ? undefined : recipientName}
                timestamp={formatMessageTime(item.createdAt)}
                status={item.status}
                type={item.type}
                mediaUrl={item.mediaUrl}
                metadata={item.metadata}
                editedAt={item.editedAt}
                isPinned={item.isPinned}
                onLongPress={() => {
                  setActiveMessage(item);
                  setEditDraft(item.content);
                  setIsEditingMessage(false);
                }}
                onMediaPress={(media) => {
                  setLightboxData({
                    url: media.url,
                    type: media.type,
                    metadata: media.metadata,
                    senderName: isSent ? 'You' : recipientName,
                    timestamp: formatMessageTime(item.createdAt),
                  });
                }}
              />
            );
          }}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
        />
      )}

      {undoMessage && (
        <View style={styles.undoBar}>
          <Text variant="body" style={styles.undoText}>Message deleted for you</Text>
          <Pressable onPress={() => void undoHideMessage()} style={styles.undoButton}>
            <Text variant="bodyMedium" style={styles.undoButtonText}>UNDO</Text>
          </Pressable>
        </View>
      )}

      {/* Typing Indicator */}
      {isRecipientTyping && (
        <View style={[styles.typingBanner, { backgroundColor: theme.surface }]}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text variant="caption" colorRole="primary" style={{ marginLeft: tokens.spacing.xs }}>
            {recipientName} is typing...
          </Text>
        </View>
      )}

      {/* Input Composer Bar */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.divider,
            paddingBottom: Math.max(insets.bottom, tokens.spacing.xs),
          },
        ]}
      >
        {/* Attachment Button for HD Photos & Videos */}
        <Pressable
          onPress={() => fileInputRef.current?.click()}
          style={styles.attachButton}
          accessibilityRole="button"
          accessibilityLabel="Attach Photo or Video"
        >
          <Ionicons name="attach-outline" size={24} color={theme.textSecondary} />
        </Pressable>

        {/* Camera Button: Directly opens phone camera viewfinder */}
        <Pressable
          onPress={() => cameraInputRef.current?.click()}
          style={styles.attachButton}
          accessibilityRole="button"
          accessibilityLabel="Take Photo with Camera"
        >
          <Ionicons name="camera-outline" size={24} color={theme.textSecondary} />
        </Pressable>

        {Platform.OS === 'web' && (
          <>
            <input
              ref={fileInputRef as any}
              type="file"
              accept="image/*,video/*,application/pdf"
              onChange={handleFileSelected}
              style={{ display: 'none' }}
            />
            <input
              ref={cameraInputRef as any}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelected}
              style={{ display: 'none' }}
            />
          </>
        )}

        <TextInputField
          placeholder="Type a message..."
          value={inputText}
          onChangeText={handleInputChange}
          onSubmitEditing={handleSend}
          containerStyle={styles.textInputWrapper}
          style={styles.textInputField}
        />

        <IconButton
          name={inputText.trim().length > 0 ? 'send' : 'mic'}
          variant="filled"
          size="md"
          accessibilityLabel={inputText.trim().length > 0 ? 'Send Message' : 'Voice Message'}
          onPress={handleSend}
        />
      </View>

      {/* Media Preview Modal with [ HD ] toggle */}
      <MediaPreviewModal
        visible={!!selectedMedia}
        media={selectedMedia}
        isUploading={isUploading}
        onClose={() => setSelectedMedia(null)}
        onSend={handleSendMedia}
      />

      {/* Fullscreen HD Media Lightbox */}
      <MediaLightboxModal
        visible={!!lightboxData}
        data={lightboxData}
        onClose={() => setLightboxData(null)}
      />

      <Modal visible={preferencesOpen} transparent animationType="fade" onRequestClose={() => setPreferencesOpen(false)}>
        <View style={styles.dialogBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: theme.surface }]}>
            <Text variant="h2">Disappearing messages</Text>
            <Text variant="caption" colorRole="secondary">New messages automatically expire after:</Text>
            {[
              { value: 0, label: 'Off' },
              { value: 86400, label: '24 hours' },
              { value: 604800, label: '7 days' },
              { value: 7776000, label: '90 days' },
            ].map((option) => (
              <Pressable key={option.value} onPress={() => void applyDisappearing(option.value)} style={styles.dialogOption}>
                <Text variant="body">{option.label}</Text>
                {disappearingSeconds === option.value && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
              </Pressable>
            ))}
            <Pressable onPress={() => setPreferencesOpen(false)} style={styles.dialogDismiss}><Text variant="bodyMedium" colorRole="primary">Close</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!activeMessage} transparent animationType="fade" onRequestClose={() => setActiveMessage(null)}>
        <View style={styles.dialogBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: theme.surface }]}>
            {isEditingMessage ? (
              <>
                <Text variant="h2">Edit message</Text>
                <TextInput value={editDraft} onChangeText={setEditDraft} multiline style={[styles.editInput, { color: theme.textPrimary, borderColor: theme.divider }]} />
                <View style={styles.dialogActions}>
                  <Pressable onPress={() => setIsEditingMessage(false)}><Text variant="bodyMedium" colorRole="secondary">Back</Text></Pressable>
                  <Pressable onPress={() => void handleEditMessage()}><Text variant="bodyMedium" colorRole="primary">Save</Text></Pressable>
                </View>
              </>
            ) : (
              <>
                <Text variant="h2">Message options</Text>
                {activeMessage && activeMessage.senderId === user?.id && Date.now() - Date.parse(activeMessage.createdAt) <= 15 * 60 * 1000 && activeMessage.type === 'text' && (
                  <Pressable onPress={() => { if (!activeMessage) return; setEditDraft(activeMessage.content); setIsEditingMessage(true); }} style={styles.dialogOption}>
                    <Text variant="body">Edit (15-minute limit)</Text><Ionicons name="create-outline" size={20} color={theme.primary} />
                  </Pressable>
                )}
                <Pressable onPress={() => void handlePinMessage()} style={styles.dialogOption}>
                  <Text variant="body">{activeMessage?.isPinned ? 'Unpin message' : 'Pin message'}</Text><Ionicons name="pin-outline" size={20} color={theme.primary} />
                </Pressable>
                <Pressable onPress={() => void handleHideMessage()} style={styles.dialogOption}>
                  <Text variant="body">Delete for me</Text><Ionicons name="trash-outline" size={20} color={theme.error} />
                </Pressable>
                <Pressable onPress={() => setActiveMessage(null)} style={styles.dialogDismiss}><Text variant="bodyMedium" colorRole="secondary">Cancel</Text></Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={toolsOpen} transparent animationType="fade" onRequestClose={() => setToolsOpen(false)}>
        <View style={styles.dialogBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: theme.surface }]}>
            {toolMode === 'menu' && (
              <>
                <Text variant="h2">Chat tools</Text>
                <Pressable onPress={() => { setToolsOpen(false); setPreferencesOpen(true); }} style={styles.dialogOption}><Text variant="body">Disappearing messages</Text><Ionicons name="timer-outline" size={20} color={theme.primary} /></Pressable>
                <Pressable onPress={() => setToolMode('schedule')} style={styles.dialogOption}><Text variant="body">Schedule a message</Text><Ionicons name="time-outline" size={20} color={theme.primary} /></Pressable>
                <Pressable onPress={() => setToolMode('expenses')} style={styles.dialogOption}><Text variant="body">Split an expense</Text><Ionicons name="wallet-outline" size={20} color={theme.primary} /></Pressable>
                <Pressable onPress={() => setToolMode('tasks')} style={styles.dialogOption}><Text variant="body">Notes and tasks</Text><Ionicons name="checkbox-outline" size={20} color={theme.primary} /></Pressable>
                <Pressable onPress={() => setToolsOpen(false)} style={styles.dialogDismiss}><Text variant="bodyMedium" colorRole="secondary">Close</Text></Pressable>
              </>
            )}
            {toolMode === 'schedule' && (
              <>
                <View style={styles.dialogTitleRow}>
                  <Pressable onPress={() => setToolMode('menu')}><Ionicons name="arrow-back" size={22} color={theme.textPrimary} /></Pressable>
                  <Text variant="h2">Schedule message</Text>
                </View>
                <TextInput value={scheduleDraft} onChangeText={setScheduleDraft} placeholder="Message" multiline style={[styles.editInput, { color: theme.textPrimary, borderColor: theme.divider }]} />
                <Text variant="caption" colorRole="secondary">Enter date and time, e.g. 2026-10-18 09:00</Text>
                <TextInput value={scheduleAt} onChangeText={setScheduleAt} placeholder="YYYY-MM-DD HH:mm" autoCapitalize="none" style={[styles.singleLineInput, { color: theme.textPrimary, borderColor: theme.divider }]} />
                <Pressable onPress={() => void handleScheduleMessage()} style={[styles.primaryAction, { backgroundColor: theme.primary }]}><Text variant="bodyMedium" colorRole="inverse">Schedule</Text></Pressable>
              </>
            )}
            {toolMode === 'expenses' && (
              <>
                <View style={styles.dialogTitleRow}>
                  <Pressable onPress={() => setToolMode('menu')}><Ionicons name="arrow-back" size={22} color={theme.textPrimary} /></Pressable>
                  <Text variant="h2">Split expense</Text>
                </View>
                <TextInput value={expenseTitle} onChangeText={setExpenseTitle} placeholder="What was paid for?" style={[styles.singleLineInput, { color: theme.textPrimary, borderColor: theme.divider }]} />
                <TextInput value={expenseAmount} onChangeText={setExpenseAmount} placeholder="Amount (INR)" keyboardType="decimal-pad" style={[styles.singleLineInput, { color: theme.textPrimary, borderColor: theme.divider }]} />
                <Text variant="caption" colorRole="secondary">Paid by you • split equally between you and {recipientName}</Text>
                <Pressable onPress={() => void handleCreateExpense()} style={[styles.primaryAction, { backgroundColor: theme.primary }]}><Text variant="bodyMedium" colorRole="inverse">Add expense</Text></Pressable>
                <FlatList
                  data={expenses}
                  keyExtractor={(item) => item.id}
                  style={styles.toolList}
                  ListEmptyComponent={<Text variant="caption" colorRole="secondary">No expenses yet.</Text>}
                  renderItem={({ item }) => <Text variant="caption" style={styles.toolListItem}>{item.title} • ₹{item.amount.toFixed(2)} • ₹{(item.amount / Math.max(1, item.splitBetween.length)).toFixed(2)} each</Text>}
                />
              </>
            )}
            {toolMode === 'tasks' && (
              <>
                <View style={styles.dialogTitleRow}>
                  <Pressable onPress={() => setToolMode('menu')}><Ionicons name="arrow-back" size={22} color={theme.textPrimary} /></Pressable>
                  <Text variant="h2">Notes and tasks</Text>
                </View>
                <TextInput value={taskTitle} onChangeText={setTaskTitle} placeholder="Task title" style={[styles.singleLineInput, { color: theme.textPrimary, borderColor: theme.divider }]} />
                <TextInput value={taskBody} onChangeText={setTaskBody} placeholder="Notes or details (optional)" multiline style={[styles.editInput, { color: theme.textPrimary, borderColor: theme.divider }]} />
                <View style={styles.dialogTitleRow}>
                  <Pressable onPress={() => setAssignTaskToPeer(false)} style={[styles.assignChoice, !assignTaskToPeer && { backgroundColor: theme.primary }]}><Text variant="caption" colorRole={!assignTaskToPeer ? 'inverse' : 'secondary'}>Assign to me</Text></Pressable>
                  <Pressable onPress={() => setAssignTaskToPeer(true)} style={[styles.assignChoice, assignTaskToPeer && { backgroundColor: theme.primary }]}><Text variant="caption" colorRole={assignTaskToPeer ? 'inverse' : 'secondary'}>Assign to {recipientName}</Text></Pressable>
                </View>
                <Pressable onPress={() => void handleCreateTask()} style={[styles.primaryAction, { backgroundColor: theme.primary }]}><Text variant="bodyMedium" colorRole="inverse">Add task</Text></Pressable>
                <FlatList
                  data={tasks}
                  keyExtractor={(item) => item.id}
                  style={styles.toolList}
                  ListEmptyComponent={<Text variant="caption" colorRole="secondary">No tasks or notes yet.</Text>}
                  renderItem={({ item }) => (
                    <Pressable onPress={() => void toggleTask(item)} style={styles.taskRow}>
                      <Ionicons name={item.completedAt ? 'checkbox' : 'square-outline'} size={20} color={theme.primary} />
                      <View style={{ flex: 1 }}>
                        <Text variant="body" style={item.completedAt ? styles.completedTask : undefined}>{item.title}</Text>
                        {!!item.body && <Text variant="caption" colorRole="secondary">{item.body}</Text>}
                        <Text variant="caption" colorRole="disabled">Assigned to {item.assignedTo === user?.id ? 'you' : recipientName}</Text>
                      </View>
                    </Pressable>
                  )}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  headerTextCol: {
    justifyContent: 'center',
    maxWidth: 180,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesList: {
    paddingVertical: tokens.spacing.sm,
  },
  encryptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    marginHorizontal: tokens.spacing.lg,
    marginVertical: tokens.spacing.sm,
    gap: tokens.spacing.xs,
    maxWidth: '92%',
  },
  emptyMessagesBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.xxxl,
    paddingHorizontal: tokens.spacing.xl,
    gap: tokens.spacing.xs,
  },
  typingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xxs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderTopWidth: 1,
    gap: tokens.spacing.xs,
    width: '100%',
  },
  textInputWrapper: {
    flex: 1,
    width: undefined,
  },
  textInputField: {
    fontSize: tokens.typography.body.fontSize, // 16px minimum to avoid iOS zoom
  },
  attachButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatScreenshotBanner: {
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
  chatScreenshotBannerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    flex: 1,
  },
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    marginHorizontal: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
    borderRadius: tokens.radii.md,
    backgroundColor: '#E6F4EA',
  },
  pinnedBannerText: { flex: 1, color: '#164D3D' },
  undoBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: '#263238',
  },
  undoText: { color: '#FFFFFF' },
  undoButton: { paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.xs },
  undoButtonText: { color: '#80CBC4', fontWeight: '700' },
  dialogBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  dialogCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.sm,
  },
  dialogOption: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D8DEE3',
  },
  dialogDismiss: { alignSelf: 'flex-end', paddingTop: tokens.spacing.sm, paddingHorizontal: tokens.spacing.sm },
  dialogActions: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: tokens.spacing.sm },
  editInput: { minHeight: 100, borderWidth: 1, borderRadius: tokens.radii.sm, padding: tokens.spacing.sm, textAlignVertical: 'top' },
  singleLineInput: { minHeight: 46, borderWidth: 1, borderRadius: tokens.radii.sm, paddingHorizontal: tokens.spacing.sm },
  dialogTitleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  primaryAction: { minHeight: 44, borderRadius: tokens.radii.pill, justifyContent: 'center', alignItems: 'center', paddingHorizontal: tokens.spacing.md },
  toolList: { maxHeight: 180 },
  toolListItem: { paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D8DEE3' },
  taskRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 8 },
  assignChoice: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: tokens.radii.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D8DEE3' },
  completedTask: { textDecorationLine: 'line-through', color: '#8696A0' },
});
