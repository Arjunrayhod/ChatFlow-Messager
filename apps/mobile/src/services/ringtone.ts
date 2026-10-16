/**
 * @file Web Audio API synthesized ringtone & ringback audio manager (Phase 5).
 * Generates instant, zero-latency phone ringtones and feedback tones without external mp3 dependencies.
 * 
 * [HINGLISH GUIDE]:
 * Yeh audio service bina kisi audio file (.mp3) ke, seedhe browser ke Web Audio API se
 * real ringtone aur ringback tone synthesize karti hai:
 * 1. startIncomingRingtone(): Incoming call aane par melodic ringing chime play karta hai.
 * 2. startOutgoingRingback(): Dusre user ko call lagate waqt standard telephone ringback beep play karta hai.
 * 3. playCallEndedTone(): Call katne par brief 'busy / disconnect' beep bajata hai.
 * 4. stopAll(): Sabhi sounds turant band kar deta hai.
 */

import { Platform } from 'react-native';

class RingtoneManager {
  private audioCtx: AudioContext | null = null;
  private incomingInterval: any = null;
  private outgoingInterval: any = null;
  private isPlayingIncoming = false;
  private isPlayingOutgoing = false;

  private getAudioContext(): AudioContext | null {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return null;
    }
    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          this.audioCtx = new AudioCtxClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume();
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /**
   * Starts rhythmic melodic incoming ringtone chime (C5 - E5 - G5 - C6).
   */
  startIncomingRingtone() {
    if (this.isPlayingIncoming) return;
    this.stopAll();
    this.isPlayingIncoming = true;

    const playChimeSequence = () => {
      const ctx = this.getAudioContext();
      if (!ctx || !this.isPlayingIncoming) return;

      const notes = [
        { freq: 523.25, time: 0.0, dur: 0.18 }, // C5
        { freq: 659.25, time: 0.2, dur: 0.18 }, // E5
        { freq: 783.99, time: 0.4, dur: 0.18 }, // G5
        { freq: 1046.5, time: 0.6, dur: 0.35 }, // C6
        { freq: 783.99, time: 1.0, dur: 0.18 }, // G5
        { freq: 1046.5, time: 1.2, dur: 0.45 }, // C6
      ];

      notes.forEach(({ freq, time, dur }) => {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + time);

          // Soft envelope: attack -> sustain -> smooth exponential decay
          gain.gain.setValueAtTime(0.001, ctx.currentTime + time);
          gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + time + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + time + dur);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(ctx.currentTime + time);
          osc.stop(ctx.currentTime + time + dur + 0.05);
        } catch {
          // Ignore
        }
      });
    };

    playChimeSequence();
    this.incomingInterval = setInterval(playChimeSequence, 2400);
  }

  /**
   * Starts standard outgoing ringback tone (440Hz + 480Hz dual tone, 1.6s on, 2.4s off).
   */
  startOutgoingRingback() {
    if (this.isPlayingOutgoing) return;
    this.stopAll();
    this.isPlayingOutgoing = true;

    const playRingbackPulse = () => {
      const ctx = this.getAudioContext();
      if (!ctx || !this.isPlayingOutgoing) return;

      try {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, ctx.currentTime); // 440 Hz

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, ctx.currentTime); // 480 Hz

        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + 1.4);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(ctx.currentTime);
        osc2.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 1.55);
        osc2.stop(ctx.currentTime + 1.55);
      } catch {
        // Ignore
      }
    };

    playRingbackPulse();
    this.outgoingInterval = setInterval(playRingbackPulse, 3800);
  }

  /**
   * Plays three descending call-ended beeps.
   */
  playCallEndedTone() {
    this.stopAll();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const beeps = [
      { freq: 480, time: 0.0, dur: 0.12 },
      { freq: 400, time: 0.15, dur: 0.12 },
      { freq: 320, time: 0.3, dur: 0.2 },
    ];

    beeps.forEach(({ freq, time, dur }) => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + time);

        gain.gain.setValueAtTime(0.15, ctx.currentTime + time);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + time + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + time);
        osc.stop(ctx.currentTime + time + dur + 0.02);
      } catch {
        // Ignore
      }
    });
  }

  /**
   * Plays standard telephone rapid busy tone (480Hz + 620Hz engaged beeps).
   */
  playBusyTone() {
    this.stopAll();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const pulses = [0, 0.4, 0.8, 1.2];
    pulses.forEach((time) => {
      try {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(480, ctx.currentTime + time);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(620, ctx.currentTime + time);

        gain.gain.setValueAtTime(0.12, ctx.currentTime + time);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + time + 0.28);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(ctx.currentTime + time);
        osc2.start(ctx.currentTime + time);
        osc1.stop(ctx.currentTime + time + 0.3);
        osc2.stop(ctx.currentTime + time + 0.3);
      } catch {
        // Ignore
      }
    });
  }

  /**
   * Stops all running sound loops.
   */
  stopAll() {
    this.isPlayingIncoming = false;
    this.isPlayingOutgoing = false;

    if (this.incomingInterval) {
      clearInterval(this.incomingInterval);
      this.incomingInterval = null;
    }
    if (this.outgoingInterval) {
      clearInterval(this.outgoingInterval);
      this.outgoingInterval = null;
    }
  }
}

export const ringtoneService = new RingtoneManager();
