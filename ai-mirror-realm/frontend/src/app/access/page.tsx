'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, Lock, Mail, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/api';
import { safeNextPath } from '@/lib/navigation';
import { useAuth } from '@/stores/auth';

function AccessForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, register } = useAuth();
  const [form, setForm] = useState({ invite_token: '', email: '', nickname: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [requestError, setRequestError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const next = safeNextPath(searchParams.get('next'), '/studio');

  useEffect(() => { if (!loading && user) router.replace(next); }, [loading, next, router, user]);
  const update = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setRequestError('');
    const nextErrors: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = '请输入有效邮箱';
    if (form.password.length < 6) nextErrors.password = '密码至少需要 6 位';
    if (form.invite_token.trim().length < 8) nextErrors.invite_token = '请输入有效邀请码';
    if (form.nickname.trim().length < 2) nextErrors.nickname = '昵称至少需要 2 个字符';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      await register({ invite_token: form.invite_token.trim(), email: form.email.trim(), nickname: form.nickname.trim(), password: form.password });
      router.replace(next);
    } catch (reason) {
      setRequestError(getErrorMessage(reason, '进入失败，请检查邀请码和填写内容'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || user) return <p className="mt-8 text-sm text-muted">正在确认访问状态…</p>;

  return (
    <>
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <Input label="邀请码" value={form.invite_token} onChange={(event) => update('invite_token', event.target.value)} autoComplete="off" placeholder="输入你收到的邀请码" leftIcon={<KeyRound size={17} />} error={errors.invite_token} required />
        <Input label="邮箱" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} autoComplete="email" placeholder="name@example.com" leftIcon={<Mail size={17} />} error={errors.email} required />
        <Input label="昵称" value={form.nickname} onChange={(event) => update('nickname', event.target.value)} autoComplete="nickname" placeholder="怎么称呼你" leftIcon={<UserRound size={17} />} error={errors.nickname} maxLength={20} required />
        <Input label="密码" type="password" value={form.password} onChange={(event) => update('password', event.target.value)} autoComplete="new-password" placeholder="至少 6 位" leftIcon={<Lock size={17} />} error={errors.password} required />
        {requestError && <p className="rounded-lg bg-[#fff0f1] px-4 py-3 text-sm text-signal" role="alert">{requestError}</p>}
        <Button type="submit" size="lg" fullWidth loading={submitting}>使用邀请码进入</Button>
      </form>
      <p className="mt-5 text-xs leading-5 text-muted">每个邀请码仅可使用一次。照片与结果仅当前账户可查看。</p>
    </>
  );
}

export default function AccessPage() {
  return (
    <main className="grid min-h-screen min-w-0 grid-cols-1 bg-paper pt-16 lg:grid-cols-2">
      <section className="relative hidden min-h-[calc(100vh-64px)] overflow-hidden bg-stage lg:block" aria-label="写真效果示例">
        <Image src="/style-previews/zhichang.jpg" alt="职场写真风格 AI 写真效果示例" fill priority sizes="50vw" className="object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#141517] via-[#141517]/70 to-transparent px-10 pb-10 pt-24 text-white xl:px-16">
          <p className="text-xs text-white/75">职场写真 · 效果示例</p>
          <h1 className="display-title mt-4 max-w-lg text-4xl xl:text-5xl">从熟悉的自拍，<br />走进新的画面。</h1>
        </div>
      </section>
      <section className="flex min-w-0 items-center px-5 py-12 sm:px-12 lg:px-16 xl:px-24">
        <div className="mx-auto min-w-0 w-full max-w-md">
          <h2 className="display-title text-4xl sm:text-5xl">进入 AI 镜界</h2>
          <p className="mt-4 text-base leading-7 text-muted">填写邀请码和账户信息，进入你的私人写真工作台。</p>
          <div className="mt-8 flex items-center gap-3 border-t border-line pt-4 text-xs text-muted"><span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />仅限受邀体验</div>
          <Suspense fallback={<p className="mt-8 text-sm text-muted">正在加载…</p>}><AccessForm /></Suspense>
        </div>
      </section>
    </main>
  );
}
