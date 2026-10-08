import type { SpeechRequest, TTSProvider } from '../types';

function englishVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
}

/** The browser's built-in synthesiser: local, instant, and a good fallback when the neural model cannot load. */
export const speechSynthesisProvider: TTSProvider = {
  id: 'browser',
  label: 'Browser voice',

  isSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  },

  speak({ text, voice, signal, onStart }: SpeechRequest) {
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) return resolve();
      const synth = window.speechSynthesis;
      const u = new SpeechSynthesisUtterance(text);
      u.rate = voice.speech.rate;
      u.pitch = voice.speech.pitch;
      const voices = englishVoices();
      const picked = voice.speech.prefer.map((re) => voices.find((v) => re.test(v.name))).find(Boolean) ?? voices.find((v) => v.default) ?? voices[0];
      if (picked) {
        u.voice = picked;
        u.lang = picked.lang;
      } else u.lang = 'en-US';
      function stop() {
        synth.cancel();
        signal.removeEventListener('abort', stop);
        resolve();
      }
      signal.addEventListener('abort', stop);
      u.onstart = () => onStart?.();
      u.onend = () => {
        signal.removeEventListener('abort', stop);
        resolve();
      };
      u.onerror = (e) => {
        signal.removeEventListener('abort', stop);
        if (e.error === 'canceled' || e.error === 'interrupted') resolve();
        else reject(new Error(`Speech failed: ${e.error}`));
      };
      synth.cancel();
      synth.speak(u);
    });
  },
};
