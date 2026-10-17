import React, { useEffect, useRef } from 'react';

export interface CallVideoPlayerProps {
  stream: MediaStream | null;
  isMuted?: boolean;
  isMirrored?: boolean;
  style?: any;
}

export default function CallVideoPlayer({ stream, isMuted = false, isMirrored = false, style }: CallVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    const attach = () => {
      if (!stream) return;
      element.srcObject = stream;
      element.muted = isMuted;
      void element.play().catch((error) => console.warn('[CallVideoPlayer] Playback failed:', error));
    };
    attach();
    stream?.addEventListener('addtrack', attach);
    return () => stream?.removeEventListener('addtrack', attach);
  }, [stream, isMuted]);
  return <video ref={videoRef} autoPlay playsInline muted={isMuted} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: isMirrored ? 'scaleX(-1)' : 'none', backgroundColor: '#000', ...style }} />;
}
