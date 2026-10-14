/**
 * @file Ambient type declarations for Expo environment variables.
 */

declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_API_URL?: string;
    readonly EXPO_PUBLIC_SOCKET_URL?: string;
    readonly EXPO_PUBLIC_SUPABASE_URL?: string;
    readonly EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    readonly EXPO_PUBLIC_FIREBASE_API_KEY?: string;
    readonly EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?: string;
    readonly EXPO_PUBLIC_FIREBASE_PROJECT_ID?: string;
  }
}
