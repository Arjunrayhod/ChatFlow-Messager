/**
 * @file WebRTC Calling Types and Data Contracts for ChatFlow (Phase 5).
 * Strict adherence to RULE 0.1: ZERO phone numbers allowed.
 * 
 * [HINGLISH GUIDE]:
 * Yeh 1-on-1 Voice aur Video Calling ke liye shared types hain:
 * 1. CallType: 'audio' ya 'video'.
 * 2. CallStatus: 'ringing', 'connected', 'ended', 'rejected', 'busy', 'missed'.
 * 3. CallRecord: Database aur frontend logs ke liye structured call history item.
 * 4. Signaling payloads: WebRTC Offer, Answer aur ICE Candidate exchange.
 */

export type CallType = 'audio' | 'video';

export type CallStatus =
  | 'calling'
  | 'ringing'
  | 'connected'
  | 'ended'
  | 'rejected'
  | 'busy'
  | 'missed';

export type CallDirection = 'incoming' | 'outgoing';

export interface CallParticipant {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export interface CallRecord {
  id: string;
  callerId: string;
  callerUsername: string;
  callerDisplayName: string;
  callerAvatarUrl?: string;
  receiverId: string;
  receiverUsername: string;
  receiverDisplayName: string;
  receiverAvatarUrl?: string;
  type: CallType;
  status: CallStatus;
  startedAt: string;
  answeredAt?: string;
  endedAt?: string;
  durationSeconds: number;
}

/** Payload for initiating a call with an SDP offer. */
export interface CallOfferPayload {
  callId: string;
  caller: CallParticipant;
  receiverId: string;
  callType: CallType;
  sdp: unknown; // RTCSessionDescriptionInit
}

/** Payload for answering an incoming call with an SDP answer. */
export interface CallAnswerPayload {
  callId: string;
  callerId: string;
  receiver: CallParticipant;
  sdp: unknown; // RTCSessionDescriptionInit
}

/** Payload for exchanging WebRTC ICE candidates. */
export interface CallIceCandidatePayload {
  callId: string;
  targetUserId: string;
  candidate: unknown; // RTCIceCandidateInit
}

/** Payload for terminating an active or ringing call. */
export interface CallEndPayload {
  callId: string;
  targetUserId: string;
  reason?: string;
  durationSeconds?: number;
}

/** Payload for declining an incoming call. */
export interface CallRejectPayload {
  callId: string;
  callerId: string;
  reason?: string;
}
