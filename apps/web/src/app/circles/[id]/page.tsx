import React from 'react';
import { CircleDetailView } from '@/features/circles/components/CircleDetailView';

interface CircleDetailPageProps {
  params: {
    id: string;
  };
}

export default function CircleDetailPage({ params }: CircleDetailPageProps) {
  return <CircleDetailView circleId={params.id} />;
}
