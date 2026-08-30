'use client';

import { AuthProvider } from '@/stores/auth';
import { ToastProvider } from '@/contexts/ToastContext';
import ToastContainer from '@/components/ui/ToastContainer';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        {children}
        <ToastContainer />
      </AuthProvider>
    </ToastProvider>
  );
}
