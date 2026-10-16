/**
 * @file Zustand state store for WebRTC Calling & Call History (Phase 5).
 * Strict adherence to RULE 0.1: No phone numbers.
 * 
 * [HINGLISH GUIDE]:
 * Yeh store 1-on-1 Voice aur Video calling ka pura lifecycle manage karta hai:
 * 1. startCall(): Peer ke sath naya audio/video call initiate karta hai aur offer SDP bhejta hai.
 * 2. answerCall(): Incoming call accept karke answer SDP bhejta hai aur WebRTC stream connect karta hai.
 * 3. rejectCall(): Incoming call decline karta hai.
 * 4. endCall(): Chal rahi call disconnect karta hai aur duration record karta hai.
 * 5. toggleMute(), toggleVideo(), switchCamera(): In-call media controls.
 * 6. fetchCallLogs(), deleteCallLog(): Calls tab ke liye call history manage karta hai.
 */

import { create } from 'zustand';
import {
  CallType,
  CallStatus,
  CallParticipant,
  CallRecord,
} from '@chatflow/shared';
import { webrtcService } from '../services/webrtc';
import { ringtoneService } from '../services/ringtone';
import {
  connectSocket,
  getSocket,
  emitCallInitiate,
  emitCallAnswer,
  emitCallReject,
  emitCallIceCandidate,
  emitCallEnd,
} from '../services/socket';
import {
  getCalls,
  deleteCallRecord,
  clearCallHistory,
} from '../services/api';

export interface ActiveCall {
  callId: string;
  partner: CallParticipant;
  type: CallType;
  status: CallStatus | 'idle';
  direction: 'incoming' | 'outgoing';
  incomingSdp?: unknown;
  endReason?: string;
}

export interface CallStoreState {
  activeCall: ActiveCall | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeakerOn: boolean;
  callDuration: number;
  callLogs: CallRecord[];
  isLoadingLogs: boolean;

  // Actions
  initCallListeners: (token: string) => void;
  startCall: (partner: CallParticipant, type: CallType) => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: (reason?: string) => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  switchCamera: () => Promise<void>;
  fetchCallLogs: (token: string) => Promise<void>;
  deleteCallLog: (callId: string, token: string) => Promise<void>;
  clearCallLogs: (token: string) => Promise<void>;
}

let timerInterval: any = null;

export const useCallStore = create<CallStoreState>((set, get) => ({
  activeCall: null,
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isVideoOff: false,
  isSpeakerOn: true,
  callDuration: 0,
  callLogs: [],
  isLoadingLogs: false,

  /**
   * Initializes real-time Socket.IO signaling event listeners.
   */
  initCallListeners: (token: string) => {
    const socket = connectSocket(token);
    if (!socket) return;

    // Prevent duplicate listener registration on the same socket instance
    if ((socket as any).__chatflowCallListenersRegistered) {
      return;
    }
    (socket as any).__chatflowCallListenersRegistered = true;

    console.log('[useCallStore] Registering WebRTC call listeners on socket');

    // A. Incoming Call Notification
    socket.on('incoming_call', (payload) => {
      console.log('[useCallStore] incoming_call received from caller:', payload.caller?.displayName || payload.caller?.username, payload);
      const { activeCall } = get();

      // If we already received this exact call, ignore duplicate event
      if (activeCall && activeCall.callId === payload.callId) {
        console.log('[useCallStore] Ignoring duplicate incoming_call packet for same callId:', payload.callId);
        return;
      }

      if (activeCall && activeCall.status !== 'idle' && activeCall.status !== 'ended') {
        // User is currently busy on another DIFFERENT call
        console.warn('[useCallStore] User is busy on another call, rejecting incoming call');
        emitCallReject(payload.callId, payload.caller.id, 'User is busy on another call');
        return;
      }

      set({
        activeCall: {
          callId: payload.callId,
          partner: payload.caller,
          type: payload.type,
          status: 'ringing',
          direction: 'incoming',
          incomingSdp: payload.sdp,
        },
        callDuration: 0,
      });

      ringtoneService.startIncomingRingtone();
    });

    // B. Call Ringing on Remote Device
    socket.on('call_ringing', () => {
      console.log('[useCallStore] Remote device is ringing');
      const { activeCall } = get();
      if (activeCall && activeCall.direction === 'outgoing') {
        set({
          activeCall: {
            ...activeCall,
            status: 'ringing',
          },
        });
      }
    });

    // C. Remote Peer Accepted Call
    socket.on('call_accepted', async (payload) => {
      console.log('[useCallStore] Remote peer accepted call:', payload);
      const { activeCall } = get();
      if (!activeCall || activeCall.callId !== payload.callId) return;

      ringtoneService.stopAll();

      if (payload.sdp) {
        await webrtcService.setRemoteAnswer(payload.sdp as RTCSessionDescriptionInit);
      }

      set({
        activeCall: {
          ...activeCall,
          status: 'connected',
        },
      });

      // Start duration counter
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        set((state) => ({ callDuration: state.callDuration + 1 }));
      }, 1000);
    });

    // D. Remote Peer Declined Call
    socket.on('call_rejected', (payload?: { callId?: string; reason?: string }) => {
      console.log('[useCallStore] call_rejected received:', payload);
      const { activeCall } = get();
      if (!activeCall) return;

      // Verify that this rejection matches the active call
      if (payload?.callId && activeCall.callId !== payload.callId) {
        console.log('[useCallStore] Ignoring call_rejected for mismatched callId');
        return;
      }

      // If call is already connected, DO NOT drop the call due to a stale rejection packet!
      if (activeCall.status === 'connected') {
        console.warn('[useCallStore] Ignoring stale call_rejected because call is already connected');
        return;
      }

      ringtoneService.stopAll();

      const isBusy = Boolean(payload?.reason?.toLowerCase().includes('busy'));
      if (isBusy) {
        ringtoneService.playBusyTone();
      } else {
        ringtoneService.playCallEndedTone();
      }

      set({
        activeCall: {
          ...activeCall,
          status: isBusy ? 'busy' : 'rejected',
          endReason: payload?.reason || (isBusy ? 'User is busy on another call' : 'Call Declined'),
        },
      });

      setTimeout(() => {
        webrtcService.destroy();
        set({
          activeCall: null,
          localStream: null,
          remoteStream: null,
          callDuration: 0,
        });
      }, 3000);
    });

    // E. ICE Candidate Received
    socket.on('call_ice_candidate', async (payload) => {
      const { activeCall } = get();
      if (activeCall && activeCall.callId === payload.callId && payload.candidate) {
        await webrtcService.addIceCandidate(payload.candidate as RTCIceCandidateInit);
      }
    });

    // F. Call Ended by Peer
    socket.on('call_ended', (payload?: { callId?: string; reason?: string }) => {
      console.log('[useCallStore] call_ended received:', payload);
      const { activeCall } = get();
      if (!activeCall) return;

      // Verify that this termination matches the active call
      if (payload?.callId && activeCall.callId !== payload.callId) {
        console.log('[useCallStore] Ignoring call_ended for mismatched callId');
        return;
      }

      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }

      ringtoneService.stopAll();
      ringtoneService.playCallEndedTone();

      set({
        activeCall: {
          ...activeCall,
          status: 'ended',
        },
      });

      setTimeout(() => {
        webrtcService.destroy();
        set({
          activeCall: null,
          localStream: null,
          remoteStream: null,
          callDuration: 0,
        });
      }, 1500);
    });

    // G. Call Missed
    socket.on('call_missed', () => {
      ringtoneService.stopAll();
      webrtcService.destroy();
      set({
        activeCall: null,
        localStream: null,
        remoteStream: null,
        callDuration: 0,
      });
    });
  },

  /**
   * Starts a new 1-on-1 outgoing call.
   */
  startCall: async (partner: CallParticipant, type: CallType) => {
    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    set({
      activeCall: {
        callId,
        partner,
        type,
        status: 'calling',
        direction: 'outgoing',
      },
      callDuration: 0,
      isMuted: false,
      isVideoOff: false,
    });

    ringtoneService.startOutgoingRingback();
    webrtcService.unlockAudio();

    try {
      // 1. Get user media stream
      const stream = await webrtcService.getLocalMedia(type);
      set({ localStream: stream });

      // 2. Initialize peer connection
      webrtcService.initPeerConnection(
        (remoteStream) => {
          set({ remoteStream });
        },
        (candidate) => {
          emitCallIceCandidate(callId, partner.id, candidate);
        }
      );

      // 3. Create SDP Offer
      const offer = await webrtcService.createOffer();
      if (offer) {
        emitCallInitiate(callId, partner.id, type, offer);
      }
    } catch (err) {
      console.warn('[useCallStore] startCall error:', err);
      ringtoneService.stopAll();
      set({ activeCall: null, localStream: null });
    }
  },

  /**
   * Answers an incoming call.
   */
  answerCall: async () => {
    const { activeCall } = get();
    if (!activeCall || activeCall.direction !== 'incoming' || !activeCall.incomingSdp) return;

    ringtoneService.stopAll();
    webrtcService.unlockAudio();

    try {
      // 1. Get user media stream
      const stream = await webrtcService.getLocalMedia(activeCall.type);
      set({ localStream: stream });

      // 2. Initialize peer connection
      webrtcService.initPeerConnection(
        (remoteStream) => {
          set({ remoteStream });
        },
        (candidate) => {
          emitCallIceCandidate(activeCall.callId, activeCall.partner.id, candidate);
        }
      );

      // 3. Create SDP Answer
      const answer = await webrtcService.createAnswer(
        activeCall.incomingSdp as RTCSessionDescriptionInit
      );

      if (answer) {
        emitCallAnswer(activeCall.callId, activeCall.partner.id, answer);
      }

      set({
        activeCall: {
          ...activeCall,
          status: 'connected',
        },
      });

      // Duration counter
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        set((state) => ({ callDuration: state.callDuration + 1 }));
      }, 1000);
    } catch (err) {
      console.warn('[useCallStore] answerCall error:', err);
      ringtoneService.stopAll();
      set({ activeCall: null, localStream: null });
    }
  },

  /**
   * Declines an incoming call.
   */
  rejectCall: (reason = 'Call declined') => {
    const { activeCall } = get();
    ringtoneService.stopAll();

    if (activeCall && activeCall.direction === 'incoming') {
      emitCallReject(activeCall.callId, activeCall.partner.id, reason);
    }

    webrtcService.destroy();
    set({
      activeCall: null,
      localStream: null,
      remoteStream: null,
      callDuration: 0,
    });
  },

  /**
   * Terminates the active call.
   */
  endCall: () => {
    const { activeCall, callDuration } = get();

    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    ringtoneService.stopAll();

    if (activeCall) {
      // If already busy, rejected, or ended, dismiss modal immediately without waiting
      if (
        activeCall.status === 'busy' ||
        activeCall.status === 'rejected' ||
        activeCall.status === 'ended'
      ) {
        webrtcService.destroy();
        set({
          activeCall: null,
          localStream: null,
          remoteStream: null,
          callDuration: 0,
        });
        return;
      }

      ringtoneService.playCallEndedTone();
      emitCallEnd(activeCall.callId, activeCall.partner.id, callDuration);
      set({
        activeCall: {
          ...activeCall,
          status: 'ended',
        },
      });
    }

    setTimeout(() => {
      webrtcService.destroy();
      set({
        activeCall: null,
        localStream: null,
        remoteStream: null,
        callDuration: 0,
      });
    }, 1000);
  },

  /**
   * Toggles microphone audio mute.
   */
  toggleMute: () => {
    const isUnmuted = webrtcService.toggleAudio();
    set({ isMuted: !isUnmuted });
  },

  /**
   * Toggles camera video on/off.
   */
  toggleVideo: () => {
    const isVideoOn = webrtcService.toggleVideo();
    set({ isVideoOff: !isVideoOn });
  },

  /**
   * Switches front / rear camera.
   */
  switchCamera: async () => {
    const updatedStream = await webrtcService.switchCamera();
    if (updatedStream) {
      set({ localStream: updatedStream });
    }
  },

  /**
   * Fetches call history logs from backend.
   */
  fetchCallLogs: async (token: string) => {
    if (!token) return;
    set({ isLoadingLogs: true });

    const response = await getCalls(token);
    if (response.ok) {
      set({ callLogs: response.data, isLoadingLogs: false });
    } else {
      set({ isLoadingLogs: false });
    }
  },

  /**
   * Deletes a single call record.
   */
  deleteCallLog: async (callId: string, token: string) => {
    // Optimistic delete
    set((state) => ({
      callLogs: state.callLogs.filter((c) => c.id !== callId),
    }));
    await deleteCallRecord(token, callId);
  },

  /**
   * Clears all call history.
   */
  clearCallLogs: async (token: string) => {
    set({ callLogs: [] });
    await clearCallHistory(token);
  },
}));
