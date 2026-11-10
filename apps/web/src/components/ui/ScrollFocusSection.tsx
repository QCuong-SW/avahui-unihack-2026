'use client';

import React, { useEffect, useRef, useState } from 'react';

type FocusPhase = 'FOCUSED' | 'EXITED_ABOVE' | 'WAITING_BELOW';

const ACTIVE_SECTION_EVENT = 'avahui:landing-active-section';

export function emitActiveLandingSection(sectionId: string) {
  if (typeof window === 'undefined') return;
  (window as any).__avahuiActiveSection = sectionId;
  window.dispatchEvent(
    new CustomEvent(ACTIVE_SECTION_EVENT, { detail: sectionId })
  );
}

export function useActiveLandingSection(defaultId = 'hero') {
  const [activeId, setActiveId] = useState<string>(defaultId);

  useEffect(() => {
    const initial = (window as any).__avahuiActiveSection;
    if (initial) setActiveId(initial);

    const handler = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail) setActiveId(custom.detail);
    };
    window.addEventListener(ACTIVE_SECTION_EVENT, handler);
    return () => window.removeEventListener(ACTIVE_SECTION_EVENT, handler);
  }, []);

  return activeId;
}

export function scrollToLandingSection(sectionId: string) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

interface ScrollFocusSectionProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  /** First hero section starts focused immediately on load */
  initialFocused?: boolean;
}

/**
 * Scroll-driven focus wrapper:
 * - Brings the section in viewport center cleanly into focus (scale 1, blur 0, opacity 1)
 * - Smoothly blurs, scales down and fades sections as they leave the focused viewport area
 */
export function ScrollFocusSection({
  id,
  children,
  className = '',
  initialFocused = false,
}: ScrollFocusSectionProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [phase, setPhase] = useState<FocusPhase>(
    initialFocused ? 'FOCUSED' : 'WAITING_BELOW'
  );

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const evaluateFocus = () => {
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const focusTop = vh * 0.12;
      const focusBottom = vh * 0.88;
      const isAtTop = window.scrollY <= 30;
      const isAtBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 40;

      // Any section overlapping the focus band (or resting cleanly at top/bottom bounds) stays crisp
      const visibleTop = Math.max(rect.top, focusTop);
      const visibleBottom = Math.min(rect.bottom, focusBottom);
      const overlap = Math.max(0, visibleBottom - visibleTop);
      const minRequired = Math.min(rect.height * 0.25, vh * 0.2);

      const shouldFocus =
        overlap >= minRequired ||
        (isAtTop && initialFocused && rect.bottom > 0) ||
        (isAtBottom && rect.top < vh && rect.bottom > vh * 0.35);

      if (shouldFocus) {
        setPhase('FOCUSED');
        // Update active section indicator when section crosses viewport midline
        const mid = vh * 0.48;
        if (
          (rect.top <= mid && rect.bottom >= mid) ||
          (isAtBottom && id === 'bat-dau')
        ) {
          emitActiveLandingSection(id);
        }
      } else if (rect.bottom <= focusTop + minRequired) {
        setPhase('EXITED_ABOVE');
      } else {
        setPhase('WAITING_BELOW');
      }
    };

    evaluateFocus();

    const observer = new IntersectionObserver(
      () => {
        evaluateFocus();
      },
      {
        threshold: [0, 0.1, 0.25, 0.45, 0.7],
        rootMargin: '-8% 0px -8% 0px',
      }
    );

    observer.observe(node);
    window.addEventListener('scroll', evaluateFocus, { passive: true });
    window.addEventListener('resize', evaluateFocus, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', evaluateFocus);
      window.removeEventListener('resize', evaluateFocus);
    };
  }, [id, initialFocused]);

  const phaseStyle =
    phase === 'FOCUSED'
      ? 'opacity-100 translate-y-0 scale-100 blur-0 pointer-events-auto'
      : phase === 'EXITED_ABOVE'
      ? 'opacity-0 -translate-y-10 scale-[0.95] blur-[8px] pointer-events-none'
      : 'opacity-0 translate-y-12 scale-[0.96] blur-[8px] pointer-events-none';

  return (
    <section
      id={id}
      ref={ref}
      className={`transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[transform,opacity,filter] ${phaseStyle} ${className}`}
    >
      {children}
    </section>
  );
}
