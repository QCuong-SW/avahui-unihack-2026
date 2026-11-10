import React from 'react';
import { CircleDetailClient } from '@/app/circles/[id]/CircleDetailClient';

export default function CircleDetailShellPage() {
  return <CircleDetailClient fallbackId="detail" />;
}

