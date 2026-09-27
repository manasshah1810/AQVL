import { useEffect, useState } from 'react';
import type { IterationDirector, IterationOverlayState } from './IterationDirector';

/** The director's latest cursors / search window, or null when no director is running. */
export function useIterationOverlay(director: IterationDirector | null | undefined): IterationOverlayState | null {
  const [overlay, setOverlay] = useState<IterationOverlayState | null>(director ? director.getOverlay() : null);
  useEffect(() => {
    if (!director) {
      setOverlay(null);
      return;
    }
    return director.subscribe(setOverlay);
  }, [director]);
  return overlay;
}
