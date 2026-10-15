/**
 * @file Expo Router root layout with theme tokens and safe area wrappers.
 * 
 * [HINGLISH GUIDE]:
 * Yeh poori mobile/web app ka ROOT LAYOUT hai.
 * 1. SafeAreaProvider: Mobile ki notch aur bottom navigation bar se content bachata hai.
 * 2. Theme: User ke system setting ke hisaab se automatic Dark/Light mode set karta hai.
 * 3. Stack Navigation: Expo Router ka stack navigator yahan configure hota hai.
 */

import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tokens } from '../src/theme/tokens';

/**
 * Root application navigation stack layout.
 * [HINGLISH]: Root stack screens aur unke header styles define karta hai.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  // [HINGLISH]: Web par zoom, pinch aur double-tap zoom rokne ke liye event listeners
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
      // 0. Update viewport meta tag dynamically to enforce user-scalable=no
      try {
        let meta = document.querySelector('meta[name="viewport"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', 'viewport');
          document.head.appendChild(meta);
        }
        meta.setAttribute(
          'content',
          'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no, viewport-fit=cover'
        );

        // Inject anti-zoom CSS styles
        const styleId = 'chatflow-anti-zoom';
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.innerHTML = `
            html, body {
              touch-action: pan-x pan-y !important;
              -webkit-touch-callout: none !important;
              -webkit-text-size-adjust: 100% !important;
              overscroll-behavior: none !important;
              user-select: none !important;
              -webkit-user-select: none !important;
            }
            input, textarea {
              user-select: text !important;
              -webkit-user-select: text !important;
              font-size: 16px !important;
              touch-action: manipulation !important;
            }
            button {
              touch-action: manipulation !important;
            }
          `;
          document.head.appendChild(style);
        }
      } catch {
        // Fallthrough in SSR
      }

      // 1. Prevent Ctrl/Cmd + MouseWheel zoom
      const handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
        }
      };

      // 2. Prevent Ctrl + '+', '-', '0' keyboard zoom
      const handleKeyDown = (e: KeyboardEvent) => {
        if (
          (e.ctrlKey || e.metaKey) &&
          (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')
        ) {
          e.preventDefault();
        }
      };

      // 3. Prevent Safari / iOS gesture zoom
      const preventGesture = (e: Event) => {
        e.preventDefault();
      };

      // 4. Prevent double-tap zoom on touch screens
      let lastTouchEnd = 0;
      const handleTouchEnd = (e: TouchEvent) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      };

      window.addEventListener('wheel', handleWheel, { passive: false });
      window.addEventListener('keydown', handleKeyDown);
      document.addEventListener('gesturestart', preventGesture, { passive: false });
      document.addEventListener('gesturechange', preventGesture, { passive: false });
      document.addEventListener('gestureend', preventGesture, { passive: false });
      document.addEventListener('touchend', handleTouchEnd, { passive: false });

      return () => {
        window.removeEventListener('wheel', handleWheel);
        window.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('gesturestart', preventGesture);
        document.removeEventListener('gesturechange', preventGesture);
        document.removeEventListener('gestureend', preventGesture);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.surface,
          },
          headerTintColor: theme.textPrimary,
          headerTitleStyle: {
            ...tokens.typography.h2,
          },
          contentStyle: {
            backgroundColor: theme.background,
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'ChatFlow Gateway',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(auth)"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="chat/[id]"
          options={{
            headerShown: true,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
