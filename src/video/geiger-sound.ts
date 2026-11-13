/**
 * The terminal's sounds, synthesised with the Web Audio API so the skin ships no audio files: a power-up chirp when the
 * tape first rolls, a soft relay click on play and pause, and the counter's crackle while winding.
 */

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  audioContext ??= new AudioContext();
  if (audioContext.state === 'suspended') void audioContext.resume();
  return audioContext;
}

/** One short, band-passed noise burst: a single Geiger tick or a relay closing. */
function tick(context: AudioContext, at: number, seconds: number, frequency: number, peak: number): void {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    samples[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 3;
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.value = frequency;
  filter.Q.value = 1.2;
  gain.gain.value = peak;
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(context.currentTime + at);
}

const BOOT = { seconds: 0.32, fromHz: 180, toHz: 1320, peak: 0.12 } as const;
const RELAY = { seconds: 0.012, frequency: 2600, peak: 0.3 } as const;
const CRACKLE = { ticks: 9, spreadSeconds: 0.35, seconds: 0.004, frequency: 3400, peak: 0.45 } as const;

/** The screen powering up: a rising square-wave chirp with a relay click on top. */
export function playBoot(volume: number): void {
  const context = getContext();
  if (!context || volume <= 0) return;
  const start = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(BOOT.fromHz, start);
  oscillator.frequency.exponentialRampToValueAtTime(BOOT.toHz, start + BOOT.seconds);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(BOOT.peak * volume, start + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + BOOT.seconds);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + BOOT.seconds);
  tick(context, 0, RELAY.seconds, RELAY.frequency, RELAY.peak * volume);
}

/** A relay closing: the hardware key under your finger. */
export function playRelay(volume: number): void {
  const context = getContext();
  if (!context || volume <= 0) return;
  tick(context, 0, RELAY.seconds, RELAY.frequency, RELAY.peak * volume);
}

/** A burst of Geiger ticks at random intervals, as the tape winds past. */
export function playCrackle(volume: number): void {
  const context = getContext();
  if (!context || volume <= 0) return;
  for (let index = 0; index < CRACKLE.ticks; index += 1) {
    const at = Math.random() * CRACKLE.spreadSeconds;
    tick(context, at, CRACKLE.seconds, CRACKLE.frequency, CRACKLE.peak * volume * (0.5 + Math.random() * 0.5));
  }
}
