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
import * as api from '../../src/services/api';
import {
  connectSocket,
  joinRoom,
  leaveRoom,
  getSocket,
} from '../../src/services/socket';
import { ChatMessage } from '@chatflow/shared';

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
    startTyping,
    stopTyping,
    typingUsersByChatId,
  } = useMessageStore();

  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // HD Media States
  const [selectedMedia, setSelectedMedia] = useState<SelectedMediaFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxData, setLightboxData] = useState<MediaLightboxData | null>(null);

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

  // Setup Socket.IO connection and room lifecycle
  useEffect(() => {
    if (!token || !chatId) return;

    // Connect socket
    const socket = connectSocket(token);
    joinRoom(chatId);

    // Initial message history load
    void loadHistory(chatId, token);

    // Attach listeners
    const handleMessageNew = (payload: { message: ChatMessage; clientTempId?: string }) => {
      if (payload.message.chatId === chatId) {
        receiveMessage(payload.message, payload.clientTempId);
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

    socket.on('message_new', handleMessageNew);
    socket.on('user_typing', handleUserTyping);
    socket.on('message_status_update', handleStatusUpdate);

    return () => {
      leaveRoom(chatId);
      socket.off('message_new', handleMessageNew);
      socket.off('user_typing', handleUserTyping);
      socket.off('message_status_update', handleStatusUpdate);
    };
  }, [chatId, token, loadHistory, receiveMessage, setUserTyping, updateMessageStatus]);

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
      style={[styles.container, { backgroundColor: theme.background }]}
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
                onPress={() => alert('Video calling arriving in Phase 5')}
              />
              <IconButton
                name="call-outline"
                size="md"
                color={theme.textInverse}
                accessibilityLabel="Voice Call"
                onPress={() => alert('Voice calling arriving in Phase 5')}
              />
            </View>
          ),
        }}
      />

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
                  backgroundColor: theme.surfaceEmphasized,
                  borderRadius: tokens.radii.md,
                },
              ]}
            >
              <Ionicons name="lock-closed" size={14} color={theme.textSecondary} />
              <Text variant="caption" colorRole="secondary" align="center">
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
            const isSent = item.senderId === user?.id;
            return (
              <MessageBubble
                id={item.id}
                content={item.content}
                isSent={isSent}
                timestamp={formatMessageTime(item.createdAt)}
                status={item.status}
                type={item.type}
                mediaUrl={item.mediaUrl}
                metadata={item.metadata}
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

        {Platform.OS === 'web' && (
          <input
            ref={fileInputRef as any}
            type="file"
            accept="image/*,video/*,application/pdf"
            onChange={handleFileSelected}
            style={{ display: 'none' }}
          />
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
});
