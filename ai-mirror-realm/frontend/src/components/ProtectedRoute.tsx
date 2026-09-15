'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/stores/auth';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const intended = `${pathname}${window.location.search}`;
      router.replace(`/access?next=${encodeURIComponent(intended)}`);
    }
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return (
      <div className="page-shell flex min-h-screen items-center justify-center pt-[68px]" role="status">
        <p className="text-sm text-muted">正在确认访问状态…</p>
      </div>
    );
  }

  return <>{children}</>;
}
