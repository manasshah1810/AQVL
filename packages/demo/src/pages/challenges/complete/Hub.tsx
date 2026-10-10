import React, { useEffect, useMemo, useRef, useState } from 'react';
import { href, replaceHash } from '../../../lib/router';
import { bestPoints, CHALLENGES, getChallenge, kernelsByTopic, matchesQuery, nextUnsolved, scoreOf } from './modes';
import { hubPath, rememberHubQuery } from './nav';
import { rankOf, resetProgress, useProgressStore, type ChallengeProgress } from './progress';
import { Stars } from './Stars';
import { MODES, TOPICS, type Challenge, type Difficulty, type Mode, type Topic } from './types';
import './complete.css';

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];
type Status = 'all' | 'todo' | 'solved';
const STATUSES: { value: Status; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: 'To do' },
  { value: 'solved', label: 'Solved' },
];

interface Filters {
  q: string;
  topic: Topic | 'all';
  mode: Mode | 'all';
  level: Difficulty | 'all';
  status: Status;
}

const DEFAULTS: Filters = { q: '', topic: 'all', mode: 'all', level: 'all', status: 'all' };

/** Filters from the hash's query (`#/challenges/complete?q=heap&mode=bug`), so a link or Back keeps them. */
function readFilters(params: URLSearchParams): Filters {
  const topic = params.get('topic') as Topic | null;
  const mode = params.get('mode') as Mode | null;
  const level = params.get('level') as Difficulty | null;
  const status = params.get('status') as Status | null;
  return {
    q: params.get('q') ?? '',
    topic: topic && TOPICS.includes(topic) ? topic : 'all',
    mode: mode && MODES.some((m) => m.id === mode) ? mode : 'all',
    level: level && DIFFICULTIES.includes(level) ? level : 'all',
    status: status && STATUSES.some((s) => s.value === status) ? status : 'all',
  };
}

function queryOf(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.topic !== 'all') p.set('topic', f.topic);
  if (f.mode !== 'all') p.set('mode', f.mode);
  if (f.level !== 'all') p.set('level', f.level);
  if (f.status !== 'all') p.set('status', f.status);
  return p.toString();
}

function keep(c: Challenge, f: Filters, progress: Record<string, ChallengeProgress>, ignoreTopic = false): boolean {
  if (!ignoreTopic && f.topic !== 'all' && c.kernel.topic !== f.topic) return false;
  if (f.mode !== 'all' && c.mode !== f.mode) return false;
  if (f.level !== 'all' && c.difficulty !== f.level) return false;
  const solved = (progress[c.id]?.stars ?? 0) > 0;
  if (f.status === 'solved' && !solved) return false;
  if (f.status === 'todo' && solved) return false;
  return matchesQuery(c, f.q);
}

const topicSlug = (t: string) => `topic-${t.toLowerCase().replace(/\s+/g, '-')}`;

/**
 * Complete the Algorithm's list: all 265 challenges (53 algorithms in five
 * modes), with the visitor's score at the top, a search and filters that
 * stay in the address, and the algorithms grouped by topic. Each card shows
 * one algorithm and its five modes, with the stars earned on each.
 */
export function CompleteHub({ params = new URLSearchParams() }: { params?: URLSearchParams }) {
  const { challenges: progress, last } = useProgressStore();
  const [filters, setFilters] = useState<Filters>(() => readFilters(params));
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const searchRef = useRef<HTMLInputElement>(null);

  // The filters live in the address (without a route change), and Back from a challenge returns to them.
  useEffect(() => {
    const q = queryOf(filters);
    rememberHubQuery(q);
    replaceHash(hubPath(q));
  }, [filters]);

  // "/" jumps to the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const score = useMemo(() => scoreOf(progress), [progress]);
  const groups = useMemo(() => kernelsByTopic(), []);
  const shown = useMemo(() => CHALLENGES.filter((c) => keep(c, filters, progress)), [filters, progress]);
  const shownIds = useMemo(() => new Set(shown.map((c) => c.id)), [shown]);
  // Topic counts ignore the topic filter, so the rail always says what each topic would show.
  const topicCounts = useMemo(() => {
    const out = new Map<Topic, { shown: number; solved: number; total: number }>();
    for (const c of CHALLENGES) {
      const t = out.get(c.kernel.topic) ?? { shown: 0, solved: 0, total: 0 };
      t.total++;
      if ((progress[c.id]?.stars ?? 0) > 0) t.solved++;
      if (keep(c, filters, progress, true)) t.shown++;
      out.set(c.kernel.topic, t);
    }
    return out;
  }, [filters, progress]);

  const lastChallenge = last ? getChallenge(last) : undefined;
  const upNext = nextUnsolved(lastChallenge ?? null, progress);
  const filtered = queryOf(filters) !== '';

  return (
    <div className="cx-hub">
      <Scoreboard score={score} onReset={resetProgress} />

      {(lastChallenge || upNext) && (
        <div className="cx-resume">
          {lastChallenge && (
            <a className="cx-resume__card" href={href(`/challenges/complete/${lastChallenge.id}`)}>
              <span className="mono muted">Pick up where you left off</span>
              <span className="cx-resume__title">
                {lastChallenge.kernel.title} <span className="muted">· {MODES.find((m) => m.id === lastChallenge.mode)!.label}</span>
              </span>
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </a>
          )}
          {upNext && upNext.id !== lastChallenge?.id && (
            <a className="cx-resume__card" href={href(`/challenges/complete/${upNext.id}`)}>
              <span className="mono muted">Next unsolved</span>
              <span className="cx-resume__title">
                {upNext.kernel.title} <span className="muted">· {MODES.find((m) => m.id === upNext.mode)!.label}</span>
              </span>
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </a>
          )}
        </div>
      )}

      <div className="cx-modes" role="radiogroup" aria-label="Mode">
        {MODES.map((m) => {
          const on = filters.mode === m.id;
          const solved = CHALLENGES.filter((c) => c.mode === m.id && (progress[c.id]?.stars ?? 0) > 0).length;
          return (
            <button key={m.id} type="button" role="radio" aria-checked={on} aria-label={m.label} className={`cx-mode${on ? ' is-on' : ''}`} onClick={() => set('mode', on ? 'all' : m.id)}>
              <span className="cx-mode__top">
                <span className="ch-mode-badge">{m.letter}</span>
                <span className="cx-mode__name">{m.label}</span>
              </span>
              <span className="cx-mode__blurb">{m.blurb}</span>
              <span className="cx-mode__count mono">
                {solved} / {groups.reduce((n, g) => n + g.kernels.length, 0)} solved
              </span>
            </button>
          );
        })}
      </div>

      <div className="cx-layout">
        <nav className="cx-rail" aria-label="Topics">
          <p className="mono muted cx-rail__label">Topics</p>
          <button type="button" className={`cx-rail__item${filters.topic === 'all' ? ' is-on' : ''}`} onClick={() => set('topic', 'all')} aria-pressed={filters.topic === 'all'}>
            <span>All topics</span>
            <span className="mono">{CHALLENGES.filter((c) => keep(c, filters, progress, true)).length}</span>
          </button>
          {groups.map(({ topic }) => {
            const t = topicCounts.get(topic)!;
            return (
              <button key={topic} type="button" className={`cx-rail__item${filters.topic === topic ? ' is-on' : ''}${t.shown === 0 ? ' is-empty' : ''}`} onClick={() => set('topic', filters.topic === topic ? 'all' : topic)} aria-pressed={filters.topic === topic}>
                <span>{topic}</span>
                <span className="mono">{t.shown}</span>
                <span className="cx-rail__bar" aria-hidden="true">
                  <span style={{ width: `${(t.solved / t.total) * 100}%` }} />
                </span>
              </button>
            );
          })}
        </nav>

        <div className="cx-main">
          <div className="cx-toolbar">
            <label className="cx-search">
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span className="sr-only">Search challenges</span>
              <input ref={searchRef} type="search" placeholder="Search: bubble, BFS, heap, spot the bug…" value={filters.q} onChange={(e) => set('q', e.target.value)} />
              {!filters.q && (
                <kbd className="ch-kbd" aria-hidden="true">
                  /
                </kbd>
              )}
            </label>
            <Segmented label="Difficulty" value={filters.level} onChange={(v) => set('level', v)} options={[{ value: 'all', label: 'Any' }, ...DIFFICULTIES.map((d) => ({ value: d, label: d }))]} />
            <Segmented label="Status" value={filters.status} onChange={(v) => set('status', v)} options={STATUSES} />
            {/* Topic as a select, for narrow screens where the rail is hidden. */}
            <label className="cx-topic-select">
              <span className="mono muted">Topic</span>
              <select value={filters.topic} onChange={(e) => set('topic', e.target.value as Topic | 'all')}>
                <option value="all">All topics</option>
                {groups.map(({ topic }) => (
                  <option key={topic} value={topic}>
                    {topic} ({topicCounts.get(topic)!.shown})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="cx-count mono muted" role="status">
            {shown.length === CHALLENGES.length ? `All ${CHALLENGES.length} challenges` : `${shown.length} of ${CHALLENGES.length} challenges`}
            {filtered && (
              <button type="button" className="cx-clear" onClick={() => setFilters(DEFAULTS)}>
                Clear filters
              </button>
            )}
            <span className="cx-legend" aria-hidden="true">
              A–E are the modes ·
              <span className="cx-dot is-easy" /> Easy
              <span className="cx-dot is-medium" /> Medium
              <span className="cx-dot is-hard" /> Hard
            </span>
          </p>

          {shown.length === 0 && (
            <div className="cx-empty">
              <p className="title">Nothing matches.</p>
              <p className="muted mt-2">Try fewer words, or another topic or mode.</p>
              <button type="button" className="btn btn--sm mt-4" onClick={() => setFilters(DEFAULTS)}>
                Clear filters
              </button>
            </div>
          )}

          {groups.map(({ topic, kernels }) => {
            const cards = kernels.map((k) => ({ k, modes: MODES.filter((m) => shownIds.has(`${k.id}.${m.id}`)) })).filter((x) => x.modes.length > 0);
            if (cards.length === 0) return null;
            const t = topicCounts.get(topic)!;
            return (
              <section key={topic} className="cx-topic" id={topicSlug(topic)} aria-labelledby={`${topicSlug(topic)}-h`}>
                <header className="cx-topic__head">
                  <h2 id={`${topicSlug(topic)}-h`} className="cx-topic__title">
                    {topic}
                  </h2>
                  <span className="mono muted">
                    {t.solved} of {t.total} solved
                  </span>
                </header>
                <ul className="cx-cards">
                  {cards.map(({ k, modes }) => (
                    <li key={k.id} className="cx-card">
                      <div className="cx-card__head">
                        <h3 className="cx-card__title">{k.title}</h3>
                        <span className={`cx-level is-${k.difficulty.toLowerCase()}`}>{k.difficulty}</span>
                      </div>
                      <p className="cx-card__goal">{k.goal}</p>
                      <div className="cx-card__modes">
                        {modes.map((m) => {
                          const c = getChallenge(`${k.id}.${m.id}`)!;
                          const p = progress[c.id];
                          const solved = (p?.stars ?? 0) > 0;
                          return (
                            <a
                              key={m.id}
                              className={`cx-pill${solved ? ' is-solved' : ''}${p && !solved && p.attempts > 0 ? ' is-tried' : ''}`}
                              href={href(`/challenges/complete/${c.id}`)}
                              title={`${m.label} · ${c.difficulty}${solved ? ` · ${bestPoints(c, p)} points` : ''}`}
                              aria-label={`${k.title}: ${m.label}, ${c.difficulty}${solved ? `, ${p!.stars} of 3 stars` : p?.attempts ? ', tried' : ''}`}
                            >
                              <span className="ch-mode-badge">{m.letter}</span>
                              <span className="cx-pill__name">{m.label}</span>
                              {solved ? <Stars count={p!.stars} small /> : <span className={`cx-dot is-${c.difficulty.toLowerCase()}`} aria-hidden="true" />}
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
      </div>
    </div>
  );
}

function Scoreboard({ score, onReset }: { score: ReturnType<typeof scoreOf>; onReset: () => void }) {
  const rank = rankOf(score.points);
  const toNext = rank.next ? (score.points - rank.at) / (rank.next.at - rank.at) : 1;
  const [confirming, setConfirming] = useState(false);
  return (
    <section className="cx-board" aria-label="Your score">
      <div className="cx-board__points">
        <span className="mono muted">Points</span>
        <span className="cx-board__big">{score.points.toLocaleString()}</span>
        <span className="cx-board__rank">
          <b>{rank.title}</b>
          {rank.next && <span className="muted"> · {rank.next.at - score.points} to {rank.next.title}</span>}
        </span>
        <span className="cx-meter" role="progressbar" aria-label={`Progress to ${rank.next?.title ?? 'the top rank'}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(toNext * 100)}>
          <span style={{ width: `${toNext * 100}%` }} />
        </span>
      </div>
      <div className="cx-board__stat">
        <span className="mono muted">Solved</span>
        <span className="cx-board__num">
          {score.solved}
          <span className="muted"> / {score.total}</span>
        </span>
        <span className="cx-meter" aria-hidden="true">
          <span style={{ width: `${(score.solved / score.total) * 100}%` }} />
        </span>
      </div>
      <div className="cx-board__stat">
        <span className="mono muted">Stars</span>
        <span className="cx-board__num">
          {score.stars}
          <span className="muted"> / {score.total * 3}</span>
        </span>
        <span className="cx-meter" aria-hidden="true">
          <span style={{ width: `${(score.stars / (score.total * 3)) * 100}%` }} />
        </span>
      </div>
      <div className="cx-board__how">
        <p className="muted">
          Each star is worth 10 points on an Easy challenge, 20 on Medium and 30 on Hard. Only your best result on each counts. Saved in this browser.
        </p>
        {score.solved + score.stars > 0 &&
          (confirming ? (
            <span className="cx-board__confirm">
              <span className="muted">Erase all progress?</span>
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => {
                  onReset();
                  setConfirming(false);
                }}
              >
                Erase
              </button>
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" className="cx-clear" onClick={() => setConfirming(true)}>
              Reset progress
            </button>
          ))}
      </div>
    </section>
  );
}

function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="cx-seg" role="radiogroup" aria-label={label}>
      <span className="mono muted cx-seg__label">{label}</span>
      <span className="cx-seg__opts">
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={`cx-seg__opt${value === o.value ? ' is-on' : ''}`} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </span>
    </div>
  );
}
