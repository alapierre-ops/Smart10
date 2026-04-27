type WaveType = OscillatorType;

interface ToneEvent {
  frequency: number;
  durationMs: number;
  gain?: number;
  wave?: WaveType;
}

const playToneSequence = (ctx: AudioContext, tones: ToneEvent[]): void => {
  const now = ctx.currentTime;
  let cursor = 0;
  tones.forEach((tone) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.wave ?? "sine";
    osc.frequency.value = tone.frequency;
    gain.gain.setValueAtTime(0.0001, now + cursor);
    gain.gain.exponentialRampToValueAtTime(tone.gain ?? 0.12, now + cursor + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + cursor + tone.durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + cursor);
    osc.stop(now + cursor + tone.durationMs / 1000 + 0.02);
    cursor += tone.durationMs / 1000 + 0.02;
  });
};

export const createSoundEffects = () => {
  let context: AudioContext | null = null;

  const getContext = (): AudioContext => {
    if (!context) {
      context = new AudioContext();
    }
    return context;
  };

  const play = (tones: ToneEvent[]) => {
    const ctx = getContext();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    playToneSequence(ctx, tones);
  };

  return {
    click: () => play([{ frequency: 640, durationMs: 60, gain: 0.08, wave: "triangle" }]),
    navigate: () =>
      play([
        { frequency: 420, durationMs: 55, gain: 0.08, wave: "triangle" },
        { frequency: 520, durationMs: 70, gain: 0.08, wave: "triangle" }
      ]),
    openModal: () =>
      play([
        { frequency: 520, durationMs: 70, gain: 0.08, wave: "sine" },
        { frequency: 760, durationMs: 95, gain: 0.09, wave: "sine" }
      ]),
    correct: () =>
      play([
        { frequency: 560, durationMs: 80, gain: 0.09, wave: "triangle" },
        { frequency: 740, durationMs: 90, gain: 0.1, wave: "triangle" },
        { frequency: 930, durationMs: 110, gain: 0.11, wave: "triangle" }
      ]),
    wrong: () =>
      play([
        { frequency: 360, durationMs: 90, gain: 0.11, wave: "sawtooth" },
        { frequency: 250, durationMs: 120, gain: 0.12, wave: "sawtooth" }
      ]),
    secure: () =>
      play([
        { frequency: 640, durationMs: 75, gain: 0.09, wave: "triangle" },
        { frequency: 760, durationMs: 85, gain: 0.1, wave: "triangle" }
      ]),
    risk: () =>
      play([
        { frequency: 460, durationMs: 70, gain: 0.08, wave: "square" },
        { frequency: 560, durationMs: 70, gain: 0.08, wave: "square" }
      ]),
    roundEnd: () =>
      play([
        { frequency: 520, durationMs: 70, gain: 0.08, wave: "sine" },
        { frequency: 700, durationMs: 80, gain: 0.1, wave: "sine" },
        { frequency: 880, durationMs: 110, gain: 0.11, wave: "sine" }
      ]),
    gameEnd: () =>
      play([
        { frequency: 440, durationMs: 110, gain: 0.1, wave: "triangle" },
        { frequency: 554, durationMs: 110, gain: 0.1, wave: "triangle" },
        { frequency: 659, durationMs: 130, gain: 0.11, wave: "triangle" },
        { frequency: 880, durationMs: 200, gain: 0.12, wave: "triangle" }
      ]),
    timerTick: () => play([{ frequency: 820, durationMs: 45, gain: 0.06, wave: "triangle" }]),
    timerEnd: () =>
      play([
        { frequency: 320, durationMs: 90, gain: 0.1, wave: "square" },
        { frequency: 240, durationMs: 120, gain: 0.1, wave: "square" }
      ])
  };
};
