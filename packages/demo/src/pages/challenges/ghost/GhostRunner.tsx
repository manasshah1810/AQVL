import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Playhead, type StageProjector } from '@aqvl/renderer';
import { Visualizer } from '../../../components/visualizer/Visualizer';
import { spring, usePrefersReducedMotion } from '../../../lib/motion';
import { href } from '../../../lib/router';
import { useTheme } from '../../../lib/theme';
import { Stars } from '../complete/Stars';
import { GhostLayer, type Placed } from './GhostLayer';
import { PAR, awayText, capFor, gradePoint, nextPuzzleId, puzzlesOf, summarize, type Puzzle, type PointResult } from './puzzle';
import { recordGhost, useGhostProgress } from './progress';
import type { Kernel } from '../complete/types';

type Phase = 'intro' | 'playing' | 'asking' | 'locked' | 'feedback' | 'done';

const EPS = 1e-6;

/** "2 slots away", or one per ghost when several missed: "first 1 slot away, second 2 slots away". */
function missed(r: PointResult): string {
  const misses = r.asks.filter((a) => a.gap.distance !== 0);
  return misses.length === 1 && r.asks.length === 1 ? awayText(misses[0].gap) : misses.map((a) => `${a.ask.ghost} ${awayText(a.gap)}`).join(', ');
}

export function GhostRunner({ kernel, run }: { kernel: Kernel; run: number }) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'none' } | { status: 'ready'; puzzle: Puzzle }>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    void puzzlesOf(kernel).then((all) => live && setState(all[run] ? { status: 'ready', puzzle: all[run] } : { status: 'none' }));
    return () => {
      live = false;
    };
  }, [kernel, run]);

  if (state.status === 'ready') return <Play key={state.puzzle.id} puzzle={state.puzzle} />;
  return (
    <div className="ch-run">
      <section className="ch-run__side" aria-label="Challenge">
        <a className="ch-back mono" href={href('/challenges/ghost')}>
          ← All challenges
        </a>
        <h1 className="ch-run__title">{kernel.title}</h1>
        <p className="ch-note">{state.status === 'loading' ? 'Recording the run…' : 'This algorithm draws nothing to point at: it works on plain numbers, so there is no piece to move. Pick another one.'}</p>
      </section>
      <section className="ch-run__stage" aria-label="Stage">
        <div className="ch-stage">
          <div className="ch-stage__empty">
            <p className="title">{state.status === 'loading' ? 'Getting the run ready…' : 'Nothing to place here.'}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Play({ puzzle }: { puzzle: Puzzle }) {
  const { kernel, points, trace } = puzzle;
  const theme = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const best = useGhostProgress()[puzzle.id];
  const projectorRef = useRef<StageProjector | null>(null);

  const playhead = useMemo(() => new Playhead(trace), [trace]);
  useEffect(() => () => playhead.dispose(), [playhead]);

  const [phase, setPhaseState] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<Placed>({});
  const [rewinds, setRewinds] = useState(0);
  const [results, setResults] = useState<PointResult[]>([]);

  // The refs the playhead's tick reads: it runs outside React's render.
  const phaseRef = useRef<Phase>('intro');
  const indexRef = useRef(0);
  const limitStep = useRef(0);
  const guard = useRef(false);
  const rewound = useRef(false);
  const rewindsRef = useRef(0);

  const enter = useCallback(
    (next: Phase, i: number) => {
      phaseRef.current = next;
      indexRef.current = i;
      setPhaseState(next);
      setIndex(i);
      const p = points[i];
      limitStep.current = next === 'done' ? Infinity : next === 'locked' || next === 'feedback' ? p.frame : next === 'intro' ? 0 : p.frame - 1;
    },
    [points],
  );

  const limitTime = () => (Number.isFinite(limitStep.current) ? playhead.timeOfStep(limitStep.current) : Infinity);

  const arrive = useCallback(() => {
    if (phaseRef.current === 'playing') {
      rewindsRef.current = 0;
      rewound.current = false;
      setRewinds(0);
      setPlaced({});
      enter('asking', indexRef.current);
    } else if (phaseRef.current === 'locked') {
      enter('feedback', indexRef.current);
    }
  }, [enter]);

  // Hold the run where the phase says: before the step while asking (nothing past it can be seen), after it once locked.
  useEffect(
    () =>
      playhead.onTick((t) => {
        if (guard.current) return;
        const lim = limitTime();
        const ph = phaseRef.current;
        const waiting = ph === 'playing' || ph === 'locked';
        if (t > lim + EPS || (waiting && t >= lim - EPS)) {
          guard.current = true;
          playhead.jumpToStep(limitStep.current);
          guard.current = false;
          arrive();
          return;
        }
        if (ph === 'asking') {
          if (t < lim - 0.02) {
            if (!rewound.current) {
              rewound.current = true;
              rewindsRef.current += 1;
              setRewinds(rewindsRef.current);
            }
          } else rewound.current = false;
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playhead, arrive],
  );

  const goTo = useCallback(
    (i: number) => {
      enter('playing', i);
      if (playhead.time >= playhead.timeOfStep(points[i].frame - 1) - EPS) {
        guard.current = true;
        playhead.jumpToStep(points[i].frame - 1);
        guard.current = false;
        arrive();
      } else playhead.play();
    },
    [enter, playhead, points, arrive],
  );

  const start = () => {
    setResults([]);
    guard.current = true;
    playhead.restart();
    guard.current = false;
    goTo(0);
  };

  const point = points[index];
  const current = results[index] && (phase === 'locked' || phase === 'feedback') ? results[index] : null;
  const allPlaced = point.asks.every((a) => placed[a.id]);

  const lock = () => {
    if (!allPlaced) return;
    const r = gradePoint(trace, point, placed, rewindsRef.current);
    setResults((prev) => [...prev.slice(0, index), r]);
    enter('locked', index);
    playhead.play();
  };

  const next = () => {
    if (index + 1 < points.length) goTo(index + 1);
    else {
      enter('done', index);
      const s = summarize(results);
      recordGhost(puzzle.id, { stars: s.stars, score: s.accuracy });
    }
  };

  const summary = summarize(results);
  const [moving, setMoving] = useState(false);
  const goNext = async () => {
    setMoving(true);
    const id = await nextPuzzleId(puzzle);
    setMoving(false);
    window.location.hash = `#/challenges/ghost/${id}`;
  };

  const stageLabel =
    phase === 'intro'
      ? 'The run starts here'
      : phase === 'done'
        ? 'The whole run: replay it with the transport below'
        : `Prediction ${index + 1} of ${points.length} · ${phase === 'playing' ? 'playing to the pause' : phase === 'asking' ? `paused before step ${point.frame}` : phase === 'locked' ? `step ${point.frame} playing` : `step ${point.frame} played`}`;

  return (
    <div className="ch-run gm-run">
      <section className="ch-run__side" aria-label="Challenge">
        <header className="ch-run__head">
          <a className="ch-back mono" href={href('/challenges/ghost')}>
            ← All challenges
          </a>
          <p className="ch-run__meta mono">
            <span className="ch-mode-badge">G</span> Ghost Move · {kernel.topic} · {kernel.difficulty} · run {puzzle.run + 1}
            {best && best.stars > 0 && (
              <span className="ch-run__best">
                {' '}
                · best <Stars count={best.stars} small />
                {best.bestScore !== undefined && ` ${Math.round(best.bestScore * 100)}%`}
              </span>
            )}
          </p>
          <h1 className="ch-run__title">{kernel.title}</h1>
          <p className="ch-run__goal">The run pauses before a step. Drag the ghost to where you think it lands, lock in, and watch the real step.</p>
        </header>

        <ol className="gm-steps" aria-label="Predictions">
          {points.map((p, i) => {
            const r = results[i];
            const state = r && (i < index || phase === 'feedback' || phase === 'done') ? (r.hit ? 'hit' : r.score > 0 ? 'near' : 'miss') : i === index && phase !== 'intro' && phase !== 'done' ? 'now' : '';
            return (
              <li key={i} className={`gm-step ${state ? `is-${state}` : ''}`} aria-current={i === index && phase !== 'done' && phase !== 'intro' ? 'step' : undefined}>
                <span className="gm-step__n mono">{i + 1}</span>
                <span className="gm-step__cat">{p.category}</span>
              </li>
            );
          })}
        </ol>

        {phase === 'intro' && (
          <div className="ch-note gm-card">
            <p>
              {points.length} predictions in a short run of <b>{kernel.title}</b>. At each one the run stops just before a step: place the ghost where the step lands. A near miss still earns partial credit, and rewinding to re-read the scene lowers what that prediction can score.
            </p>
            <button type="button" className="btn btn--sm mt-3" onClick={start}>
              Start the run <span className="arrow">→</span>
            </button>
          </div>
        )}

        {phase === 'playing' && <p className="ch-note gm-card">Playing to the next pause…</p>}

        {phase === 'asking' && (
          <section className="gm-card gm-question" aria-label="Question">
            <p className="mono muted">{point.category}</p>
            <h2 className="gm-question__text">{point.question}</h2>
            <ul className="gm-asks">
              {point.asks.map((a) => (
                <li key={a.id} className={placed[a.id] ? 'is-set' : ''}>
                  <span className="gm-asks__ghost">{a.ghost}</span>
                  <span className="muted">{placed[a.id] ? `on ${point.targets.find((t) => t.id === placed[a.id])?.label}` : 'not placed yet'}</span>
                </li>
              ))}
            </ul>
            <p className="mono muted gm-question__cap">
              {rewinds === 0 ? 'Full marks available.' : `${rewinds} rewind${rewinds === 1 ? '' : 's'}: this prediction now scores at most ${Math.round(capFor(rewinds) * 100)}%.`} You may scrub back to re-read the scene.
            </p>
            <div className="ch-actions">
              <button type="button" className="btn btn--sm" disabled={!allPlaced} onClick={lock}>
                Lock in <span className="arrow">→</span>
              </button>
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => setPlaced({})} disabled={Object.values(placed).every((v) => !v)}>
                Reset ghosts
              </button>
              {!allPlaced && <span className="mono muted ch-actions__why">Place every ghost first.</span>}
            </div>
          </section>
        )}

        {(phase === 'locked' || phase === 'feedback') && current && (
          <motion.section className={`gm-card gm-verdict ${current.hit ? 'is-hit' : 'is-miss'}`} role="status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: spring.gentle }}>
            <p className="mono muted">{current.point.category}</p>
            {phase === 'locked' ? (
              <h2 className="gm-question__text">Watch the real step…</h2>
            ) : (
              <>
                <h2 className="gm-question__text">{current.hit ? 'Exactly right.' : current.score > 0 ? `Close: ${missed(current)}.` : 'Not this time.'}</h2>
                <p>{current.point.outcome}</p>
                {current.asks.some((a) => a.gap.distance !== 0) && (
                  <ul className="gm-asks">
                    {current.asks.map((a) => (
                      <li key={a.ask.id} className={a.gap.distance === 0 ? 'is-set' : ''}>
                        <span className="gm-asks__ghost">{a.ask.ghost}</span>
                        <span className="muted">{a.gap.distance === 0 ? 'right on' : `${awayText(a.gap)}: it was ${current.point.targets.find((t) => t.id === a.answer)?.label}`}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mono muted gm-question__cap">
                  {Math.round(current.score * 100)}% of a point{current.rewinds > 0 ? ` (capped at ${Math.round(current.cap * 100)}% after ${current.rewinds} rewind${current.rewinds === 1 ? '' : 's'})` : ''}.
                </p>
                <button type="button" className="btn btn--sm mt-3" onClick={next}>
                  {index + 1 < points.length ? 'Next prediction' : 'See the result'} <span className="arrow">→</span>
                </button>
              </>
            )}
          </motion.section>
        )}

        {phase === 'done' && (
          <motion.section className="ch-verdict gm-result" role="status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: spring.gentle }}>
            <Stars count={summary.stars} />
            <div>
              <p className="ch-verdict__title">{Math.round(summary.accuracy * 100)}% accurate</p>
              <p className="muted">
                Par is {Math.round(PAR * 100)}%. {summary.accuracy >= PAR ? 'Par beaten.' : 'Below par: try again for the bonus star.'}
              </p>
              <ul className="gm-cats" aria-label="Accuracy by kind of step">
                {summary.byCategory.map((c) => (
                  <li key={c.category}>
                    <span>{c.category}</span>
                    <b className="mono">
                      {c.hits}/{c.total}
                    </b>
                  </li>
                ))}
              </ul>
              <div className="ch-verdict__actions">
                <button type="button" className="btn btn--quiet btn--sm" onClick={start}>
                  Play again
                </button>
                <button type="button" className="btn btn--sm" onClick={() => void goNext()} disabled={moving}>
                  Next puzzle <span className="arrow">→</span>
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </section>

      <section className="ch-run__stage" aria-label="Stage">
        <p className="ch-stage-label mono">{stageLabel}</p>
        <div className="ch-stage">
          <Visualizer
            trace={trace}
            playhead={playhead}
            source={puzzle.source}
            theme={theme}
            reducedMotion={reducedMotion}
            world="studio"
            projectorRef={projectorRef}
            overlay={
              (phase === 'asking' || phase === 'locked' || phase === 'feedback') && (
                <GhostLayer key={index} projectorRef={projectorRef} point={point} trace={trace} placed={placed} onPlace={(a, t) => setPlaced((p) => ({ ...p, [a]: t }))} result={current} playing={phase === 'locked'} />
              )
            }
          />
        </div>
      </section>
    </div>
  );
}
