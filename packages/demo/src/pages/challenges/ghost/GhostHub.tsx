import React, { useEffect, useState } from 'react';
import { href } from '../../../lib/router';
import { CATALOGUE } from '../complete/catalogue';
import { kernelsByTopic } from '../complete/modes';
import { Stars } from '../complete/Stars';
import { useGhostProgress } from './progress';
import { puzzlesOf, type Puzzle } from './puzzle';

/**
 * Ghost Move's list: every algorithm whose run has something to point at,
 * grouped by topic, each with its runs. Which algorithms qualify is found by
 * recording them (a moment, one after another), so nothing is listed by hand.
 */
export function GhostHub() {
  const progress = useGhostProgress();
  const [ready, setReady] = useState<Record<string, Puzzle[]>>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      for (const k of CATALOGUE) {
        const all = await puzzlesOf(k);
        if (!live) return;
        setReady((r) => ({ ...r, [k.id]: all }));
        // Yield so the page stays responsive while the rest are recorded.
        await new Promise((res) => setTimeout(res, 0));
      }
      if (live) setDone(true);
    })();
    return () => {
      live = false;
    };
  }, []);

  const all = Object.values(ready).flat();
  const solved = all.filter((p) => (progress[p.id]?.stars ?? 0) > 0).length;
  const stars = all.reduce((s, p) => s + (progress[p.id]?.stars ?? 0), 0);
  const skipped = done ? CATALOGUE.filter((k) => ready[k.id]?.length === 0) : [];

  return (
    <div className="ch-hub">
      <div className="ch-modes gm-how" aria-label="How Ghost Move works">
        {[
          ['1', 'The run pauses', 'Just before a step, with a few predictions per run.'],
          ['2', 'Drag the ghost', 'Drop the piece that is about to move on the node, slot or position you expect.'],
          ['3', 'Lock in and watch', 'A hit glows; a miss draws a line to the true spot and says how far off you were.'],
        ].map(([n, title, text]) => (
          <div key={n} className="ch-modes__item">
            <span className="ch-mode-badge">{n}</span>
            <div>
              <p className="ch-modes__name">{title}</p>
              <p className="muted ch-modes__blurb">{text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="ch-filters">
        <p className="mono muted">
          {done ? `${solved} of ${all.length} solved · ${stars} stars` : `Recording the runs… ${Object.keys(ready).length} of ${CATALOGUE.length}`}
        </p>
      </div>

      {kernelsByTopic().map(({ topic, kernels }) => {
        const shown = kernels.filter((k) => (ready[k.id]?.length ?? 0) > 0);
        if (shown.length === 0) return null;
        return (
          <section key={topic} className="ch-topic" aria-labelledby={`ghost-topic-${topic}`}>
            <h2 id={`ghost-topic-${topic}`} className="ch-topic__title">
              {topic}
            </h2>
            <ul className="ch-cards">
              {shown.map((k) => (
                <li key={k.id} className="ch-card">
                  <div className="ch-card__head">
                    <h3 className="ch-card__title">{k.title}</h3>
                    <span className="mono muted">{k.difficulty}</span>
                  </div>
                  <p className="ch-card__goal">{k.goal}</p>
                  <div className="ch-card__modes">
                    {ready[k.id].map((p) => {
                      const best = progress[p.id];
                      return (
                        <a
                          key={p.id}
                          className={`ch-card__mode${best && best.stars > 0 ? ' is-solved' : ''}`}
                          href={href(`/challenges/ghost/${p.id}`)}
                          aria-label={`${k.title}: run ${p.run + 1}, ${p.points.length} predictions${best ? `, ${best.stars} of 3 stars` : ''}`}
                        >
                          <span className="ch-mode-badge">{p.run + 1}</span>
                          <span className="ch-card__mode-name">Run {p.run + 1} · {p.points.length} predictions</span>
                          {best && best.stars > 0 && <Stars count={best.stars} small />}
                        </a>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {skipped.length > 0 && (
        <p className="muted gm-skipped">
          Not listed: {skipped.map((k) => k.title).join(', ')}. They work on plain numbers and draw nothing to point at.
        </p>
      )}
    </div>
  );
}
