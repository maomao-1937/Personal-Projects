import { redirect } from 'next/navigation';
export default function LegacyRegisterPage({ searchParams }: { searchParams: { next?: string } }) { const next = searchParams.next ? `?next=${encodeURIComponent(searchParams.next)}` : ''; redirect(`/access${next}`); }
