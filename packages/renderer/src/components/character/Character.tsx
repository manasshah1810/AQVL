/**
 * Character — the teaching character's visual presence.
 *
 * A lightweight expressive sprite (SVG silhouette, not a rigged 3D model —
 * scoped deliberately small so it ships) that renders whatever
 * `CharacterController` is currently saying as a callout near itself,
 * instead of a disembodied caption. Any topic wires this up the same way:
 *
 *   const controller = useMemo(() => new CharacterController(), []);
 *   useEffect(() => { controller.attach(engine.eventDispatcher); return () => controller.detach(); }, [engine]);
 *   <Character controller={controller} resolveAnchor={(targets) => projectToScreen(targets)} />
 *
 * `resolveAnchor` is the only topic-specific piece: it turns whatever a
 * `NARRATIVE_CUE`'s `targets` (or a manual `say(..., {pointAt})`) contains
 * into a screen position, since only the calling topic knows its own
 * element/position shape. Returning null docks the character at its default
 * corner position with no pointing line.
 */
import React, { useEffect, useState } from 'react';
import type { CharacterController, CharacterEmotion, CharacterLine } from './CharacterController';

export interface ScreenAnchor {
  x: number;
  y: number;
}

export interface CharacterProps {
  controller: CharacterController;
  /** Resolves a line's `pointAt` payload to a screen position, or null to dock at the default corner with no pointer. */
  resolveAnchor?: (pointAt: unknown) => ScreenAnchor | null;
  /**
   * A live screen position for the current line's target (see CharacterAnchor.tsx).
   * When it has one, the character stands beside the element and reaches out to
   * it with its arm, following it as it moves. Takes precedence over resolveAnchor.
   */
  anchorSource?: { get(): ScreenAnchor | null; subscribe(listener: (a: ScreenAnchor | null) => void): () => void };
  /** Default docked position when there's nothing to point at. */
  dockPosition?: ScreenAnchor;
  className?: string;
}

/** How far up-left of the element the character stands while pointing at it. */
const REACH_X = 90;
const REACH_Y = 70;

const EMOTION_EXPRESSIONS: Record<CharacterEmotion, { mouth: string; browTilt: number; label: string }> = {
  neutral: { mouth: 'M -8 6 Q 0 6 8 6', browTilt: 0, label: 'neutral' },
  thinking: { mouth: 'M -6 7 Q 0 4 6 7', browTilt: -6, label: 'thinking' },
  pointing: { mouth: 'M -8 5 Q 0 10 8 5', browTilt: 4, label: 'pointing, explaining' },
  confused: { mouth: 'M -7 8 Q 0 3 7 8', browTilt: -12, label: 'confused' },
  celebrating: { mouth: 'M -9 4 Q 0 14 9 4', browTilt: 10, label: 'celebrating' },
};

export const Character: React.FC<CharacterProps> = ({
  controller,
  resolveAnchor,
  anchorSource,
  dockPosition = { x: 24, y: 24 },
  className,
}) => {
  const [line, setLine] = useState<CharacterLine | null>(controller.getCurrentLine());

  const [liveAnchor, setLiveAnchor] = useState<ScreenAnchor | null>(anchorSource?.get() ?? null);

  useEffect(() => controller.subscribe(setLine), [controller]);
  useEffect(() => (anchorSource ? anchorSource.subscribe(setLiveAnchor) : undefined), [anchorSource]);

  // Gesturing: stand up-left of the element and reach down to it.
  const reachTo = line && liveAnchor ? liveAnchor : null;
  const anchor = reachTo
    ? { x: Math.max(40, reachTo.x - REACH_X), y: Math.max(96, reachTo.y - REACH_Y) }
    : (line?.pointAt != null && resolveAnchor?.(line.pointAt)) || null;
  const position = anchor ?? dockPosition;
  // Arm vector from the body's centre (svg origin sits ~24px above the anchor point) to the element.
  const arm = reachTo ? { dx: reachTo.x - position.x, dy: reachTo.y - (position.y - 24) } : null;
  const armAngle = arm ? Math.atan2(arm.dy, arm.dx) : 0;
  const armLength = arm ? Math.hypot(arm.dx, arm.dy) : 0;
  const emotion = line?.emotion ?? 'neutral';
  const expression = EMOTION_EXPRESSIONS[emotion];

  return (
    <div
      className={className}
      aria-live="polite"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)',
        transition: 'left 260ms cubic-bezier(0.22, 1, 0.36, 1), top 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      {line && (
        <div
          role="status"
          style={{
            marginBottom: 6,
            maxWidth: 220,
            padding: '6px 10px',
            borderRadius: 10,
            background: 'rgba(15, 23, 42, 0.92)',
            color: '#f1f5f9',
            fontSize: 12,
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
            textAlign: 'center',
          }}
        >
          {line.text}
        </div>
      )}
      {arm && (
        <svg
          aria-hidden
          style={{ position: 'absolute', left: '50%', bottom: 24, overflow: 'visible', pointerEvents: 'none' }}
          width="1"
          height="1"
        >
          {/* The reach: a dotted line from the hand to the element, ending in a pulse ring. */}
          <g transform={`rotate(${(armAngle * 180) / Math.PI})`}>
            <line x1="22" y1="0" x2={Math.max(22, armLength - 10)} y2="0" stroke="#c4b5fd" strokeWidth={1.6} strokeDasharray="3 4" opacity={0.85} />
          </g>
          <circle cx={arm.dx} cy={arm.dy} r="7" fill="none" stroke="#c4b5fd" strokeWidth={1.6} opacity={0.9}>
            <animate attributeName="r" values="5;9;5" dur="1.2s" repeatCount="indefinite" />
          </circle>
        </svg>
      )}
      <svg width="40" height="48" viewBox="-20 -24 40 48" aria-label={`Character, ${expression.label}`}>
        <ellipse cx="0" cy="0" rx="14" ry="16" fill="#8b5cf6" opacity={0.9} />
        <g stroke="#0f172a" strokeWidth={1.4} strokeLinecap="round" fill="none">
          <line x1="-7" y1={-4 + expression.browTilt * 0.15} x2="-2" y2={-6 + expression.browTilt * -0.15} />
          <line x1="7" y1={-4 + expression.browTilt * 0.15} x2="2" y2={-6 + expression.browTilt * -0.15} />
          <path d={expression.mouth} />
        </g>
        <circle cx="-4" cy="-1" r="1.6" fill="#0f172a" />
        <circle cx="4" cy="-1" r="1.6" fill="#0f172a" />
        {arm && (
          // The pointing arm, swung toward the element.
          <g transform={`rotate(${(armAngle * 180) / Math.PI})`} style={{ transition: 'transform 200ms ease-out' }}>
            <line x1="10" y1="0" x2="21" y2="0" stroke="#8b5cf6" strokeWidth={3} strokeLinecap="round" />
            <circle cx="22" cy="0" r="2.6" fill="#c4b5fd" />
          </g>
        )}
      </svg>
    </div>
  );
};
