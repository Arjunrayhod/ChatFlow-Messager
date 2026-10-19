import { Platform } from 'react-native';
import type { WebRTCService } from './webrtc.web';

// Dynamically select the platform implementation:
// On Android and iOS, use react-native-webrtc (native drivers).
// On Web, use standard browser MediaDevices and RTCPeerConnection.
export const webrtcService: WebRTCService =
  Platform.OS === 'web'
    ? require('./webrtc.web').webrtcService
    : require('./webrtc.native').webrtcService;


