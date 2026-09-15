'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import api, { UNAUTHORIZED_EVENT } from '@/lib/api';

export interface User {
  id: string;
  phone?: string | null;
  email?: string | null;
  nickname: string;
  avatar_url?: string | null;
}

interface RegisterData {
  invite_token: string;
  email: string;
  password: string;
  nickname: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const PUBLIC_PATHS = ['/', '/access', '/login', '/register', '/styles'];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/styles/');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = useCallback(async () => {
    const response = await api.get<User>('/auth/me');
    setUser(response.data);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      Object.keys(localStorage).filter((key) => key.startsWith('ai-mirror:studio:') || key.startsWith('ai-mirror:create:')).forEach((key) => localStorage.removeItem(key));
      setUser(null);
      router.push('/');
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    api
      .get<User>('/auth/me')
      .then((response) => {
        if (active) setUser(response.data);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      if (!isPublicPath(pathname)) {
        const intended = `${pathname}${window.location.search}`;
        router.replace(`/access?next=${encodeURIComponent(intended)}`);
      }
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [pathname, router]);

  const register = async (data: RegisterData) => {
    const response = await api.post<{ user?: User }>('/auth/register', data);
    if (response.data.user) setUser(response.data.user);
    else await refreshUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
