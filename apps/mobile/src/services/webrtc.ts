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
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceCandidatePoolSize: 10,
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
      this.stopLocalMedia();

      const isMobile =
        typeof navigator !== 'undefined' &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');

      // On mobile use facingMode; on desktop PC NEVER use facingMode because Windows/PC webcams do not have it!
      const videoConstraints: MediaTrackConstraints | boolean =
        type === 'video'
          ? isMobile
            ? { facingMode: this.currentFacing }
            : { width: { ideal: 1280 }, height: { ideal: 720 } }
          : false;

      let stream: MediaStream | null = null;

      // Tier 1: Try combined audio + video with standard constraints
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: videoConstraints,
        });
      } catch (tier1Err) {
        console.warn('[WebRTCService] Tier 1 getUserMedia failed, trying relaxed constraints:', tier1Err);

        // Tier 2: Try basic boolean constraints { audio: true, video: true }
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: type === 'video',
          });
        } catch (tier2Err) {
          console.warn('[WebRTCService] Tier 2 getUserMedia failed, attempting split track acquisition:', tier2Err);

          // Tier 3: Acquire audio track and video track independently (e.g. if one device fails constraints)
          let audioTrack: MediaStreamTrack | null = null;
          let videoTrack: MediaStreamTrack | null = null;

          try {
            const aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioTrack = aStream.getAudioTracks()[0] || null;
          } catch (aErr) {
            console.warn('[WebRTCService] Audio capture failed:', aErr);
          }

          if (type === 'video') {
            try {
              const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
              videoTrack = vStream.getVideoTracks()[0] || null;
            } catch (vErr) {
              console.warn('[WebRTCService] Video capture failed:', vErr);
            }
          }

          const combinedTracks: MediaStreamTrack[] = [];
          if (audioTrack) combinedTracks.push(audioTrack);
          if (videoTrack) combinedTracks.push(videoTrack);

          if (combinedTracks.length > 0) {
            stream = new MediaStream(combinedTracks);
          }
        }
      }

      if (stream) {
        stream.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
        stream.getVideoTracks().forEach((track) => {
          track.enabled = true;
        });
        this.localStream = stream;
        return stream;
      }

      return null;
    } catch (err) {
      console.warn('[WebRTCService] getLocalMedia completely failed:', err);
      return null;
    }
  }

  /**
   * Initializes RTCPeerConnection with listeners and attaches local stream tracks.
   */
  /**
   * Initializes RTCPeerConnection with listeners and attaches local stream tracks.
   * NOTE: We preserve candidateQueue so candidates received before user taps 'Accept' are NOT wiped!
   */
  initPeerConnection(
    onRemoteStream: (stream: MediaStream) => void,
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    onConnectionState?: (state: RTCPeerConnectionState) => void
  ): RTCPeerConnection | null {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !('RTCPeerConnection' in window)) {
      return null;
    }

    // Close any previous connection instance if still open, but preserve candidateQueue for this call
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      (this.pc as any).oniceconnectionstatechange = null;
      try {
        this.pc.close();
      } catch {
        // ignore
      }
      this.pc = null;
    }

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
      console.log('[WebRTCService] ontrack received track kind:', event.track.kind);
      // Ensure incoming audio/video track is enabled
      event.track.enabled = true;

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
        const candidatePayload = event.candidate.toJSON
          ? event.candidate.toJSON()
          : {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              usernameFragment: event.candidate.usernameFragment,
            };
        this.onIceCandidateCallback?.(candidatePayload as any);
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      console.log('[WebRTCService] pc.connectionState:', pc.connectionState);
      this.onConnectionStateCallback?.(pc.connectionState);
    };

    // ICE Connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTCService] pc.iceConnectionState:', pc.iceConnectionState);
    };

    return pc;
  }

  /**
   * Helper to get or create remote audio playback DOM element.
   * Avoids display: 'none' which triggers mobile browser audio throttling.
   */
  private getOrCreateAudioElement(): HTMLAudioElement | null {
    if (typeof document === 'undefined') return null;
    if (!this.remoteAudio) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      (audio as any).playsInline = true;
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('autoplay', 'true');
      // Position offscreen instead of display: none to guarantee audio engine keeps running
      audio.style.position = 'fixed';
      audio.style.top = '-9999px';
      audio.style.left = '-9999px';
      audio.style.width = '1px';
      audio.style.height = '1px';
      audio.style.opacity = '0.01';
      audio.style.pointerEvents = 'none';
      document.body.appendChild(audio);
      this.remoteAudio = audio;
    }
    return this.remoteAudio;
  }

  /**
   * Mobile browsers (iOS Safari, Chrome Android) require a user gesture to unlock Web Audio playback.
   * Call this on "Start Call" or "Answer Call" press.
   */
  unlockAudio() {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      const audio = this.getOrCreateAudioElement();
      if (audio) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // normal if empty src
          });
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Plays remote audio stream through dedicated audio element.
   */
  private playRemoteAudio(stream: MediaStream) {
    if (typeof document === 'undefined') return;
    try {
      const audio = this.getOrCreateAudioElement();
      if (!audio) return;

      // Ensure all audio tracks are active
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });

      audio.srcObject = stream;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('[WebRTCService] playRemoteAudio playback active');
          })
          .catch((err) => {
            console.warn('[WebRTCService] playRemoteAudio autoplay blocked or delayed:', err);
          });
      }
    } catch (err) {
      console.warn('[WebRTCService] playRemoteAudio error:', err);
    }
  }

  /**
   * Creates an SDP offer for initiating a call with Unified Plan transceivers.
   */
  async createOffer(callType: 'audio' | 'video' = 'video'): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) return null;
    try {
      // Modern WebRTC Unified Plan: Guarantee audio transceiver
      const senders = this.pc.getSenders();
      const hasAudio = senders.some((s) => s.track?.kind === 'audio');
      if (!hasAudio) {
        try {
          this.pc.addTransceiver('audio', { direction: 'sendrecv' });
        } catch {}
      }

      // Guarantee video transceiver for video calls
      if (callType === 'video') {
        const hasVideo = senders.some((s) => s.track?.kind === 'video');
        if (!hasVideo) {
          try {
            this.pc.addTransceiver('video', { direction: 'sendrecv' });
          } catch {}
        }
      }

      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video',
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
  async addIceCandidate(candidate: any): Promise<void> {
    if (!candidate) return;

    // Normalize candidate object in case serialized in varying forms
    const rawCandidate =
      candidate.candidate !== undefined
        ? candidate
        : candidate.candidateInit
        ? candidate.candidateInit
        : candidate;

    // Guard against empty candidate strings (browsers send candidate: "" on ICE completion)
    if (!rawCandidate || rawCandidate.candidate === '' || rawCandidate.candidate === null) {
      return;
    }

    if (!this.pc || !this.pc.remoteDescription || !this.pc.remoteDescription.type) {
      console.log('[WebRTCService] Remote description not set yet, queuing candidate');
      this.candidateQueue.push(rawCandidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(rawCandidate));
      console.log('[WebRTCService] Added ICE candidate successfully');
    } catch (err) {
      console.warn('[WebRTCService] addIceCandidate failed:', err);
    }
  }

  /**
   * Flushes queued ICE candidates after remote description is established.
   */
  private async processCandidateQueue(): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription) return;
    console.log(`[WebRTCService] Flushing candidate queue (${this.candidateQueue.length} candidates)`);
    while (this.candidateQueue.length > 0) {
      const candidate = this.candidateQueue.shift();
      if (candidate && candidate.candidate !== '' && candidate.candidate !== null) {
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
   * Cleans up RTCPeerConnection and releases active media listeners.
   */
  cleanupPeerConnection() {
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      (this.pc as any).oniceconnectionstatechange = null;
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
    this.remoteStream = null;
  }

  /**
   * Full reset and cleanup for end of call.
   */
  destroy() {
    this.stopLocalMedia();
    this.cleanupPeerConnection();
    this.candidateQueue = [];
  }
}

export const webrtcService = new WebRTCService();
