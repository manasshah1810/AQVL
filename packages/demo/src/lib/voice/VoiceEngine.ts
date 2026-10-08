import { useSyncExternalStore } from 'react';
import { piperProvider } from './providers/piperProvider';
import { speechSynthesisProvider } from './providers/speechSynthesisProvider';
import { themeVoice } from './themeVoice';
import type { TTSProvider, VoiceStatus, VoiceTheme } from './types';

export type VoiceEngineChoice = 'neural' | 'browser';
export type SpeakResult = 'done' | 'cancelled' | 'failed';

/** Say symbols the way a teacher would, so no engine drops an arrow or reads "[3]" letter by letter. */
export function speakable(text: string): string {
  return text
    .replace(/↔/g, ' with ')
    .replace(/[→⟹]/g, ' points to ')
    .replace(/≤/g, ' is at most ')
    .replace(/≥/g, ' is at least ')
    .replace(/≠/g, ' is not equal to ')
    .replace(/∞/g, 'infinity')
    .replace(/−/g, 'minus ')
    .replace(/\bNULL\b/g, 'null')
    .replace(/LENGTH\(([^)]+)\)/g, 'the length of $1')
    .replace(/\[(\d+)\]/g, ' position $1')
    .replace(/([A-Za-z_]\w*)\[([^\]]+)\]/g, '$1 at position $2')
    .replace(/ != /g, ' is not equal to ')
    .replace(/ == /g, ' equals ')
    .replace(/ <= /g, ' is at most ')
    .replace(/ >= /g, ' is at least ')
    .replace(/ < /g, ' is less than ')
    .replace(/ > /g, ' is greater than ')
    .replace(/ \+ /g, ' plus ')
    .replace(/ - /g, ' minus ')
    .replace(/ \* /g, ' times ')
    .replace(/[`*_#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const IDLE: VoiceStatus = { phase: 'idle', provider: null, progress: null, note: null };

class VoiceEngineImpl {
  private status: VoiceStatus = IDLE;
  private readonly listeners = new Set<() => void>();
  private current: AbortController | null = null;
  private choice: VoiceEngineChoice = 'neural';
  /** Providers that failed this session; they are skipped until the page reloads. */
  private readonly broken = new Set<TTSProvider['id']>();

  setEngine(choice: VoiceEngineChoice) {
    if (choice === this.choice) return;
    this.choice = choice;
    if (choice === 'neural') this.broken.delete('piper');
    this.set({ note: null });
  }

  private chain(): TTSProvider[] {
    const order = this.choice === 'neural' ? [piperProvider, speechSynthesisProvider] : [speechSynthesisProvider];
    return order.filter((p) => p.isSupported() && !this.broken.has(p.id));
  }

  /** Speaks `text` in the voice of `theme`. A newer call (or cancel) ends this one early. */
  async speak({ text, theme }: { text: string; theme: VoiceTheme }): Promise<SpeakResult> {
    this.cancel();
    const clean = speakable(text);
    if (!clean) return 'done';
    const controller = new AbortController();
    this.current = controller;
    const voice = themeVoice(theme);
    this.set({ phase: 'preparing', progress: null });
    let note: string | null = this.status.note;
    for (const provider of this.chain()) {
      try {
        this.set({ provider: provider.id });
        await provider.speak({
          text: clean,
          voice,
          signal: controller.signal,
          onStart: () => {
            if (!controller.signal.aborted) this.set({ phase: 'speaking', progress: null, note });
          },
          onProgress: (f) => {
            if (!controller.signal.aborted) this.set({ progress: f });
          },
        });
        if (this.current === controller) {
          this.current = null;
          this.set({ phase: 'idle', progress: null });
        }
        return controller.signal.aborted ? 'cancelled' : 'done';
      } catch (e) {
        if (controller.signal.aborted) return 'cancelled';
        this.broken.add(provider.id);
        if (provider.id === 'piper') note = 'The neural voice could not load, so the browser voice is speaking.';
        console.warn(`[voice] ${provider.id} failed:`, e);
      }
    }
    if (this.current === controller) {
      this.current = null;
      this.set({ phase: 'idle', progress: null, note: 'No local speech engine is available in this browser.' });
    }
    return 'failed';
  }

  /** Starts fetching the neural model for `theme` ahead of its first sentence. */
  async warm(theme: VoiceTheme) {
    if (this.choice !== 'neural' || !piperProvider.isSupported() || this.broken.has('piper')) return;
    try {
      this.set({ phase: 'preparing', provider: 'piper' });
      await piperProvider.warm?.(themeVoice(theme), (f) => this.set({ progress: f }));
    } catch (e) {
      this.broken.add('piper');
      this.set({ note: 'The neural voice could not load, so the browser voice will speak.' });
      console.warn('[voice] piper warm-up failed:', e);
    } finally {
      if (!this.current) this.set({ phase: 'idle', progress: null });
    }
  }

  cancel() {
    this.current?.abort();
    this.current = null;
    if (this.status.phase !== 'idle') this.set({ phase: 'idle', progress: null });
  }

  getStatus = () => this.status;

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  private set(patch: Partial<VoiceStatus>) {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach((l) => l());
  }
}

/** The one voice of the app: `VoiceEngine.speak({ text, theme: 'panda' })`. */
export const VoiceEngine = new VoiceEngineImpl();

export function useVoiceStatus(): VoiceStatus {
  return useSyncExternalStore(VoiceEngine.subscribe, VoiceEngine.getStatus, () => IDLE);
}
