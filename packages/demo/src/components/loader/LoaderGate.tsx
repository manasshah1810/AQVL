import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlgoLoader } from './AlgoLoader';
import { spring } from '../../lib/motion';

/**
 * Shows the brand loader only while something real is pending (a route
 * chunk, the 3D engine bundle, the typefaces). Rules:
 *  - nothing appears for waits shorter than SHOW_AFTER (no flash);
 *  - once visible it stays at least MIN_VISIBLE, so it never blinks;
 *  - it exits with a cross-fade into the page.
 */
const SHOW_AFTER = 160;
const MIN_VISIBLE = 900;

interface Gate {
  begin: (label: string) => () => void;
}

const LoaderCtx = createContext<Gate>({ begin: () => () => {} });

export function LoaderProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<{ id: number; label: string }[]>([]);
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);
  const nextId = useRef(0);
  // The label to keep showing while the overlay fades out after the wait ends.
  const [shownLabel, setShownLabel] = useState('Loading');

  const begin = useCallback((label: string) => {
    const id = ++nextId.current;
    setPending((p) => [...p, { id, label }]);
    return () => setPending((p) => p.filter((x) => x.id !== id));
  }, []);

  const active = pending[pending.length - 1]?.label ?? null;

  useEffect(() => {
    if (active && !visible) {
      const t = window.setTimeout(() => {
        shownAt.current = performance.now();
        setShownLabel(active);
        setVisible(true);
      }, SHOW_AFTER);
      return () => window.clearTimeout(t);
    }
    if (!active && visible) {
      const left = Math.max(0, MIN_VISIBLE - (performance.now() - shownAt.current));
      const t = window.setTimeout(() => setVisible(false), left);
      return () => window.clearTimeout(t);
    }
  }, [active, visible]);

  const value = useMemo(() => ({ begin }), [begin]);

  return (
    <LoaderCtx.Provider value={value}>
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18 } }}
            exit={{ opacity: 0, transition: { ...spring.gentle, opacity: { duration: 0.32 } } }}
            className="relative z-[150]"
          >
            <AlgoLoader label={active ?? shownLabel} />
          </motion.div>
        )}
      </AnimatePresence>
    </LoaderCtx.Provider>
  );
}

/** Registers a real wait for as long as this component is mounted. */
export function LoaderWait({ label }: { label: string }) {
  const { begin } = useContext(LoaderCtx);
  useLayoutEffect(() => begin(label), [begin, label]);
  return null;
}
