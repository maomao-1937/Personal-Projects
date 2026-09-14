import { useEffect, useRef, useState } from 'react';
import { WandSparkles, Copy, ArrowRight, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useSession } from '@/lib/session';
import { getBreed } from '../../shared/breeds';
import { promptWriterConfigSchema } from '../../shared/prompt-writer';

export function PromptWriter({ settings = false }: { settings?: boolean }) {
  const s = useSession(); const navigate = useNavigate();
  const sourceDraft = useRef<string | undefined>(undefined);
  const [open, setOpen] = useState(false), [connectionOpen, setConnectionOpen] = useState(false);
  const [model, setModel] = useState(''), [key, setKey] = useState(''), [admin, setAdmin] = useState('');
  const [idea, setIdea] = useState(''), [output, setOutput] = useState(''), [outputModel, setOutputModel] = useState('');
  const [error, setError] = useState(''), [note, setNote] = useState(''), [working, setWorking] = useState(false), [saving, setSaving] = useState(false);
  const request = useRef<AbortController | null>(null); const ticket = useRef(0);
  const current = s.runs.find(r => r.id === s.studioRun && r.result);
  const saved = !!s.managed.promptWriter && model.trim() === s.managed.promptWriter.model;
  const unavailable = s.busy || s.preparing || !s.hydrated;
  useEffect(() => () => { ticket.current++; request.current?.abort(); }, []);
  useEffect(() => {
    ticket.current++; request.current?.abort(); setWorking(false); setOpen(false); setIdea(''); setOutput(''); setError(''); setKey(''); setAdmin('');
  }, [s.projectId, s.studioRun]);
  function changeOpen(value: boolean) {
    if (!value) { ticket.current++; request.current?.abort(); setWorking(false); setKey(''); setAdmin(''); }
    else { setModel(s.managed.promptWriter?.model || ''); if (sourceDraft.current !== s.extra) setIdea(s.extra); sourceDraft.current = s.extra; setConnectionOpen(settings || !s.managed.promptWriter); setError(''); setNote(''); }
    setOpen(value);
  }
  async function saveConnection() {
    if (!promptWriterConfigSchema.safeParse({ model }).success) { setError('请填写 DeepSeek 控制台中的模型 ID。'); return; }
    if (!s.managed.promptWriter && key.trim().length < 8) { setError('请填写 DeepSeek API Key。'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/prompt-writer/connection', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-studio-admin': admin }, body: JSON.stringify({ config: { model: model.trim() }, key: key.trim() }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || '连接未保存');
      await s.loadConnections(); setKey(''); setAdmin(''); setModel(data.config.model); setNote('DeepSeek 连接已保存，刷新后仍可用。保存未调用模型。'); setConnectionOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : '连接未保存，请重试。'); }
    finally { setSaving(false); }
  }
  async function generate() {
    if (request.current || unavailable || saving) return;
    if (!idea.trim()) { setError('先写一句你想要的效果。'); return; }
    if (!promptWriterConfigSchema.safeParse({ model }).success || (!saved && key.trim().length < 8)) { setConnectionOpen(true); setError('请填写 DeepSeek 模型 ID 和 API Key，或使用已保存的连接。'); return; }
    const id = ++ticket.current; const controller = new AbortController(); request.current = controller;
    setWorking(true); setError(''); setNote('');
    try {
      const res = await fetch('/api/prompt-writer', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        model: model.trim(), apiKey: key.trim() || undefined, useSaved: !key.trim() && saved,
        idea: idea.trim(), breed: s.delegateBreed ? '根据创意选择合适犬种' : s.breed === 'custom' ? s.customBreed || '自定义犬种' : getBreed(s.breed)?.label || '柴犬',
        style: s.style, freedom: s.freedom, task: current ? 'edit' : 'create', previousPrompt: current?.prompt,
      }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || '提示词生成失败');
      if (id !== ticket.current) return;
      if (typeof data.prompt !== 'string' || !data.prompt.trim() || data.prompt.length > 1100) throw new Error('提示词格式异常，请重试。');
      setOutput(data.prompt); setOutputModel(data.model);
    } catch (e) { if (id === ticket.current) setError(controller.signal.aborted ? '已停止等待，想法与已有提示词已保留。' : e instanceof Error ? e.message : '生成失败，请重试。'); }
    finally { if (request.current === controller) request.current = null; if (id === ticket.current) setWorking(false); }
  }
  return <>
    <Button type="button" variant={settings ? 'outline' : 'ghost'} className={settings ? '' : 'prompt-writer-trigger'} disabled={unavailable} onClick={() => changeOpen(true)}><WandSparkles size={15} />{settings ? '配置 / 打开生成器' : '提示词生成器'}</Button>
    <Dialog open={open} onOpenChange={changeOpen}><DialogContent className="prompt-writer-dialog"><DialogHeader><DialogTitle>把想法，写成好提示词。</DialogTitle><DialogDescription>用 DeepSeek 扩写创意，仅发送文字。可以先改满意，再交给绘图模型。</DialogDescription></DialogHeader>
      <div className="prompt-writer-body">
        <details open={connectionOpen} onToggle={e => setConnectionOpen(e.currentTarget.open)} className="prompt-writer-connection">
          <summary>DeepSeek 连接 · {saved ? '已保存' : '待填写'}</summary>
          <label htmlFor="prompt-model">模型 ID<Input id="prompt-model" required maxLength={160} disabled={working || saving} value={model} onChange={e => setModel(e.target.value)} placeholder="粘贴 DeepSeek 控制台中的模型 ID" autoComplete="off" spellCheck={false} /></label>
          <label htmlFor="prompt-key">API Key<Input id="prompt-key" type="password" autoComplete="new-password" maxLength={2048} disabled={working || saving} value={key} onChange={e => setKey(e.target.value)} placeholder={s.managed.promptWriter ? '已保存的密钥可留空' : '填写 DeepSeek API Key'} /></label>
          <p>使用 DeepSeek 官方接口。<a href="https://api-docs.deepseek.com/" target="_blank" rel="noreferrer">查看接入文档</a>。单独配置，不改变创作助手。</p>
          {s.managed.adminMode === 'token' && <label htmlFor="prompt-admin">站点管理口令<Input id="prompt-admin" type="password" autoComplete="new-password" value={admin} onChange={e => setAdmin(e.target.value)} /></label>}
          {s.managed.adminMode !== 'disabled' ? <Button variant="outline" disabled={working || saving} onClick={() => void saveConnection()}>{saving ? '正在保存…' : '保存 DeepSeek 连接'}</Button> : <p>当前可直接用会话密钥生成；保存连接需维护者开启站点管理。</p>}
        </details>
        {note && <p className="prompt-writer-note" role="status">{note}</p>}
        <label htmlFor="prompt-idea">你的想法<Textarea id="prompt-idea" maxLength={1200} value={idea} disabled={working} onChange={e => setIdea(e.target.value)} placeholder={current ? '比如：让这张作品嘴巴闭上，保留眼镜和其他细节' : '比如：一只拽拽的哈士奇，保留眼镜和我的穿搭'} /></label>
        <div className="prompt-writer-actions"><span>{current ? '修改当前选中作品' : '从人像开始创作'} · {s.freedom === 'head' ? '只换头部' : '按要求调整场景'}</span><Button variant={output ? "outline" : "default"} disabled={working || saving || unavailable} onClick={() => void generate()}>{working ? <><LoaderCircle size={16} className="spinner" />DeepSeek 正在写…</> : output ? '重新生成提示词' : '生成提示词'}</Button></div>
        {working && <Button variant="ghost" onClick={() => request.current?.abort()}>停止等待</Button>}
        {error && <p className="prompt-writer-error" role="alert">{error}</p>}
        {output && <div className="prompt-writer-output"><label htmlFor="prompt-output">生成的提示词 · 可编辑<Textarea id="prompt-output" maxLength={1200} value={output} disabled={working} onChange={e => setOutput(e.target.value)} /></label><p>由 {outputModel} 生成 · 应用只填入创作框，不开始绘图。</p><div className="prompt-output-actions"><Button variant="outline" disabled={!output.trim() || working} onClick={async () => { try { await navigator.clipboard.writeText(output); toast.success('提示词已复制'); } catch { setError('复制失败，请选中提示词手动复制。'); } }}><Copy size={15} />复制</Button><Button disabled={!output.trim() || working || unavailable} onClick={() => { sourceDraft.current = output.trim(); s.setExtra(output.trim()); changeOpen(false); if (settings) navigate('/'); toast.success('已填入创作框，发送后才开始绘图。'); }}><ArrowRight size={15} />应用到创作</Button></div></div>}
        <p className="prompt-writer-footnote">每次生成调用一次 DeepSeek，可能产生文本费用；不会调用绘图模型。未保存的密钥关闭后清除。</p>
      </div>
    </DialogContent></Dialog>
  </>;
}
