/**
 * @file Tabs navigation layout for ChatFlow.
 * Handles primary navigation across Chats, Status, and Calls tabs.
 * Strict compliance with RULE 0.7 (Design tokens).
 * 
 * [HINGLISH GUIDE]:
 * Yeh ChatFlow ka main Tab Navigator hai:
 * 1. Chats Tab: Main inbox jaha active conversations list hoti hain
 * 2. Status Tab: WhatsApp-style status updates
 * 3. Calls Tab: Voice aur video calls history
 */

import React, { useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { useColorScheme, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../src/theme/tokens';
import { Text } from '../../src/components/atoms/Text';
import { SettingsModal } from '../../src/components/molecules/SettingsModal';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.primary,
          },
          headerTintColor: theme.textInverse,
          headerTitleStyle: {
            ...tokens.typography.h1,
            color: theme.textInverse,
          },
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: tokens.spacing.xs }}>
              <Pressable
                onPress={() => setIsSettingsOpen(true)}
                style={{
                  paddingHorizontal: tokens.spacing.xs,
                  minWidth: tokens.spacing.huge,
                  minHeight: tokens.spacing.huge,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                accessibilityRole="button"
                accessibilityLabel="Settings and Profile"
              >
                <Ionicons name="ellipsis-vertical" size={22} color={theme.textInverse} />
              </Pressable>
            </View>
          ),
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.divider,
          height: 60 + Math.max(insets.bottom, 0),
          paddingBottom: Math.max(insets.bottom, tokens.spacing.xs),
          paddingTop: tokens.spacing.xs,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: {
          ...tokens.typography.caption,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          headerTitle: 'ChatFlow',
          tabBarLabel: 'Chats',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="status"
        options={{
          title: 'Status',
          headerTitle: 'Status Updates',
          tabBarLabel: 'Status',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="radio-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: 'Calls',
          headerTitle: 'Recent Calls',
          tabBarLabel: 'Calls',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="call-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>

    <SettingsModal
      visible={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
    />
  </>
);
}
