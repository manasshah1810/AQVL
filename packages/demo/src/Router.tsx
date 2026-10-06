import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { parseHash, useHash, type RouteName } from './lib/router';
import { LoaderProvider, LoaderWait } from './components/loader/LoaderGate';
import { SiteHeader } from './components/site/SiteHeader';
import { SiteFooter } from './components/site/SiteFooter';
import { WorldSnow } from './components/theme/WorldDecor';
import { spring, usePrefersReducedMotion } from './lib/motion';

const Landing = lazy(() => import('./pages/Landing.tsx'));
const Engine = lazy(() => import('./pages/Engine.tsx'));
const Docs = lazy(() => import('./pages/Docs.tsx'));
const Examples = lazy(() => import('./pages/Examples.tsx'));
const Playground = lazy(() => import('./pages/Playground.tsx'));
const IDE = lazy(() => import('./App.tsx'));
const Privacy = lazy(() => import('./pages/Privacy.tsx'));
const Settings = lazy(() => import('./pages/Settings.tsx'));
const Tasks = lazy(() => import('./pages/tasks/TasksPage.tsx'));
const Developer = lazy(() => import('./pages/developer/DeveloperPage.tsx'));
const NotFound = lazy(() => import('./pages/NotFound.tsx'));

type Chrome = 'site' | 'app' | 'none';

interface RouteDef {
  Page: React.ComponentType;
  chrome: Chrome;
  title: string;
  /** What the loader says while this route's code is downloading. */
  wait: string;
}

const ROUTES: Record<RouteName, RouteDef> = {
  landing: { Page: Landing, chrome: 'site', title: 'AQVL: algorithms, written as code, shown in 3D', wait: 'Loading the overview' },
  engine: { Page: Engine, chrome: 'site', title: 'Engine · AQVL', wait: 'Loading the engine notes' },
  docs: { Page: Docs, chrome: 'app', title: 'Docs · AQVL', wait: 'Loading the documentation' },
  examples: { Page: Examples, chrome: 'site', title: 'Examples · AQVL', wait: 'Loading the example library' },
  playground: { Page: Playground, chrome: 'app', title: 'Playground · AQVL', wait: 'Loading the 3D engine' },
  ide: { Page: IDE, chrome: 'app', title: 'Compiler inspector · AQVL', wait: 'Loading the compiler and 3D engine' },
  privacy: { Page: Privacy, chrome: 'site', title: 'Privacy · AQVL', wait: 'Loading' },
  settings: { Page: Settings, chrome: 'site', title: 'Settings · AQVL', wait: 'Loading the settings' },
  tasks: { Page: Tasks, chrome: 'none', title: 'AQVL · Command Center', wait: 'Loading the command center' },
  developer: { Page: Developer, chrome: 'none', title: 'Developer', wait: 'Loading' },
  notfound: { Page: NotFound, chrome: 'site', title: 'Not found · AQVL', wait: 'Loading' },
};

/** Waits (really) for both typefaces so nothing renders in a fallback face. */
function useFontsReady() {
  const [ready, setReady] = useState(() => typeof document === 'undefined' || !('fonts' in document));
  useEffect(() => {
    if (ready) return;
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setReady(true);
      }
    };
    Promise.all([
      document.fonts.load('400 1em "Newsreader Variable"'),
      document.fonts.load('italic 400 1em "Newsreader Variable"'),
      document.fonts.load('500 1em "JetBrains Mono Variable"'),
    ]).then(finish, finish);
    // Never hold the page hostage to a stalled network.
    const t = window.setTimeout(finish, 4000);
    return () => window.clearTimeout(t);
  }, [ready]);
  return ready;
}

export function Router() {
  const hash = useHash();
  const route = parseHash(hash);
  const def = ROUTES[route.name];
  const fontsReady = useFontsReady();
  const reduced = usePrefersReducedMotion();
  const mainRef = useRef<HTMLElement>(null);
  const firstRoute = useRef(true);

  useEffect(() => {
    document.title = def.title;
  }, [def.title]);

  // After a navigation (not the first load), move focus to the new page so
  // keyboard and screen-reader users start at its top.
  const onEntered = () => {
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  };

  const { Page, chrome } = def;
  const app = chrome === 'app';

  return (
    <MotionConfig reducedMotion="user">
      <LoaderProvider>
        {!fontsReady && <LoaderWait label="Loading typefaces" />}
        {fontsReady && (
          <div className={app ? 'flex h-dvh flex-col overflow-hidden' : 'flex min-h-dvh flex-col'}>
            {chrome !== 'none' && (
              <button
                type="button"
                className="skip-link"
                onClick={() => mainRef.current?.focus()}
              >
                Skip to content
              </button>
            )}
            {chrome === 'site' && <WorldSnow />}
            {chrome !== 'none' && <SiteHeader route={route.name} compact={app} />}
            <AnimatePresence
              mode="wait"
              initial={false}
              onExitComplete={() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })}
            >
              <motion.main
                key={route.name}
                id="main"
                ref={mainRef}
                tabIndex={-1}
                className={`${app ? 'flex min-h-0 flex-1 flex-col outline-none' : 'flex flex-1 flex-col outline-none'} frost-in`}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0, transition: spring.gentle }}
                exit={reduced ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, y: -10, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
                onAnimationComplete={onEntered}
              >
                <Suspense fallback={<LoaderWait label={def.wait} />}>
                  <Page />
                </Suspense>
              </motion.main>
            </AnimatePresence>
            {chrome === 'site' && <SiteFooter />}
          </div>
        )}
      </LoaderProvider>
    </MotionConfig>
  );
}
