import React, { useMemo, useState } from 'react';
import { href } from '../../../lib/router';
import { CATALOGUE } from './catalogue';
import { difficultyOf, kernelsByTopic } from './modes';
import { useProgress } from './progress';
import { Stars } from './Stars';
import { MODES, type Difficulty, type Mode } from './types';

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];

/**
 * Complete the Algorithm's list: every algorithm, grouped by topic, each
 * playable in all five modes. Filters narrow by mode and difficulty; the
 * stars earned on each mode are shown on its button.
 */
export function CompleteHub() {
  const progress = useProgress();
  const [mode, setMode] = useState<Mode | 'all'>('all');
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all');
  const groups = useMemo(() => kernelsByTopic(), []);

  const modes = mode === 'all' ? MODES : MODES.filter((m) => m.id === mode);
  const total = CATALOGUE.length * MODES.length;
  const solved = Object.values(progress).filter((p) => p.stars > 0).length;
  const stars = Object.values(progress).reduce((s, p) => s + p.stars, 0);

  return (
    <div className="ch-hub">
      <div className="ch-modes" aria-label="Modes">
        {MODES.map((m) => (
          <div key={m.id} className="ch-modes__item">
            <span className="ch-mode-badge">{m.letter}</span>
            <div>
              <p className="ch-modes__name">{m.label}</p>
              <p className="muted ch-modes__blurb">{m.blurb}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="ch-filters">
        <p className="mono muted">
          {solved} of {total} solved · {stars} stars
        </p>
        <div className="ch-filters__groups">
          <FilterGroup label="Mode" value={mode} onChange={setMode} options={[{ value: 'all', label: 'All' }, ...MODES.map((m) => ({ value: m.id, label: m.label }))]} />
          <FilterGroup label="Difficulty" value={difficulty} onChange={setDifficulty} options={[{ value: 'all', label: 'All' }, ...DIFFICULTIES.map((d) => ({ value: d, label: d }))]} />
        </div>
      </div>

      {groups.map(({ topic, kernels }) => {
        const shown = kernels
          .map((k) => ({ k, modes: modes.filter((m) => difficulty === 'all' || difficultyOf(k, m.id) === difficulty) }))
          .filter((x) => x.modes.length > 0);
        if (shown.length === 0) return null;
        return (
          <section key={topic} className="ch-topic" aria-labelledby={`topic-${topic}`}>
            <h2 id={`topic-${topic}`} className="ch-topic__title">
              {topic}
            </h2>
            <ul className="ch-cards">
              {shown.map(({ k, modes: ms }) => (
                <li key={k.id} className="ch-card">
                  <div className="ch-card__head">
                    <h3 className="ch-card__title">{k.title}</h3>
                    <span className="mono muted">{k.difficulty}</span>
                  </div>
                  <p className="ch-card__goal">{k.goal}</p>
                  <div className="ch-card__modes">
                    {ms.map((m) => {
                      const id = `${k.id}.${m.id}`;
                      const p = progress[id];
                      return (
                        <a key={m.id} className={`ch-card__mode${p && p.stars > 0 ? ' is-solved' : ''}`} href={href(`/challenges/complete/${id}`)} title={`${m.label} · ${difficultyOf(k, m.id)}`} aria-label={`${k.title}: ${m.label}, ${difficultyOf(k, m.id)}${p ? `, ${p.stars} of 3 stars` : ''}`}>
                          <span className="ch-mode-badge">{m.letter}</span>
                          <span className="ch-card__mode-name">{m.label}</span>
                          {p && p.stars > 0 && <Stars count={p.stars} small />}
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
    </div>
  );
}

function FilterGroup<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="ch-filter" role="radiogroup" aria-label={label}>
      <span className="mono muted ch-filter__label">{label}</span>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={`ch-filter__opt${value === o.value ? ' is-on' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
