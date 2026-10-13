'use client';

import { Suspense, useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Aperture, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/api';
import { safeNextPath } from '@/lib/navigation';
import { useAuth } from '@/stores/auth';

function AccessForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, enterWithInvite } = useAuth();
  const [inviteToken, setInviteToken] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [requestError, setRequestError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const next = safeNextPath(searchParams.get('next'), '/studio');

  useEffect(() => { if (!loading && user) router.replace(next); }, [loading, next, router, user]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setRequestError('');
    if (inviteToken.trim().length < 8) {
      setFieldError('请输入有效邀请码');
      return;
    }
    setSubmitting(true);
    try {
      await enterWithInvite(inviteToken.trim());
    } catch (reason) {
      const message = getErrorMessage(reason, '进入失败，请稍后重试');
      if (axios.isAxiosError(reason) && reason.response?.data?.code === 'INVITE_UNAVAILABLE') setFieldError(message);
      else setRequestError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || user) return <div role="status" className="mt-8 flex min-h-[120px] items-center justify-center gap-3 text-sm text-[#707070]"><Loader2 size={18} className="motion-safe:animate-spin" aria-hidden="true" />正在确认访问状态…</div>;

  return (
    <>
      <form onSubmit={submit} className="mt-8 space-y-5" noValidate aria-busy={submitting}>
        <Input label="邀请码" value={inviteToken} onChange={(event) => { setInviteToken(event.target.value); setFieldError(''); setRequestError(''); }} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="输入你收到的邀请码" error={fieldError} maxLength={200} required disabled={submitting} className={`bg-[#fafafa] placeholder:text-[#707070] ${fieldError ? '' : 'focus:border-[#171717] focus:ring-[#171717]/10'}`} />
        {requestError && <p className="rounded-lg bg-[#fff3f3] px-4 py-3 text-sm text-[#a42d2d]" role="alert">{requestError}</p>}
        <Button type="submit" size="lg" fullWidth loading={submitting} className="rounded-lg bg-[#171717] text-[#f9dbca] hover:bg-[#333333] active:bg-[#101010] focus-visible:ring-[#171717]">{submitting ? '正在进入…' : '进入工作台'}</Button>
      </form>
      <p className="mt-6 text-center text-xs leading-6 text-[#707070]">照片和生成结果仅当前账户可见。</p>
    </>
  );
}

export default function AccessPage() {
  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-[#f5f5f5] text-[#222222]">
      <header className="flex h-16 shrink-0 items-center border-b border-[#eeeeee] bg-white px-5 sm:px-8">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2.5 text-base font-semibold"><Aperture size={25} strokeWidth={1.7} aria-hidden="true" />AI 镜界<span className="ml-1 hidden font-normal text-[#707070] sm:inline">AI 写真</span></Link>
      </header>
      <main className="flex min-w-0 flex-1 items-center justify-center px-4 py-10 sm:py-16">
        <section aria-labelledby="access-title" className="w-full max-w-[440px] rounded-xl bg-white px-6 py-8 sm:px-10 sm:py-10">
          <h1 id="access-title" className="text-center text-[24px] font-semibold tracking-tight">进入 AI 写真</h1>
          <p className="mt-3 text-center text-sm leading-7 text-[#707070]">输入邀请码，进入你的私人写真工作台</p>
          <Suspense fallback={<p role="status" className="mt-8 py-8 text-center text-sm text-[#707070]">正在加载…</p>}><AccessForm /></Suspense>
        </section>
      </main>
    </div>
  );
}
