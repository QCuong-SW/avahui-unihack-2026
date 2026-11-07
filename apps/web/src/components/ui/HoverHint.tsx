'use client';

import React from 'react';

export type HintPlacement = 'top' | 'bottom' | 'left' | 'right';

interface HoverHintProps {
  hint?: string | null;
  children: React.ReactNode;
  position?: HintPlacement;
  side?: HintPlacement;
  className?: string;
}

export function HoverHint({
  hint,
  children,
  position,
  side,
  className = '',
}: HoverHintProps) {
  if (!hint) {
    return <div className={className}>{children}</div>;
  }

  const activeSide: HintPlacement = side || position || 'top';

  const placementClass =
    activeSide === 'bottom'
      ? 'left-1/2 top-full mt-2 -translate-x-1/2 origin-top'
      : activeSide === 'left'
      ? 'right-full top-1/2 mr-2 -translate-y-1/2 origin-right'
      : activeSide === 'right'
      ? 'left-full top-1/2 ml-2 -translate-y-1/2 origin-left'
      : 'bottom-full left-1/2 mb-2 -translate-x-1/2 origin-bottom';

  return (
    <div className={`group/hint relative inline-flex ${className}`}>
      {children}
      <div
        role="tooltip"
        className={`pointer-events-none invisible absolute z-50 hidden w-max max-w-[260px] scale-95 rounded-none border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-center font-mono text-[11px] font-normal leading-snug text-zinc-200 opacity-0 shadow-2xl backdrop-blur-md transition-all duration-200 ease-out group-hover/hint:visible group-hover/hint:scale-100 group-hover/hint:opacity-100 sm:block ${placementClass}`}
      >
        {hint}
      </div>
    </div>
  );
}
