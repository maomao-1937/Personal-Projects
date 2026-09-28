export type CharacterSoundRole = 'rational' | 'monkey' | 'monster';

let audioContext: AudioContext | null = null;
let activeOutput: GainNode | null = null;
let requestId = 0;

type Tone = {
  type: OscillatorType;
  from: number;
  to: number;
  offset: number;
  duration: number;
  volume: number;
  attack?: number;
};

const TONES: Record<CharacterSoundRole, Tone[]> = {
  rational: [
    { type: 'sine', from: 523, to: 523, offset: 0, duration: 0.43, volume: 0.58, attack: 0.025 },
    { type: 'sine', from: 784, to: 784, offset: 0.09, duration: 0.47, volume: 0.32, attack: 0.025 },
  ],
  monkey: [
    { type: 'triangle', from: 540, to: 870, offset: 0, duration: 0.13, volume: 0.55 },
    { type: 'triangle', from: 680, to: 1040, offset: 0.14, duration: 0.13, volume: 0.55 },
    { type: 'sine', from: 760, to: 580, offset: 0.29, duration: 0.13, volume: 0.36 },
  ],
  monster: [
    { type: 'triangle', from: 220, to: 125, offset: 0, duration: 0.48, volume: 0.54, attack: 0.055 },
    { type: 'sawtooth', from: 156, to: 105, offset: 0.045, duration: 0.37, volume: 0.13, attack: 0.05 },
  ],
};

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  try {
    if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContextClass();
    return audioContext;
  } catch {
    return null;
  }
}

function scheduleTone(context: AudioContext, output: GainNode, tone: Tone, baseTime: number) {
  const start = baseTime + tone.offset;
  const end = start + tone.duration;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();

  oscillator.type = tone.type;
  oscillator.frequency.setValueAtTime(tone.from, start);
  if (tone.from !== tone.to) oscillator.frequency.exponentialRampToValueAtTime(tone.to, end);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(tone.volume, start + (tone.attack ?? 0.012));
  envelope.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(envelope);
  envelope.connect(output);
  oscillator.start(start);
  oscillator.stop(end + 0.01);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
}

function play(context: AudioContext, role: CharacterSoundRole) {
  const now = context.currentTime;
  if (activeOutput) {
    activeOutput.gain.cancelScheduledValues(now);
    activeOutput.gain.setValueAtTime(activeOutput.gain.value, now);
    activeOutput.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
  }

  const output = context.createGain();
  output.gain.value = 0.075;
  output.connect(context.destination);
  activeOutput = output;

  const start = now + 0.005;
  for (const tone of TONES[role]) scheduleTone(context, output, tone, start);
  const lastEnd = Math.max(...TONES[role].map((tone) => tone.offset + tone.duration));
  window.setTimeout(() => {
    output.disconnect();
    if (activeOutput === output) activeOutput = null;
  }, (lastEnd + 0.1) * 1000);
}

/** Plays a quiet, short character cue after a user interaction. Silently skips unsupported audio. */
export function playCharacterSound(role: CharacterSoundRole): void {
  const context = getAudioContext();
  if (!context) return;
  const currentRequest = ++requestId;

  if (context.state === 'running') {
    play(context, role);
    return;
  }

  // Autoplay restrictions may suspend audio until a click. Only the latest click should sound.
  void context.resume().then(() => {
    if (currentRequest === requestId && context.state === 'running') play(context, role);
  }).catch(() => {});
}
