import React from 'react';
import { RTCView, type MediaStream } from 'react-native-webrtc';
import type { CallVideoPlayerProps } from './CallVideoPlayer.web';

export default function CallVideoPlayer({ stream, isMirrored = false, style }: CallVideoPlayerProps) {
  if (!stream) return null;
  return <RTCView streamURL={(stream as any).toURL()} mirror={isMirrored} objectFit="cover" style={[{ width: '100%', height: '100%', backgroundColor: '#000' }, style]} />;
}
