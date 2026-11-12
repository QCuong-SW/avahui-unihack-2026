'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CircleDetailView } from '@/features/circles/components/CircleDetailView';

interface CircleDetailClientProps {
  fallbackId: string;
}

const RESERVED_CIRCLE_SEGMENTS = new Set(['detail', 'create']);

function extractCircleId(pathname: string | null): string | null {
  const match = pathname?.match(/^\/circles\/([^/?#]+)/);
  const segment = match?.[1];
  if (!segment || RESERVED_CIRCLE_SEGMENTS.has(segment)) {
    return null;
  }
  return decodeURIComponent(segment);
}

/**
 * Resolves the live circle identifier from the browser URL when served via
 * Cloudflare static rewrite rules (/circles/* -> /circle-detail.html).
 */
export function CircleDetailClient({ fallbackId }: CircleDetailClientProps) {
  const routerPathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted && fallbackId === 'detail') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center font-mono text-zinc-400">
        Đang tải dữ liệu Dây hụi...
      </div>
    );
  }

  const fromRouter = extractCircleId(routerPathname);
  const fromBrowser =
    mounted && typeof window !== 'undefined'
      ? extractCircleId(window.location.pathname) ||
        new URLSearchParams(window.location.search).get('id')
      : null;

  return <CircleDetailView circleId={fromRouter || fromBrowser || fallbackId} />;
}

