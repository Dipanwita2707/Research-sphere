import type { Metadata } from 'next';
import BatchDetailView from '@/features/finance/views/BatchDetailView';

export const metadata: Metadata = { title: 'Payment batch · Finance' };

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BatchDetailView id={id} />;
}
