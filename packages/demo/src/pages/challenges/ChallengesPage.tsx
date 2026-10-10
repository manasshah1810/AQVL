import React, { useEffect } from 'react';
import { href, parseHash, useHash } from '../../lib/router';
import { pinWorld } from '../../lib/world';
import { CompleteHub } from './complete/Hub';
import { Runner } from './complete/Runner';
import { getChallenge } from './complete/modes';
import { SECTIONS, type ChallengeSection } from './sections';
import './challenges.css';

/**
 * /challenges: three sections, one per kind of challenge.
 *   #/challenges                         the sections (Complete the Algorithm open)
 *   #/challenges/<section>               one section
 *   #/challenges/complete/<challenge id> a Complete the Algorithm challenge
 * Challenges always use the plain studio world, so the whole page shows it
 * while it is open (the visitor's own choice is put back on the way out).
 */
export default function ChallengesPage() {
  const route = parseHash(useHash());
  const [sectionId, challengeId] = route.rest;

  useEffect(() => pinWorld('studio'), []);

  if (sectionId === 'complete' && challengeId) {
    const challenge = getChallenge(challengeId);
    if (challenge) return <Runner key={challenge.id} challenge={challenge} />;
    return (
      <Scroll>
        <div className="page ch-page">
          <h1 className="headline">No such challenge.</h1>
          <p className="muted mt-4">
            <a className="ulink" href={href('/challenges/complete')}>
              See every challenge
            </a>
          </p>
        </div>
      </Scroll>
    );
  }

  const section = SECTIONS.find((s) => s.id === sectionId) ?? SECTIONS[0];
  return (
    <Scroll>
      <div className="page ch-page">
        <header className="ch-intro">
          <p className="mono muted">Challenges</p>
          <h1 className="headline">Watching teaches how it behaves. Writing it teaches whether you understood.</h1>
          <p className="lede muted mt-4">Make the decisions an algorithm makes, then watch the consequence of each one on the plain studio stage.</p>
        </header>

        <nav className="ch-sections" aria-label="Kinds of challenge">
          {SECTIONS.map((s) => (
            <SectionTab key={s.id} section={s} active={s.id === section.id} />
          ))}
        </nav>

        {section.status === 'live' ? (
          <CompleteHub />
        ) : (
          <div className="ch-soon">
            <p className="title">{section.title} is next.</p>
            <p className="muted mt-2">{section.blurb}</p>
            <p className="muted mt-2">It will open here, alongside Complete the Algorithm. Until then, try that one.</p>
            <a className="btn btn--sm mt-4" href={href('/challenges/complete')}>
              Complete the Algorithm <span className="arrow">→</span>
            </a>
          </div>
        )}
      </div>
    </Scroll>
  );
}

function SectionTab({ section, active }: { section: ChallengeSection; active: boolean }) {
  return (
    <a className={`ch-section${active ? ' is-on' : ''}`} href={href(`/challenges/${section.id}`)} aria-current={active ? 'page' : undefined}>
      <span className="margin-num">{section.number}</span>
      <span className="ch-section__title">{section.title}</span>
      <span className="ch-section__blurb muted">{section.blurb}</span>
      {section.status === 'soon' && <span className="ch-section__soon mono">Coming next</span>}
    </a>
  );
}

/** The app frame does not scroll; the list pages do, inside it. */
function Scroll({ children }: { children: React.ReactNode }) {
  return <div className="ch-scroll">{children}</div>;
}
