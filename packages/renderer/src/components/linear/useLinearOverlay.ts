import { useEffect, useState } from 'react';
import type { LinearDirector, LinearOverlayState } from './LinearDirector';

/** The director's latest roles / active ends, or null when no director is running. */
export function useLinearOverlay(director: LinearDirector | null | undefined): LinearOverlayState | null {
  const [overlay, setOverlay] = useState<LinearOverlayState | null>(director ? director.getOverlay() : null);
  useEffect(() => {
    if (!director) {
      setOverlay(null);
      return;
    }
    return director.subscribe(setOverlay);
  }, [director]);
  return overlay;
}
