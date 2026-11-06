'use client';

import React from 'react';

interface AvahuiLogoProps {
  size?: number;
  className?: string;
  roundedClass?: string;
}

export function AvahuiLogo({
  size = 36,
  className = '',
  roundedClass = 'rounded-none',
}: AvahuiLogoProps) {
  return (
    <img
      src="/avahui-logo.jpg"
      alt="Avahui Logo"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 object-cover border border-avalanche-red/50 shadow-md shadow-avalanche-red/20 ${roundedClass} ${className}`}
    />
  );
}
