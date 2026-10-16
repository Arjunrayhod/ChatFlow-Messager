/**
 * @file WebRTC Peer Connection and Media Stream Service (Phase 5).
 * Cross-platform audio/video streaming abstraction for web & mobile.
 * 
 * [HINGLISH GUIDE]:
 * Yeh WebRTC Service hai jo live audio aur video call establish karti hai:
 * 1. RTCPeerConnection initialize karti hai (Google STUN servers ke sath).
 * 2. Microphone aur Camera ka local stream capture karti hai (getUserMedia).
 * 3. Offer create karna, Answer create karna, aur ICE Candidates exchange karna.
 * 4. Automatic ICE candidate queuing jab remote description pending ho.
 * 5. Dedicated remote audio playback taaki Voice aur Video calls me audio crystal clear aaye.
 * 6. Mic mute/unmute, Camera on/off, aur Front/Back camera flip support karti hai.
 * 7. Call end hone par tracks aur peer connection ko clean up karti hai.
 */

import { Platform } from 'react-native';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

export class WebRTCService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentFacing: 'user' | 'environment' = 'user';
  private remoteAudio: HTMLAudioElement | null = null;
  private candidateQueue: RTCIceCandidateInit[] = [];

  private onRemoteStreamCallback?: (stream: MediaStream) => void;
  private onIceCandidateCallback?: (candidate: RTCIceCandidate) => void;
  private onConnectionStateCallback?: (state: RTCPeerConnectionState) => void;

  constructor() {
    // Service ready
  }

  /**
   * Initializes local media stream (Microphone & Camera).
   */
  async getLocalMedia(type: 'audio' | 'video'): Promise<MediaStream | null> {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      console.warn('[WebRTCService] navigator.mediaDevices unavailable (requires secure context or localhost)');
      return null;
    }

    try {
      // Release any lingering streams before requesting fresh device handles
      this.stopLocalMedia();

      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video:
          type === 'video'
            ? {
                facingMode: this.currentFacing,
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : false,
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        stream.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
        this.localStream = stream;
        return stream;
      } catch (advancedErr) {
        console.warn('[WebRTCService] Advanced getUserMedia failed, trying relaxed constraints:', advancedErr);
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === 'video',
        });
        fallbackStream.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
        this.localStream = fallbackStream;
        return fallbackStream;
      }
    } catch (err) {
      console.warn('[WebRTCService] getUserMedia completely failed or permission denied:', err);
      if (type === 'video') {
        try {
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioOnlyStream.getAudioTracks().forEach((track) => {
            track.enabled = true;
          });
          this.localStream = audioOnlyStream;
          return audioOnlyStream;
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  /**
   * Initializes RTCPeerConnection with listeners and attaches local stream tracks.
   */
  initPeerConnection(
    onRemoteStream: (stream: MediaStream) => void,
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    onConnectionState?: (state: RTCPeerConnectionState) => void
  ): RTCPeerConnection | null {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !('RTCPeerConnection' in window)) {
      return null;
    }

    this.cleanupPeerConnection();

    this.onRemoteStreamCallback = onRemoteStream;
    this.onIceCandidateCallback = onIceCandidate;
    this.onConnectionStateCallback = onConnectionState;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.pc = pc;

    // Attach local stream tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Remote track listener
    pc.ontrack = (event) => {
      console.log('[WebRTCService] ontrack received track:', event.track.kind);
      let stream = event.streams[0];
      if (!stream) {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
        stream = this.remoteStream;
      } else {
        this.remoteStream = stream;
      }

      this.playRemoteAudio(stream);
      this.onRemoteStreamCallback?.(stream);
    };

    // ICE Candidate generation listener
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidateCallback?.(event.candidate);
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      console.log('[WebRTCService] pc.connectionState:', pc.connectionState);
      this.onConnectionStateCallback?.(pc.connectionState);
    };

    return pc;
  }

  /**
   * Plays remote audio stream through dedicated audio element.
   */
  private playRemoteAudio(stream: MediaStream) {
    if (typeof document === 'undefined') return;
    try {
      if (!this.remoteAudio) {
        this.remoteAudio = document.createElement('audio');
        this.remoteAudio.autoplay = true;
        (this.remoteAudio as any).playsInline = true;
        this.remoteAudio.setAttribute('playsinline', 'true');
        this.remoteAudio.setAttribute('autoplay', 'true');
        this.remoteAudio.style.display = 'none';
        document.body.appendChild(this.remoteAudio);
      }
      this.remoteAudio.srcObject = stream;
      this.remoteAudio.play().catch((err) => {
        console.warn('[WebRTCService] playRemoteAudio autoplay blocked or delayed:', err);
      });
    } catch (err) {
      console.warn('[WebRTCService] playRemoteAudio error:', err);
    }
  }

  /**
   * Creates an SDP offer for initiating a call.
   */
  async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) return null;
    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await this.pc.setLocalDescription(offer);
      return offer;
    } catch (err) {
      console.warn('[WebRTCService] createOffer failed:', err);
      return null;
    }
  }

  /**
   * Sets remote offer and creates an SDP answer.
   */
  async createAnswer(remoteOffer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) return null;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(remoteOffer));
      await this.processCandidateQueue();
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      return answer;
    } catch (err) {
      console.warn('[WebRTCService] createAnswer failed:', err);
      return null;
    }
  }

  /**
   * Sets remote answer received from recipient.
   */
  async setRemoteAnswer(remoteAnswer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) return;
    try {
      if (this.pc.signalingState !== 'stable') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
        await this.processCandidateQueue();
      }
    } catch (err) {
      console.warn('[WebRTCService] setRemoteAnswer failed:', err);
    }
  }

  /**
   * Adds an ICE candidate received from peer, with queuing if remote description is pending.
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription || !this.pc.remoteDescription.type) {
      this.candidateQueue.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[WebRTCService] addIceCandidate failed:', err);
    }
  }

  /**
   * Flushes queued ICE candidates after remote description is established.
   */
  private async processCandidateQueue(): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription) return;
    while (this.candidateQueue.length > 0) {
      const candidate = this.candidateQueue.shift();
      if (candidate) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('[WebRTCService] Queued candidate add error:', err);
        }
      }
    }
  }

  /**
   * Toggles microphone audio mute state. Returns true if unmuted, false if muted.
   */
  toggleAudio(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return audioTrack.enabled;
    }
    return false;
  }

  /**
   * Toggles camera video track state. Returns true if camera is on, false if off.
   */
  toggleVideo(): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  }

  /**
   * Switches front / back camera on mobile or multi-camera setups.
   */
  async switchCamera(): Promise<MediaStream | null> {
    if (Platform.OS !== 'web' || !navigator.mediaDevices) return null;
    try {
      this.currentFacing = this.currentFacing === 'user' ? 'environment' : 'user';

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.currentFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (this.pc && newVideoTrack) {
        const senders = this.pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
        }

        // Replace track in localStream
        if (this.localStream) {
          const oldVideo = this.localStream.getVideoTracks()[0];
          if (oldVideo) {
            oldVideo.stop();
            this.localStream.removeTrack(oldVideo);
          }
          this.localStream.addTrack(newVideoTrack);
        }
      }

      return this.localStream;
    } catch (err) {
      console.warn('[WebRTCService] switchCamera failed:', err);
      return null;
    }
  }

  /**
   * Stops local audio and video media tracks.
   */
  stopLocalMedia() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  /**
   * Cleans up RTCPeerConnection and releases all resources.
   */
  cleanupPeerConnection() {
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      try {
        this.pc.close();
      } catch {
        // ignore
      }
      this.pc = null;
    }
    if (this.remoteAudio) {
      try {
        this.remoteAudio.pause();
        this.remoteAudio.srcObject = null;
      } catch {
        // ignore
      }
    }
    this.candidateQueue = [];
    this.remoteStream = null;
  }

  /**
   * Full reset and cleanup for end of call.
   */
  destroy() {
    this.stopLocalMedia();
    this.cleanupPeerConnection();
  }
}

export const webrtcService = new WebRTCService();
