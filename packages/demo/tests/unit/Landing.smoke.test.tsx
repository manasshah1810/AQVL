/**
 * Smoke test confirming the demo app's test infrastructure (vitest + jsdom +
 * React Testing Library) is wired correctly — not real feature coverage.
 *
 * Renders the Landing page (the app's default `#/` route in main.tsx) rather
 * than the IDE (`App.tsx`), since the IDE mounts AQVECanvas, a
 * react-three-fiber/WebGL canvas that jsdom cannot render.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Landing from '../../src/pages/Landing';

describe('Landing page smoke test', () => {
  it('renders without crashing', () => {
    render(<Landing />);
    expect(document.body).toBeTruthy();
  });

  it('renders the AQVL brand name somewhere on the page', () => {
    render(<Landing />);
    expect(screen.getAllByText(/AQVL/i).length).toBeGreaterThan(0);
  });
});
