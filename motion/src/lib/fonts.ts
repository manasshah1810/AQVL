import {loadFont} from '@remotion/google-fonts/JetBrainsMono';

// The film's single typeface. loadFont() blocks rendering until it's ready.
const loaded = loadFont('normal', {weights: ['300', '400', '500', '700'], subsets: ['latin']});
export const fontFamily = loaded.fontFamily;
export const fontReady = loaded.waitUntilDone;
