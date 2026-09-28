import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import MindCharacters from './MindCharacters';
import { loginAccount, type AccountUser } from '../lib/cloudApi';
import './auth-screen.css';

type Props = { onVerified: (user: AccountUser) => Promise<void>; onPreview: () => void; initialError?: string };

export default function AuthScreen({ onVerified, onPreview, initialError = '' }: Props) {
  const [inviteCode, setInviteCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(initialError);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => setError(initialError), [initialError]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const code = inviteCode.trim();
    if (!code) {
      setError('请输入你的专属邀请码。');
      codeRef.current?.focus();
      return;
    }

    setPending(true);
    setError('');
    try {
      const { user } = await loginAccount(code);
      await onVerified(user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法进入，请稍后再试。');
    } finally {
      setPending(false);
    }
  }

  return <div className="auth-page">
    <header className="auth-brand"><span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/></span><strong>一生一格</strong><span>把每一周，过成自己的故事</span></header>
    <main className="auth-layout">
      <section className="auth-story" aria-labelledby="auth-story-title">
        <span className="auth-story__eyebrow">LIFE IN WEEKS</span>
        <h1 id="auth-story-title">这一周，<br/><em>由你掌舵。</em></h1>
        <p>看见时间的样子，记下值得留下的日子。猴子、理性决策者和恐惧怪兽，也会陪你一起认识此刻。</p>
        <MindCharacters selected="rational" openRole={null} onOpen={() => {}} decorative/>
        <small>每一个小格子，都是从生日开始的七天。</small>
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-panel__icon"><KeyRound size={22} aria-hidden="true"/></div>
        <span className="auth-panel__eyebrow">你的私人周历</span>
        <h2 id="auth-title">打开你的周历</h2>
        <p className="auth-panel__lead">输入分配给你的专属邀请码，第一次使用也从这里进入。</p>

        <form onSubmit={submit} noValidate aria-describedby={error ? 'auth-error' : undefined}>
          <div className="auth-field">
            <label htmlFor="auth-invite-code">专属邀请码</label>
            <div className="auth-code-field">
              <input ref={codeRef} id="auth-invite-code" type={showCode ? 'text' : 'password'} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={256} value={inviteCode} onChange={(event) => { setInviteCode(event.target.value); if (error) setError(''); }} placeholder="粘贴或输入邀请码" aria-describedby="auth-code-hint" disabled={pending}/>
              <button type="button" className="auth-visibility" onClick={() => setShowCode((visible) => !visible)} aria-label={showCode ? '隐藏邀请码' : '显示邀请码'} aria-pressed={showCode} disabled={pending}>
                {showCode ? <EyeOff size={17} aria-hidden="true"/> : <Eye size={17} aria-hidden="true"/>}<span>{showCode ? '隐藏' : '显示'}</span>
              </button>
            </div>
            <p className="auth-field__hint" id="auth-code-hint">这是进入你私人周历的凭证，请妥善保存。</p>
          </div>
          {error && <p className="auth-error" id="auth-error" role="alert">{error}</p>}
          <button className="auth-primary" type="submit" disabled={pending}>
            {pending ? '正在打开…' : '进入我的周历'}
            {!pending && <ArrowRight size={18} aria-hidden="true"/>}
          </button>
        </form>

        <div className="auth-panel__divider"><span>先看看产品</span></div>
        <button className="auth-preview" type="button" onClick={onPreview}>浏览示例周历 <ArrowRight size={17} aria-hidden="true"/></button>
        <p className="auth-panel__foot"><ShieldCheck size={15} aria-hidden="true"/>登录后的记录会同步到你的私人周历。示例不会写入账号。</p>
      </section>
    </main>
  </div>;
}
