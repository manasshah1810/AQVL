import type { World } from '../world';
import type { ThemeVoice, VoiceTheme } from './types';

/**
 * Four personalities. Each pairs a different Piper model with its own pace
 * and pitch shaping, and carries matching settings for the browser
 * synthesiser, so the narrator is recognisable on either engine.
 */
export const THEME_VOICES: Record<VoiceTheme, ThemeVoice> = {
  default: {
    theme: 'default',
    label: 'Studio',
    piper: { voiceId: 'en_US-lessac-medium', rate: 1, preservePitch: true },
    speech: { rate: 1, pitch: 1, prefer: [/Aria|Jenny|Zira|Samantha|Google US English/i] },
  },
  panda: {
    theme: 'panda',
    label: 'Panda',
    // Warm, calm, a little deeper and slower.
    piper: { voiceId: 'en_US-ryan-medium', rate: 0.9, preservePitch: false },
    speech: { rate: 0.88, pitch: 0.75, prefer: [/Guy|David|Mark|Daniel|Alex|Google UK English Male/i] },
  },
  penguin: {
    theme: 'penguin',
    label: 'Penguin',
    // Energetic and playful: quicker, with a brighter edge.
    piper: { voiceId: 'en_GB-alan-medium', rate: 1.14, preservePitch: false },
    speech: { rate: 1.15, pitch: 1.12, prefer: [/Ryan|Davis|Tony|Brandon|Google UK English Male/i] },
  },
  rabbit: {
    theme: 'rabbit',
    label: 'Rabbit',
    // Cheerful and light: a higher voice, lifted a little further.
    piper: { voiceId: 'en_US-hfc_female-medium', rate: 1.1, preservePitch: false },
    speech: { rate: 1.06, pitch: 1.45, prefer: [/Jenny|Aria|Samantha|Zira|Google UK English Female/i] },
  },
};

export function voiceThemeOf(world: World): VoiceTheme {
  return world === 'panda' || world === 'penguin' || world === 'rabbit' ? world : 'default';
}

export function themeVoice(theme: VoiceTheme): ThemeVoice {
  return THEME_VOICES[theme];
}
