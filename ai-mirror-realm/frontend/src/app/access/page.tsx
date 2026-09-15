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
      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        <Input label="邀请码" value={form.invite_token} onChange={(event) => update('invite_token', event.target.value)} autoComplete="off" placeholder="输入你收到的邀请码" leftIcon={<KeyRound size={17} />} error={errors.invite_token} required />
        <Input label="邮箱" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} autoComplete="email" placeholder="name@example.com" leftIcon={<Mail size={17} />} error={errors.email} required />
        <Input label="昵称" value={form.nickname} onChange={(event) => update('nickname', event.target.value)} autoComplete="nickname" placeholder="怎么称呼你" leftIcon={<UserRound size={17} />} error={errors.nickname} maxLength={20} required />
        <Input label="密码" type="password" value={form.password} onChange={(event) => update('password', event.target.value)} autoComplete="new-password" placeholder="至少 6 位" leftIcon={<Lock size={17} />} error={errors.password} required />
        {requestError && <p className="rounded-lg bg-[#fff0f1] px-4 py-3 text-sm text-signal" role="alert">{requestError}</p>}
        <Button type="submit" size="lg" fullWidth loading={submitting}>使用邀请码进入</Button>
      </form>
      <p className="mt-6 text-center text-xs leading-5 text-muted">每个邀请码仅可使用一次，照片与结果仅本人可访问</p>
    </>
  );
}

export default function AccessPage() {
  return (
    <main className="grid min-h-screen min-w-0 grid-cols-1 overflow-hidden bg-canvas pt-16 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="relative hidden min-h-[calc(100vh-64px)] overflow-hidden bg-stage p-5 lg:block" aria-label="写真预览">
        <div className="relative h-full overflow-hidden rounded-[22px]">
          <Image src="/style-previews/fugu.jpg" alt="AI 写真效果示例" fill priority sizes="45vw" className="object-cover opacity-90" />
          <div className="absolute inset-0 bg-black/25" />
          <div className="absolute left-7 top-7 flex items-center gap-3 text-white"><span className="h-2 w-2 rounded-full bg-[#f06a47]" /><span className="editorial-kicker text-white/80">Private access / 01</span></div>
          <div className="absolute inset-x-7 bottom-7 border-l border-white/40 pl-5 text-white"><p className="editorial-kicker text-white/65">AI MIRROR REALM</p><h1 className="display-title mt-3 max-w-xl text-4xl xl:text-5xl">从一张熟悉的自拍，<br />看见新的自己</h1><p className="mt-5 max-w-sm text-sm leading-6 text-white/70">一张照片，多个可能。进入后，你可以描述画面，也可以直接选择一个主题。</p></div>
        </div>
      </section>
      <section className="flex min-w-0 items-center bg-canvas px-5 py-12 sm:px-12 lg:px-16 xl:px-24">
        <div className="mx-auto min-w-0 w-full max-w-md rounded-[22px] border border-line bg-paper p-6 shadow-card sm:p-9">
          <div className="flex items-center justify-between gap-4"><p className="editorial-kicker text-brand">Invite only</p><span className="text-xs tabular-nums text-muted">01 / 01</span></div>
          <h2 className="display-title mt-5 text-4xl sm:text-5xl">进入 AI 镜界</h2>
          <p className="mt-4 text-muted">所有体验者都需要邀请码。验证后即可进入创作工作台。</p>
          <div className="mt-6 h-px bg-line" />
          <Suspense fallback={<p className="mt-8 text-sm text-muted">正在加载…</p>}><AccessForm /></Suspense>
        </div>
      </section>
    </main>
  );
}
