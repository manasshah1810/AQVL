import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react';
import { Lockup } from '../../brand/Logo';
import { ThemeToggle } from './ThemeToggle';
import type { RouteName } from '../../lib/router';
import { spring, usePrefersReducedMotion, waveDelay } from '../../lib/motion';

const NAV: { route: RouteName; label: string; href: string; blurb: string }[] = [
  { route: 'engine', label: 'Engine', href: '#/engine', blurb: 'How layouts and the camera arrange a scene' },
  { route: 'docs', label: 'Docs', href: '#/docs', blurb: 'The .aqvl language, structure by structure' },
  { route: 'examples', label: 'Examples', href: '#/examples', blurb: 'Every program that ships with AQVL' },
  { route: 'challenges', label: 'Challenges', href: '#/challenges', blurb: 'Complete an algorithm and watch your version run' },
];

interface SiteHeaderProps {
  route: RouteName;
  /** App pages (playground, docs) get a fixed, compact bar that never hides. */
  compact?: boolean;
}

export function SiteHeader({ route, compact = false }: SiteHeaderProps) {
  const reduced = usePrefersReducedMotion();
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Long pages: slide away while reading down, return on any upward scroll.
  useMotionValueEvent(scrollY, 'change', (y) => {
    if (compact) return;
    const prev = scrollY.getPrevious() ?? 0;
    setHidden(y > 160 && y > prev + 2);
    if (y < prev - 2 || y < 160) setHidden(false);
  });

  // Close the menu whenever the route changes (derived during render, not in an effect).
  const [menuRoute, setMenuRoute] = useState(route);
  if (menuRoute !== route) {
    setMenuRoute(route);
    setOpen(false);
  }

  return (
    <>
      <motion.header
        className={`${compact ? 'relative' : 'sticky top-0'} z-[60] border-b border-[var(--line)] bg-ink`}
        initial={false}
        animate={{ y: hidden && !open ? '-100%' : '0%' }}
        transition={reduced ? { duration: 0 } : spring.layout}
      >
        <div className={`${compact ? 'px-4 md:px-5' : 'page'} flex ${compact ? 'h-[52px]' : 'h-[64px]'} items-center gap-6`}>
          <a href="#/" className="inline-flex items-center rounded-ctl text-peach transition-colors hover:text-cream" aria-label="AQVL home">
            <Lockup markSize={compact ? 22 : 26} wordHeight={compact ? 13 : 15} />
          </a>

          <nav aria-label="Primary" className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = route === item.route;
              return (
                <a
                  key={item.route}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`nav-link relative px-3 py-2 ${active ? 'text-cream' : 'text-peach'}`}
                >
                  <span className="mono text-[0.875rem]">{item.label}</span>
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-x-3 -bottom-[1px] h-[2px] bg-cream"
                      transition={spring.layout}
                    />
                  )}
                </a>
              );
            })}
            <a
              href="#/playground"
              aria-current={route === 'playground' ? 'page' : undefined}
              className={`btn btn--sm ml-3 ${route === 'playground' ? 'is-on' : ''}`}
            >
              Playground
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </a>
          </nav>

          <SettingsLink route={route} className="hidden md:inline-grid" />
          <ThemeToggle className="hidden md:inline-grid" />

          <SettingsLink route={route} className="ml-auto md:hidden" />
          <ThemeToggle className="md:hidden" />
          <button
            ref={toggleRef}
            type="button"
            className="btn btn--quiet btn--sm md:hidden"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <MobileMenu
            route={route}
            onClose={() => {
              setOpen(false);
              toggleRef.current?.focus();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/** Settings: a small pair of sliders. */
function SettingsLink({ route, className = '' }: { route: RouteName; className?: string }) {
  return (
    <a href="#/settings" className={`icon-btn ${className}`} aria-label="Settings" title="Settings" aria-current={route === 'settings' ? 'page' : undefined}>
      <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M3 6h7M14 6h3M3 14h3M10 14h7" />
        <circle cx="12" cy="6" r="2" />
        <circle cx="8" cy="14" r="2" />
      </svg>
    </a>
  );
}

function MobileMenu({ route, onClose }: { route: RouteName; onClose: () => void }) {
  const firstRef = useRef<HTMLAnchorElement>(null);
  const items = [
    ...NAV,
    { route: 'playground' as RouteName, label: 'Playground', href: '#/playground', blurb: 'Write a program and watch it run' },
    { route: 'settings' as RouteName, label: 'Settings', href: '#/settings', blurb: 'Pick a world: studio, ice or bamboo' },
  ];

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <motion.div
      id="site-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
      className="fixed inset-x-0 bottom-0 top-[64px] z-[55] overflow-y-auto bg-ink md:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      <nav aria-label="Site" className="page flex flex-col pt-6 pb-12">
        {items.map((item, i) => (
          <motion.a
            key={item.route}
            ref={i === 0 ? firstRef : undefined}
            href={item.href}
            aria-current={route === item.route ? 'page' : undefined}
            className="group block border-b border-[var(--line)] py-5"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0, transition: { ...spring.gentle, delay: waveDelay(i, items.length, 0.24) } }}
          >
            <span className={`block font-serif text-[2.2rem] leading-tight ${route === item.route ? 'text-cream italic' : 'text-peach'}`}>
              {item.label}
            </span>
            <span className="mono muted mt-1 block">{item.blurb}</span>
          </motion.a>
        ))}
      </nav>
    </motion.div>
  );
}
