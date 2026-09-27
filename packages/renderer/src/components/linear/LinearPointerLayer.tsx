import React, { useRef, useState } from 'react';
import type { RenderableConnection, Vec3, EdgeRoute } from '../generic/types';
import { PointerArrow } from './PointerArrow';
import { linearRoleAccent } from './linearStates';

interface Ghost {
  key: string;
  from: Vec3;
  to: Vec3;
  route?: EdgeRoute;
}

interface Seen {
  toId: string;
  from: Vec3;
  to: Vec3;
  route?: EdgeRoute;
}

export interface PointerDiff {
  /** Pointers whose target changed or that disappeared: the OLD arrow, to retract. */
  retired: { id: string; toId: string }[];
}

/** Which pointers changed target or vanished between two renders (pure, for tests). */
export function diffPointers(previous: Map<string, { toId: string }>, current: RenderableConnection[]): PointerDiff {
  const now = new Map(current.map((c) => [c.id, c.toId]));
  const retired: { id: string; toId: string }[] = [];
  for (const [id, seen] of previous) {
    if (now.get(id) !== seen.toId) retired.push({ id, toId: seen.toId });
  }
  return { retired };
}

/**
 * Renders a linked list's `next` / `prev` pointers so every change is
 * watchable: a new pointer draws itself from its owner to its target; a
 * reassigned one (`prev.next = temp.next`) keeps its old arrow on screen,
 * withdrawing and fading, while the new arrow draws to the new target; a
 * pointer set to NULL retracts into its owner.
 *
 * Each arrow is keyed by pointer AND target, so a new target mounts a fresh,
 * drawing arrow rather than silently re-aiming the old one.
 */
export const LinearPointerLayer: React.FC<{ connections: RenderableConnection[] }> = ({ connections }) => {
  const seen = useRef(new Map<string, Seen>());
  const ghosts = useRef(new Map<string, Ghost>());
  const [, setVersion] = useState(0);

  const { retired } = diffPointers(seen.current, connections);
  for (const { id, toId } of retired) {
    const old = seen.current.get(id)!;
    const key = `${id}|${toId}|ghost`;
    ghosts.current.set(key, { key, from: old.from, to: old.to, route: old.route });
  }
  const next = new Map<string, Seen>();
  for (const c of connections) {
    next.set(c.id, { toId: c.toId, from: c.from, to: c.to, route: c.route });
    // Pointing back at a target whose old arrow is still withdrawing: the new one replaces it.
    ghosts.current.delete(`${c.id}|${c.toId}|ghost`);
  }
  seen.current = next;

  const removedAccent = linearRoleAccent('removed');
  return (
    <>
      {[...ghosts.current.values()].map((g) => (
        <PointerArrow
          key={g.key}
          from={g.from}
          to={g.to}
          route={g.route}
          mode="retract"
          retractColor={removedAccent}
          onDone={() => {
            ghosts.current.delete(g.key);
            setVersion((v) => v + 1);
          }}
        />
      ))}
      {connections.map((c) => (
        <PointerArrow
          key={`${c.id}|${c.toId}`}
          from={c.from}
          to={c.to}
          route={c.route}
          color={c.color}
          emissiveColor={c.emissiveColor}
          highlightState={c.highlightState}
          mode="draw"
        />
      ))}
    </>
  );
};
