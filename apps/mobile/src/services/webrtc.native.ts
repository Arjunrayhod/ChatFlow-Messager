import {
  mediaDevices,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
} from 'react-native-webrtc';
import { fetchCallIceServers, type CallIceServer } from './callIce';

let iceServers: CallIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

/** Native WebRTC media, audio routing, and peer connection for Android/iOS builds. */
class WebRTCService {
  private pc: any = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private candidateQueue: any[] = [];
  private onRemoteStream?: (stream: MediaStream) => void;
  private onIceCandidate?: (candidate: any) => void;
  private onConnectionState?: (state: any) => void;

  async configureIceServers(token: string): Promise<void> {
    iceServers = await fetchCallIceServers(token);
  }

  async getLocalMedia(type: 'audio' | 'video'): Promise<MediaStream | null> {
    this.stopLocalMedia();
    try {
      const stream = await mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: type === 'video' ? { facingMode: 'user' } : false,
      });
      stream.getTracks().forEach((track) => { track.enabled = true; });
      this.localStream = stream;
      return stream;
    } catch (error) {
      console.warn('[WebRTCService] Native microphone/camera permission or capture failed:', error);
      return null;
    }
  }

  initPeerConnection(
    onRemoteStream: (stream: MediaStream) => void,
    onIceCandidate: (candidate: any) => void,
    onConnectionState?: (state: any) => void,
  ): any {
    this.cleanupPeerConnection();
    this.onRemoteStream = onRemoteStream;
    this.onIceCandidate = onIceCandidate;
    this.onConnectionState = onConnectionState;
    const pc: any = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 10 });
    this.pc = pc;
    const localStream = this.localStream;
    localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));
    pc.ontrack = (event: any) => {
      event.track.enabled = true;
      const stream = event.streams?.[0];
      if (stream) this.remoteStream = stream;
      else {
        if (!this.remoteStream) this.remoteStream = new MediaStream();
        this.remoteStream.addTrack(event.track);
      }
      if (this.remoteStream) this.onRemoteStream?.(this.remoteStream);
    };
    pc.onicecandidate = (event: any) => {
      if (event.candidate) this.onIceCandidate?.(event.candidate.toJSON?.() || event.candidate);
    };
    pc.onconnectionstatechange = () => this.onConnectionState?.(pc.connectionState);
    return pc;
  }

  unlockAudio(): void {
    // Native WebRTC starts the platform audio session when media capture begins.
  }

  async createOffer(callType: 'audio' | 'video' = 'video'): Promise<any> {
    if (!this.pc) return null;
    try {
      const offer = await this.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === 'video' });
      await this.pc.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.warn('[WebRTCService] Native offer creation failed:', error);
      return null;
    }
  }

  async createAnswer(remoteOffer: any): Promise<any> {
    if (!this.pc) return null;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(remoteOffer));
      await this.processCandidateQueue();
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.warn('[WebRTCService] Native answer creation failed:', error);
      return null;
    }
  }

  async setRemoteAnswer(remoteAnswer: any): Promise<void> {
    if (!this.pc || this.pc.signalingState === 'stable') return;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
      await this.processCandidateQueue();
    } catch (error) {
      console.warn('[WebRTCService] Native remote answer failed:', error);
    }
  }

  async addIceCandidate(candidate: any): Promise<void> {
    const raw = candidate?.candidateInit || candidate;
    if (!raw?.candidate) return;
    if (!this.pc?.remoteDescription?.type) {
      this.candidateQueue.push(raw);
      return;
    }
    try { await this.pc.addIceCandidate(new RTCIceCandidate(raw)); }
    catch (error) { console.warn('[WebRTCService] Native ICE candidate failed:', error); }
  }

  private async processCandidateQueue(): Promise<void> {
    while (this.pc?.remoteDescription && this.candidateQueue.length) {
      const candidate = this.candidateQueue.shift();
      if (candidate?.candidate) {
        try { await this.pc.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (error) { console.warn('[WebRTCService] Queued ICE candidate failed:', error); }
      }
    }
  }

  toggleAudio(): boolean {
    const track = this.localStream?.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }

  toggleVideo(): boolean {
    const track = this.localStream?.getVideoTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }

  async switchCamera(): Promise<MediaStream | null> {
    const track: any = this.localStream?.getVideoTracks()[0];
    if (!track?._switchCamera) return this.localStream;
    track._switchCamera();
    return this.localStream;
  }

  stopLocalMedia(): void {
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
  }

  cleanupPeerConnection(): void {
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.remoteStream = null;
  }

  destroy(): void {
    this.stopLocalMedia();
    this.cleanupPeerConnection();
    this.candidateQueue = [];
  }
}

export const webrtcService = new WebRTCService();
