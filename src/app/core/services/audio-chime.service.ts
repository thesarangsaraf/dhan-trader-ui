import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AudioChimeService {
  private audioCtx: AudioContext | null = null;
  readonly soundEnabled = signal<boolean>(true);

  constructor() {
    const saved = localStorage.getItem('dhan_sound_enabled');
    if (saved !== null) {
      this.soundEnabled.set(saved === 'true');
    }
  }

  toggleSound(): boolean {
    const next = !this.soundEnabled();
    this.soundEnabled.set(next);
    localStorage.setItem('dhan_sound_enabled', String(next));
    if (next) {
      this.playChime(659.25, 0.08); // Quick subtle ping
    }
    return next;
  }

  private initAudio(): AudioContext | null {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Plays a pleasant two-tone trading alert chime (D5 -> A5)
   */
  playAlertTriggerChime(): void {
    if (!this.soundEnabled()) return;

    try {
      const ctx = this.initAudio();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Note 1: 587.33 Hz (D5)
      this.playTone(ctx, 587.33, now, 0.15, 'sine');
      // Note 2: 880.00 Hz (A5)
      this.playTone(ctx, 880.00, now + 0.16, 0.35, 'sine');
    } catch (err) {
      console.warn('Audio chime playback failed:', err);
    }
  }

  /**
   * Plays a quick notification chime for test trigger
   */
  playTestChime(): void {
    try {
      const ctx = this.initAudio();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Arpeggio: C5 -> E5 -> G5 -> C6
      this.playTone(ctx, 523.25, now, 0.08, 'triangle');
      this.playTone(ctx, 659.25, now + 0.08, 0.08, 'triangle');
      this.playTone(ctx, 783.99, now + 0.16, 0.08, 'triangle');
      this.playTone(ctx, 1046.50, now + 0.24, 0.25, 'sine');
    } catch (err) {
      console.warn('Test chime playback failed:', err);
    }
  }

  private playChime(freq: number, duration: number): void {
    try {
      const ctx = this.initAudio();
      if (!ctx) return;
      this.playTone(ctx, freq, ctx.currentTime, duration, 'sine');
    } catch (e) {
      console.warn('Chime playback error:', e);
    }
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType = 'sine'
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    // Smooth envelope attack and release
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }
}
