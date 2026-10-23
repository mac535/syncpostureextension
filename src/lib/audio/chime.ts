/**
 * chime.ts
 *
 * Synthesizes a gentle, soft ergonomic chime using the browser's native Web Audio API.
 * Requires 0 external audio files, 0 network requests, and runs 100% offline.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (err) {
    console.warn('Could not initialize AudioContext:', err);
    return null;
  }
}

/**
 * Plays a gentle, non-intrusive two-tone ergonomic chime (E5 -> G#5 harmonic chime).
 * Designed to gently notify the user without shocking or disrupting focus.
 */
export function playPostureChime(volume: number = 0.12): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Harmonic two-tone chord
    const notes = [
      { freq: 659.25, start: 0.00, duration: 0.8 }, // E5
      { freq: 830.61, start: 0.09, duration: 0.9 }, // G#5
      { freq: 987.77, start: 0.18, duration: 1.0 }  // B5
    ];

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      // Gentle attack and exponential decay envelope
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.linearRampToValueAtTime(volume, now + start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration + 0.05);
    });
  } catch (err) {
    console.warn('PostureSync audio playback error (ignored safely):', err);
  }
}
