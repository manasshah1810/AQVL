import type { SpeechRequest, ThemeVoice, TTSProvider } from '../types';

type VitsWeb = typeof import('@diffusionstudio/vits-web');

let loaded: Promise<VitsWeb> | null = null;
/** Piper (VITS) running in the browser through WebAssembly; loaded only when first needed. */
function vits(): Promise<VitsWeb> {
  loaded ??= import('@diffusionstudio/vits-web');
  return loaded;
}

/** Sentences already synthesised this session (new code never hits it; replays and step-backs do). */
const CACHE_LIMIT = 24;
const cache = new Map<string, string>();

function remember(key: string, url: string) {
  cache.set(key, url);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value as string;
    URL.revokeObjectURL(cache.get(oldest)!);
    cache.delete(oldest);
  }
}

// One synthesis at a time: the model runs in a single worker.
let queue: Promise<unknown> = Promise.resolve();

function playUrl(url: string, voice: ThemeVoice, signal: AbortSignal, onStart?: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return resolve();
    const audio = new Audio(url);
    audio.preservesPitch = voice.piper.preservePitch;
    audio.playbackRate = voice.piper.rate;
    const finish = () => {
      signal.removeEventListener('abort', stop);
      audio.removeAttribute('src');
      audio.load();
    };
    function stop() {
      audio.pause();
      finish();
      resolve();
    }
    signal.addEventListener('abort', stop);
    audio.onended = () => {
      finish();
      resolve();
    };
    audio.onerror = () => {
      finish();
      reject(new Error('The audio could not be played.'));
    };
    audio.play().then(
      () => onStart?.(),
      (e) => {
        finish();
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

export const piperProvider: TTSProvider = {
  id: 'piper',
  label: 'Piper (local neural voice)',

  isSupported() {
    return (
      typeof window !== 'undefined' &&
      typeof Audio !== 'undefined' &&
      typeof WebAssembly !== 'undefined' &&
      typeof Worker !== 'undefined' &&
      !!navigator.storage?.getDirectory
    );
  },

  async warm(voice, onProgress) {
    const { download, stored } = await vits();
    const id = voice.piper.voiceId as Parameters<typeof download>[0];
    if ((await stored()).includes(id)) return;
    await download(id, (p) => onProgress?.(p.total > 0 ? p.loaded / p.total : 0));
  },

  async speak({ text, voice, signal, onStart, onProgress }: SpeechRequest) {
    const key = `${voice.piper.voiceId}|${text}`;
    let url = cache.get(key);
    if (!url) {
      const { predict } = await vits();
      const run = queue.then(async () => {
        if (signal.aborted) return null;
        const blob = await predict(
          { text, voiceId: voice.piper.voiceId as Parameters<typeof predict>[0]['voiceId'] },
          (p) => onProgress?.(p.total > 0 ? p.loaded / p.total : 0),
        );
        return URL.createObjectURL(blob);
      });
      queue = run.catch(() => null);
      const made = await run;
      if (!made) return;
      remember(key, made);
      url = made;
    }
    if (signal.aborted) return;
    await playUrl(url, voice, signal, onStart);
  },
};
