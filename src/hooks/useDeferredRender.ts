import { useState, useEffect } from 'react';

/**
 * Custom hook to defer heavy UI renders (e.g. Recharts, heavy tables)
 * until after the primary UI frame (KPI cards) has mounted and painted.
 * 
 * @param delayMs Delay in milliseconds before setting renderDeferred to true (default: 80ms)
 */
export function useDeferredRender(delayMs: number = 80): boolean {
  const [renderDeferred, setRenderDeferred] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRenderDeferred(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs]);

  return renderDeferred;
}
