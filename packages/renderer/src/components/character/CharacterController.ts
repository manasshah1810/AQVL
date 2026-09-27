/**
 * CharacterController — the narrator/teaching-character state machine.
 *
 * There is currently no mascot/avatar layer anywhere in the renderer —
 * `ArrayNarrativeGenerator.ts` (packages/runtime/src/narrative) only ever
 * produces caption TEXT with no visual presence, and until this pass its
 * output (`narrativeText` on an `AnimationTask`) never even reached a UI —
 * see `AnimationScheduler.emitNarrativeCue` for the 'NARRATIVE_CUE' event
 * this class listens for.
 *
 * This is a plain, framework-agnostic subject a `Character` React component
 * subscribes to — kept separate from that component so a topic can also call
 * `say()` directly for one-off character beats that aren't accompanied by an
 * animation task (e.g. "character reacts with surprise on a wrong guess"),
 * without needing a real DOM/canvas present (this class has no React or
 * three.js import, so it's directly unit-testable).
 */

export type CharacterEmotion = 'neutral' | 'thinking' | 'pointing' | 'confused' | 'celebrating';

export interface CharacterLine {
  text: string;
  emotion: CharacterEmotion;
  /**
   * What the character should be reacting to/pointing at, left as `unknown`
   * so any topic's own element/position type can flow through — a
   * `Character` component is given a `resolveAnchor` function that knows how
   * to turn its topic's own targets into a screen position.
   */
  pointAt?: unknown;
  /** How long this line stays on screen before being cleared, ms. */
  durationMs: number;
}

export type CharacterControllerListener = (line: CharacterLine | null) => void;

const DEFAULT_LINE_DURATION_MS = 2600;

/** A source of narrative cues, structurally matching `EventDispatcher` (packages/runtime/src/core/EventDispatcher.ts) without importing it, to keep this class dependency-free. */
export interface NarrativeCueSource {
  on(event: 'NARRATIVE_CUE', handler: (payload: { text: string; targets: unknown }) => void): void;
  off(event: 'NARRATIVE_CUE', handler: (payload: { text: string; targets: unknown }) => void): void;
}

export class CharacterController {
  private listeners: CharacterControllerListener[] = [];
  private current: CharacterLine | null = null;
  private clearTimer: ReturnType<typeof setTimeout> | null = null;
  private source: NarrativeCueSource | null = null;
  private sourceHandler = (payload: { text: string; targets: unknown }) => {
    this.say(payload.text, { pointAt: payload.targets, emotion: 'pointing' });
  };

  /** Attaches to an engine's event dispatcher so every `NARRATIVE_CUE` it emits becomes a spoken line automatically. Call `detach()` (or attach a new source) to stop. */
  attach(source: NarrativeCueSource): void {
    this.detach();
    this.source = source;
    this.source.on('NARRATIVE_CUE', this.sourceHandler);
  }

  detach(): void {
    this.source?.off('NARRATIVE_CUE', this.sourceHandler);
    this.source = null;
  }

  /** Speaks `text` as a callout near the character, optionally pointing at something and/or carrying an emotion. Any topic can call this directly for reactions that aren't tied to an animation task (a wrong comparison, a confirmed find, ...). */
  say(text: string, options: { emotion?: CharacterEmotion; pointAt?: unknown; durationMs?: number } = {}): void {
    if (this.clearTimer) clearTimeout(this.clearTimer);
    this.current = {
      text,
      emotion: options.emotion ?? 'neutral',
      pointAt: options.pointAt,
      durationMs: options.durationMs ?? DEFAULT_LINE_DURATION_MS,
    };
    this.notify();
    this.clearTimer = setTimeout(() => {
      this.current = null;
      this.notify();
    }, this.current.durationMs);
  }

  /** Clears the current line immediately (e.g. on scene reset). */
  clear(): void {
    if (this.clearTimer) clearTimeout(this.clearTimer);
    this.clearTimer = null;
    this.current = null;
    this.notify();
  }

  getCurrentLine(): CharacterLine | null {
    return this.current;
  }

  subscribe(listener: CharacterControllerListener): () => void {
    this.listeners.push(listener);
    listener(this.current);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.current));
  }
}
