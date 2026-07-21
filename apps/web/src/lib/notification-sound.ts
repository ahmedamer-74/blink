let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function playMessageSound() {
  try {
    const ctx = getAudioContext();

    // Resume context if suspended (required by browsers after user interaction)
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Create a pleasant two-tone notification sound
    const oscillator1 = ctx.createOscillator();
    const oscillator2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(ctx.destination);

    // First tone (higher)
    oscillator1.type = "sine";
    oscillator1.frequency.setValueAtTime(880, now); // A5
    oscillator1.frequency.setValueAtTime(1100, now + 0.08); // slide up

    // Second tone (lower)
    oscillator2.type = "sine";
    oscillator2.frequency.setValueAtTime(660, now + 0.1); // E5
    oscillator2.frequency.setValueAtTime(880, now + 0.18); // slide up

    // Volume envelope
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gainNode.gain.linearRampToValueAtTime(0.12, now + 0.08);
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.1);
    gainNode.gain.linearRampToValueAtTime(0.1, now + 0.18);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.25);

    // Play
    oscillator1.start(now);
    oscillator1.stop(now + 0.1);
    oscillator2.start(now + 0.1);
    oscillator2.stop(now + 0.25);
  } catch {
    // Silently fail if audio is not available
  }
}
