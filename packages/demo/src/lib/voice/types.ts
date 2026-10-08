/** The four narrators, one per AQVL world. */
export type VoiceTheme = 'default' | 'panda' | 'penguin' | 'rabbit';

/**
 * How a theme sounds, expressed for each kind of provider. A provider reads
 * only the part it understands, so adding or replacing a TTS engine never
 * touches the personalities.
 */
export interface ThemeVoice {
  theme: VoiceTheme;
  label: string;
  /** Piper model (an en_US / en_GB voice) and how its playback is shaped. */
  piper: {
    voiceId: string;
    /** Playback speed multiplier (1 = as synthesised). */
    rate: number;
    /** false lets pitch follow the speed, which lifts a voice and makes it lighter. */
    preservePitch: boolean;
  };
  /** The browser's built-in synthesiser, used when no neural voice is available. */
  speech: {
    rate: number;
    pitch: number;
    /** Voice names to prefer, best first. */
    prefer: RegExp[];
  };
}

export interface SpeechRequest {
  text: string;
  voice: ThemeVoice;
  /** Aborted when something newer should be heard instead. */
  signal: AbortSignal;
  /** The audio has begun (after any model download / synthesis). */
  onStart?: () => void;
  /** Download / preparation progress, 0 to 1. */
  onProgress?: (fraction: number) => void;
}

/**
 * A local text-to-speech engine. `speak` resolves when the speech has ended
 * or was aborted, and rejects if the engine could not speak at all (so the
 * VoiceEngine can fall back to another).
 */
export interface TTSProvider {
  readonly id: 'piper' | 'browser';
  readonly label: string;
  isSupported(): boolean;
  speak(request: SpeechRequest): Promise<void>;
  /** Starts fetching whatever `voice` needs, so the first sentence is not delayed. */
  warm?(voice: ThemeVoice, onProgress?: (fraction: number) => void): Promise<void>;
}

export type VoicePhase = 'idle' | 'preparing' | 'speaking';

export interface VoiceStatus {
  phase: VoicePhase;
  /** The provider doing (or last doing) the speaking. */
  provider: TTSProvider['id'] | null;
  /** 0 to 1 while a voice model downloads. */
  progress: number | null;
  /** Set when the preferred engine failed and another stepped in. */
  note: string | null;
}
