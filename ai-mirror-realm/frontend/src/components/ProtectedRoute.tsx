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
      const redirectUrl = encodeURIComponent(pathname);
      router.push(`/login?redirect=${redirectUrl}`);
    }
  }, [loading, user, router, pathname]);

  if (loading) return null;
  if (!user) return null;

  return <>{children}</>;
}
