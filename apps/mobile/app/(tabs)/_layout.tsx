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

import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { useColorScheme, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../src/theme/tokens';
import { Text } from '../../src/components/atoms/Text';

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  return (
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
          <Pressable
            onPress={() => router.push('/')}
            style={{
              paddingHorizontal: tokens.spacing.md,
              minWidth: tokens.spacing.huge,
              minHeight: tokens.spacing.huge,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel="Gateway and Account info"
          >
            <Ionicons name="person-circle-outline" size={28} color={theme.textInverse} />
          </Pressable>
        ),
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.divider,
          height: 60,
          paddingBottom: tokens.spacing.xs,
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
  );
}
