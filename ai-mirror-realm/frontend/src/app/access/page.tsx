'use client';

import { Suspense, useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AccessShowcase } from '@/components/AccessShowcase';
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
    setRequestError('');
    if (inviteToken.trim().length < 8) {
      setFieldError('请输入有效邀请码');
      return;
    }
    setSubmitting(true);
    try {
      await enterWithInvite(inviteToken.trim());
      router.replace(next);
    } catch (reason) {
      const message = getErrorMessage(reason, '进入失败，请稍后重试');
      if (axios.isAxiosError(reason) && reason.response?.data?.code === 'INVITE_UNAVAILABLE') setFieldError(message);
      else setRequestError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || user) return <p className="mt-8 text-sm text-muted">正在确认访问状态…</p>;

  return (
    <>
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <Input label="邀请码" value={inviteToken} onChange={(event) => { setInviteToken(event.target.value); setFieldError(''); setRequestError(''); }} autoComplete="off" placeholder="输入你收到的邀请码" leftIcon={<KeyRound size={17} />} error={fieldError} maxLength={200} required />
        {requestError && <p className="rounded-lg bg-[#fff0f1] px-4 py-3 text-sm text-signal" role="alert">{requestError}</p>}
        <Button type="submit" size="lg" fullWidth loading={submitting}>使用邀请码进入</Button>
      </form>
      <p className="mt-5 text-xs leading-5 text-muted">邀请码仅可使用一次。退出、换设备或登录状态到期后，需要新邀请码；原作品无法在新账户找回。</p>
    </>
  );
}

export default function AccessPage() {
  return (
    <main className="flex min-h-screen min-w-0 flex-col bg-paper pt-16 lg:grid lg:grid-cols-2">
      <AccessShowcase />
      <section className="flex min-w-0 flex-1 items-start px-5 py-10 sm:px-12 lg:items-center lg:px-16 xl:px-24">
        <div className="mx-auto min-w-0 w-full max-w-md">
          <h2 className="display-title text-4xl sm:text-5xl">进入 AI 镜界</h2>
          <p className="mt-4 text-base leading-7 text-muted">输入邀请码，直接进入你的私人写真工作台。</p>
          <div className="mt-8 flex items-center gap-3 border-t border-line pt-4 text-xs text-muted"><span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />仅限受邀体验</div>
          <Suspense fallback={<p className="mt-8 text-sm text-muted">正在加载…</p>}><AccessForm /></Suspense>
        </div>
      </section>
    </main>
  );
}
