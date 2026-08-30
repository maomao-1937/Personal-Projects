'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/stores/auth';
import { Mail, Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/Card';

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    nickname: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const update = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      setError('密码至少 6 位');
      return;
    }
    setLoading(true);
    try {
      await register({
        email: form.email || undefined,
        password: form.password,
        nickname: form.nickname || undefined,
      });
      router.push('/upload');
    } catch (err: any) {
      setError(err.response?.data?.detail || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-16 min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Card className="bg-bg-secondary/50 backdrop-blur">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">创建账户</CardTitle>
            <CardDescription>注册即送 3 次免费生成</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="昵称"
                type="text"
                value={form.nickname}
                onChange={(e) => update('nickname', e.target.value)}
                placeholder="给自己起个名字"
                leftIcon={<User size={16} />}
              />

              <Input
                label="邮箱"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="your@email.com"
                leftIcon={<Mail size={16} />}
                required
              />

              <Input
                label="密码"
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="至少 6 位"
                leftIcon={<Lock size={16} />}
                error={error}
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                fullWidth
                loading={loading}
              >
                {loading ? '注册中…' : '注册'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-text-dim">
              已有账号？{' '}
              <Link href="/login" className="text-accent-light hover:text-accent transition-colors">
                登录
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
