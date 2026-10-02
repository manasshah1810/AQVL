import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// vitest.config.ts doesn't set `test.globals: true`, so React Testing
// Library's own auto-cleanup (which looks for a global `afterEach`) never
// registers. Without this, each test's rendered tree piles up in
// document.body instead of being unmounted, and testid/role queries that
// expect a single match start failing across tests in the same file.
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement these browser APIs; several landing-page
// components (PipelineSection's scroll-triggered reveal, the
// prefers-reduced-motion check in Landing) call them unconditionally on
// mount, so a bare stub is needed for render() to not throw.
if (typeof window.IntersectionObserver === 'undefined') {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: ReadonlyArray<number> = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
}

if (typeof window.matchMedia === 'undefined') {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

// The visualizer measures its overlays and the scrubber its track.
if (typeof window.ResizeObserver === 'undefined') {
  class MockResizeObserver implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}
