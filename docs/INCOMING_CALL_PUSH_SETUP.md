# Incoming call push notifications

ChatFlow now registers native device push tokens, sends a high-priority Expo push when a call starts, and retrieves the short-lived WebRTC offer when the recipient taps the notification.

## One-time setup

1. In Firebase Console, add an **Android app** to the existing project with package name `com.chatflow.app`. Download its `google-services.json` file.
2. Create/link an Expo EAS project for this app and copy its project ID. Set a GitHub repository variable named `EXPO_PROJECT_ID` to that ID.
3. Add the Firebase Android configuration to GitHub Actions without committing it:
   - In PowerShell, encode the downloaded file with `[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\path\to\google-services.json'))`.
   - Save that output as a GitHub Actions repository secret named `GOOGLE_SERVICES_JSON_BASE64`.
4. In Expo's project credentials, add the Firebase **FCM V1 service account** for Android push delivery. Expo's push service needs this credential to deliver Android notifications.
5. In Supabase SQL Editor, run `supabase/migrations/20261017110000_incoming_call_push.sql`.
6. Deploy the updated server to EC2. Then create a new APK with the GitHub **Build Android APK** workflow. For `backend_url`, use `https://chatflow-arjun.duckdns.org`.
7. Install that new APK, sign in, and allow notifications. Place the app in the background and call it from another signed-in account.

The push uses Android's incoming-call notification channel and opens the in-app incoming-call screen when tapped. Android notification permission must remain enabled. Push delivery is best effort and may be delayed or suppressed by Android battery restrictions or force-stop behavior.

## Current native sign-in limitation

The current Google sign-in implementation in `apps/mobile/src/services/firebase.ts` is browser-only. Before the full APK call flow can be tested, native Android Google sign-in must be implemented/configured for the Firebase Android app. The push work does not change the existing sign-in flow.
