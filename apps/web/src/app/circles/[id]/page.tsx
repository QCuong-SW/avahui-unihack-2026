import React from 'react';
import { CircleDetailClient } from './CircleDetailClient';

export function generateStaticParams() {
  return [{ id: 'detail' }];
}

interface CircleDetailPageProps {
  params: {
    id: string;
  };
}

export default function CircleDetailPage({ params }: CircleDetailPageProps) {
  return <CircleDetailClient fallbackId={params.id} />;
}
