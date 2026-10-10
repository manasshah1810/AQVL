import React, { useLayoutEffect, useRef, useState } from 'react';
import type { StageProjector } from '@aqvl/renderer';
import { awayText, type Point, type PointResult } from './puzzle';

interface XY {
  x: number;
  y: number;
}

/** How near (in pixels) a dropped ghost must be to a target to land on it. */
const SNAP = 52;
const MARGIN = 18;

export type Placed = Record<string, string | null>;

interface Props {
  projectorRef: React.MutableRefObject<StageProjector | null>;
  /** The prediction being asked, or just played. */
  point: Point;
  trace: StageProjector['model']['trace'];
  placed: Placed;
  onPlace: (askId: string, targetId: string | null) => void;
  /** Set once the step has been locked in: the layer shows the verdict and takes no more input. */
  result: PointResult | null;
  /** True while the real step is still playing (the verdict appears when it lands). */
  playing: boolean;
}

/**
 * The drag layer on top of the stage. Each target sits on the real 3D node
 * (the live camera projects the node's resting position every frame), the
 * ghosts wait in a tray and are dragged — or clicked, then clicked onto a
 * target — to where the learner thinks the step lands. Where the stage has no
 * camera to project with (no WebGL), the targets are laid out in a grid so the
 * challenge still works. Keyed by prediction, so each one starts with nothing picked up.
 */
export function GhostLayer({ projectorRef, point, trace, placed, onPlace, result, playing }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Record<string, XY>>({});
  const [drag, setDrag] = useState<{ ask: string; at: XY; start: XY; moved: boolean } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  // A pointer press already handled its own select / drop; the click that follows it must not repeat it.
  const byPointer = useRef(false);

  // Follow the live camera.
  useLayoutEffect(() => {
    let raf = 0;
    let dead = false;
    const tick = () => {
      if (dead) return;
      const el = box.current;
      const w = el?.clientWidth || 800;
      const h = el?.clientHeight || 520;
      const proj = projectorRef.current;
      const next: Record<string, XY> = {};
      const model = proj && proj.model.trace === trace ? proj.model : null;
      const rest = model ? model.rest(point.frame - 1) : null;
      const cols = Math.min(8, Math.max(2, Math.ceil(Math.sqrt(point.targets.length * 2))));
      point.targets.forEach((t, i) => {
        let at: XY | null = null;
        if (proj && model && rest) {
          const slot = model.slotOf.get(t.nodeId);
          if (slot !== undefined && rest.present[slot]) {
            const o = t.offset ?? [0, 0, 0];
            // Just above the node's top, so the marker never covers its value.
            const top = rest.dims[slot * 3 + 1] / 2 + 0.45;
            const p = proj.project(rest.pos[slot * 3] + o[0], rest.pos[slot * 3 + 1] + o[1] + top, rest.pos[slot * 3 + 2] + o[2]);
            if (p.visible) at = { x: (p.x / proj.width) * w, y: (p.y / proj.height) * h };
          }
        }
        if (!at) {
          const rows = Math.ceil(point.targets.length / cols);
          at = { x: ((i % cols) + 0.5) * (w / cols), y: h * 0.2 + (Math.floor(i / cols) + 0.5) * Math.min(70, (h * 0.5) / rows) };
        }
        next[t.id] = { x: Math.max(MARGIN, Math.min(w - MARGIN, at.x)), y: Math.max(MARGIN + 60, Math.min(h - MARGIN - 70, at.y)) };
      });
      setPos((prev) => {
        const same = point.targets.every((t) => prev[t.id] && Math.abs(prev[t.id].x - next[t.id].x) < 0.6 && Math.abs(prev[t.id].y - next[t.id].y) < 0.6);
        return same ? prev : next;
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
    };
  }, [projectorRef, point, trace]);

  const locked = result !== null;
  const targetAt = (p: XY): string | null => {
    let best: string | null = null;
    let bestD = SNAP;
    for (const t of point.targets) {
      const q = pos[t.id];
      if (!q) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = t.id;
      }
    }
    return best;
  };
  const local = (e: React.PointerEvent): XY => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const place = (ask: string, target: string | null) => {
    // A target holds one ghost: whatever was there goes back to the tray.
    if (target) for (const a of point.asks) if (a.id !== ask && placed[a.id] === target) onPlace(a.id, null);
    onPlace(ask, target);
    setSelected(null);
  };

  const onDown = (e: React.PointerEvent, ask: string) => {
    if (locked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const at = local(e);
    setDrag({ ask, at, start: at, moved: false });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const at = local(e);
    setDrag({ ...drag, at, moved: drag.moved || Math.hypot(at.x - drag.start.x, at.y - drag.start.y) > 5 });
    setHover(targetAt(at));
  };
  const onUp = (e: React.PointerEvent) => {
    if (!drag) return;
    const at = local(e);
    const d = drag;
    byPointer.current = true;
    setDrag(null);
    setHover(null);
    if (!d.moved) {
      setSelected((s) => (s === d.ask ? null : d.ask));
      return;
    }
    place(d.ask, targetAt(at));
  };

  const askOf = (id: string) => point.asks.find((a) => a.id === id)!;
  const inTray = point.asks.filter((a) => !placed[a.id]);
  const labelOf = (id: string | null) => point.targets.find((t) => t.id === id)?.label ?? '';

  const chip = (ask: string, extra = '') => {
    const a = askOf(ask);
    return (
      <button
        key={ask}
        type="button"
        className={`gm-chip${selected === ask ? ' is-selected' : ''}${drag?.ask === ask ? ' is-drag' : ''}${extra}`}
        aria-pressed={selected === ask}
        aria-label={`Ghost ${a.ghost}${placed[ask] ? `, placed on ${labelOf(placed[ask])}` : ', not placed'}`}
        disabled={locked}
        style={drag?.ask === ask && drag.moved ? { transform: `translate(${drag.at.x - drag.start.x}px, ${drag.at.y - drag.start.y}px)`, transition: 'none', position: 'relative', zIndex: 10 } : undefined}
        onPointerDown={(e) => onDown(e, ask)}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => setDrag(null)}
        onClick={() => {
          // Keyboard (Enter / Space) picks the ghost up; then a target takes it.
          if (byPointer.current) {
            byPointer.current = false;
            return;
          }
          setSelected((s) => (s === ask ? null : ask));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setSelected(null);
          if (e.key === 'Delete' || e.key === 'Backspace') place(ask, null);
        }}
      >
        <span className="gm-chip__body">{a.ghost}</span>
      </button>
    );
  };

  const shownLabel = hover;

  return (
    <div className={`gm-layer${locked ? ' is-locked' : ''}`} ref={box} aria-label="Drop targets">
      {/* Targets sit on the real nodes. */}
      {point.targets.map((t) => {
        const at = pos[t.id];
        if (!at) return null;
        const mine = point.asks.filter((a) => placed[a.id] === t.id);
        const right = result?.asks.some((r) => r.answer === t.id);
        return (
          <button
            key={t.id}
            type="button"
            className={`gm-target${hover === t.id ? ' is-near' : ''}${mine.length ? ' is-held' : ''}${selected && !locked ? ' is-open' : ''}${right && !playing ? ' is-answer' : ''}`}
            style={{ left: at.x, top: at.y }}
            aria-label={`Drop here: ${t.label}`}
            title={t.label}
            disabled={locked}
            onClick={() => {
              if (selected) place(selected, t.id);
            }}
            onPointerEnter={() => setHover(t.id)}
            onPointerLeave={() => setHover((h) => (h === t.id ? null : h))}
            onFocus={() => setHover(t.id)}
            onBlur={() => setHover((h) => (h === t.id ? null : h))}
          />
        );
      })}

      {/* Verdict: lines from each ghost to the true spot. */}
      {result && !playing && (
        <svg className="gm-lines" aria-hidden="true">
          {result.asks.map((r) => {
            const p = r.placed ? pos[r.placed] : null;
            const t = pos[r.answer];
            if (!p || !t || r.gap.distance === 0) return null;
            return (
              <g key={r.ask.id}>
                <line x1={p.x} y1={p.y} x2={t.x} y2={t.y} />
                <text x={(p.x + t.x) / 2} y={(p.y + t.y) / 2 - 8} textAnchor="middle">
                  {awayText(r.gap)}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {/* Ghosts pinned on their targets. */}
      {point.asks.map((a) => {
        const r = result?.asks.find((x) => x.ask.id === a.id);
        const target = r && r.gap.distance === 0 && !playing ? r.answer : placed[a.id];
        const at = target ? pos[target] : null;
        if (!at) return null;
        const verdict = r && !playing ? (r.gap.distance === 0 ? ' is-hit' : ' is-miss') : '';
        return (
          <div key={a.id} className="gm-pin" style={{ left: at.x, top: at.y }}>
            {chip(a.id, ` is-pinned${verdict}`)}
          </div>
        );
      })}

      {/* The ghosts still to place. */}
      {!locked && (
        <div className="gm-tray" role="group" aria-label="Ghosts to place">
          {inTray.length === 0 ? <span className="gm-tray__done">All placed. Lock in when you are sure.</span> : inTray.map((a) => chip(a.id))}
          <span className="gm-tray__hint">{selected ? 'Now click the spot where it lands.' : 'Drag a ghost onto the stage, or click it then click a spot.'}</span>
        </div>
      )}

      <div className="gm-hint" aria-live="polite">
        {shownLabel ? labelOf(shownLabel) : ''}
      </div>
    </div>
  );
}
