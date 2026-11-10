'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Route-level Page Transition Wrapper:
 * - Plays a sleek cyber-red scanline beam on route switches
 * - Triggers hardware-accelerated blur/scale/translate entrance animation for each page
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const [beamKey, setBeamKey] = useState(0);

  useEffect(() => {
    setBeamKey((prev) => prev + 1);
  }, [pathname]);

  return (
    <>
      {beamKey > 0 && (
        <div
          key={`beam-${beamKey}`}
          aria-hidden="true"
          className="pointer-events-none fixed left-0 right-0 top-0 z-50 h-[2px] overflow-hidden"
        >
          <div className="h-full w-full bg-gradient-to-r from-transparent via-avalanche-red to-emerald-400 shadow-[0_0_12px_rgba(232,65,66,0.9)] animate-sweep-beam" />
        </div>
      )}

      <div key={pathname} className="animate-page-enter">
        {children}
      </div>
    </>
  );
}
