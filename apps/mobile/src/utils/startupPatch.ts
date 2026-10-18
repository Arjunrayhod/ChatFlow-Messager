/**
 * @file startupPatch.ts
 * Critical runtime patches to guarantee rock-solid Android/iOS startup:
 * 1. Suppresses unhandled promise rejections so they never crash the Android native process.
 * 2. Monkey-patches Font.isLoaded so that missing native fonts or Hermes module mismatches
 *    return false instead of throwing "TypeError: undefined is not a function".
 * 3. Initializes ExpoFontLoader.customNativeFonts to [] if not already an Array.
 */

import { Platform } from 'react-native';
import * as Font from 'expo-font';

// 1. Prevent unhandled rejections from killing native Android process
if (typeof global !== 'undefined') {
  const originalRejection = (global as any).onunhandledrejection;
  (global as any).onunhandledrejection = (event: any) => {
    console.warn('[Global] Suppressed unhandled rejection:', event?.reason || event);
    if (typeof originalRejection === 'function') {
      try {
        originalRejection(event);
      } catch {}
    }
  };
}

// 2. Safe guard ExpoFontLoader native module
try {
  const { requireNativeModule } = require('expo-modules-core');
  if (typeof requireNativeModule === 'function') {
    const ExpoFontLoader = requireNativeModule('ExpoFontLoader');
    if (ExpoFontLoader && !Array.isArray(ExpoFontLoader.customNativeFonts)) {
      ExpoFontLoader.customNativeFonts = [];
    }
  }
} catch {
  // Safe fallback if expo-modules-core is not directly available
}

// 3. Monkey-patch Font.isLoaded to guarantee it NEVER throws "undefined is not a function"
if (typeof Font !== 'undefined') {
  const originalIsLoaded = Font.isLoaded;
  (Font as any).isLoaded = (fontFamily: string): boolean => {
    try {
      if (typeof originalIsLoaded === 'function') {
        return originalIsLoaded(fontFamily);
      }
    } catch (err) {
      console.warn('[FontPatch] Font.isLoaded caught error safely:', err);
    }
    return false;
  };
}

export const startupPatchApplied = true;
