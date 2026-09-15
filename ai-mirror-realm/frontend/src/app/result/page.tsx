import { redirect } from 'next/navigation';
export default function LegacyResultPage({ searchParams }: { searchParams: { id?: string } }) { redirect(searchParams.id ? `/studio/tasks/${encodeURIComponent(searchParams.id)}` : '/works'); }
