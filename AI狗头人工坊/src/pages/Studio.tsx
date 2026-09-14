import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, ArrowRight, Plus, SlidersHorizontal, Square, ChevronDown, Check, Dog } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PortraitUpload } from '@/components/PortraitUpload';
import { BreedPicker, BreedPortrait } from '@/components/BreedPicker';
import { PromptWriter } from '@/components/PromptWriter';
import { CreationCanvas } from '@/components/CreationCanvas';
import { useSession } from '@/lib/session';
import { getBreed, styles, type Style } from '../../shared/breeds';
import { directorCanSee } from '../../shared/agent';

export default function Studio() {
  const s = useSession(); const navigate = useNavigate();
  const [photoOpen, setPhotoOpen] = useState(false); const [optionsOpen, setOptionsOpen] = useState(false);
  const [breedOpen, setBreedOpen] = useState(false);
  const [conversationOpen, setConversationOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const chosen = s.profiles.find(p => p.id === s.selected) || s.profiles[0];
  const run = s.runs.find(r => r.id === s.studioRun && r.result);
  const hasWork = !!s.portrait;
  const textOnly = !!s.director && !directorCanSee(s.director);
  const ready = !!chosen && s.hasKey(chosen.id) && (!s.agentMode || (!!s.director && s.hasDirectorKey));
  const unavailable = !chosen || !s.hasKey(chosen.id) ? '先连接绘图模型' : '先连接创作助手';
  const disabled = s.busy || s.preparing || !s.hydrated;
  const versions = s.runs.filter(r => !!r.result && r.request !== undefined);
  useEffect(() => { if (s.portrait) setPhotoOpen(false); }, [s.portrait]);
  useEffect(() => { if (s.agentQuestion && !s.busy) input.current?.focus(); }, [s.agentQuestion, s.busy]);
  useEffect(() => { if (conversation.current) conversation.current.scrollTop = conversation.current.scrollHeight; }, [s.runs, s.agentNote, s.busy]);
  function create(reply?: string) {
    if (disabled) return;
    if (!s.portrait) { setPhotoOpen(true); return; }
    if (!ready) { toast.info('照片和想法已保留，完成一次模型设置后即可创作。'); navigate('/models'); return; }
    if (s.agentQuestion && !(reply ?? s.extra).trim()) return;
    if (s.breed === 'custom' && !s.customBreed.trim() && !s.delegateBreed) { setBreedOpen(true); return; }
    if (s.agentMode) void s.startAgent(chosen!, reply);
    else void s.startRuns([chosen!], 'studio');
  }
  const composer = <div className="task-composer">
    <div className="composer-modes" aria-label="创作方式">
      <button type="button" aria-pressed={s.agentMode} disabled={disabled} onClick={() => s.setAgentMode(true)}>Agent 创作</button>
      <button type="button" aria-pressed={!s.agentMode} disabled={disabled} onClick={() => { s.setAgentMode(false); s.setDelegateBreed(false); }}>自己控制</button>
      <PromptWriter />
    </div>
    {run && <div className="editing-context"><img src={run.result!.image} alt="本次要修改的作品" /><span>正在修改版本 {versions.length - versions.findIndex(v => v.id === run.id)}</span><Check size={14} /></div>}
    {s.agentQuestion && <div className="question-inline" role="status"><p>{s.agentNote}</p><div>{s.agentChoices.map(choice => <Button key={choice} variant="outline" disabled={disabled} onClick={() => create(choice)}>{choice}</Button>)}</div></div>}
    <label className="sr-only" htmlFor="creative-intent">{run ? '修改要求' : '创作要求'}</label>
    <Textarea ref={input} id="creative-intent" value={s.extra} disabled={disabled} maxLength={1200} rows={hasWork ? 3 : 2}
      placeholder={s.agentQuestion ? '回答这个问题，继续完成作品…' : run ? '哪里还想改？比如：嘴巴闭上，保留眼镜。' : '把我变成一只柴犬，保留我的眼镜和穿搭…'}
      onChange={e => s.setExtra(e.target.value)} onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
          e.preventDefault(); if (!run || s.extra.trim()) create();
        }
      }} />
    <div className="composer-bottom">
      <div className="composer-tools">
        {s.portrait && <Button variant="ghost" size="icon" aria-label={s.portrait ? '更换人像' : '上传人像'} disabled={disabled} onClick={() => setPhotoOpen(true)}><Plus size={19} /></Button>}
        <Button className="breed-trigger" variant="ghost" disabled={disabled} onClick={() => setBreedOpen(true)}><BreedPortrait id={s.delegateBreed ? 'custom' : s.breed} /><span>{s.delegateBreed ? 'Agent 选犬种' : getBreed(s.breed)?.label || s.customBreed || '选犬种'}</span><ChevronDown size={12} /></Button>
        <Button variant="ghost" size="icon" aria-label="创作设置" disabled={disabled} onClick={() => setOptionsOpen(true)}><SlidersHorizontal size={17} /></Button>
      </div>
      {s.busy ? <Button className="send-button" onClick={s.cancel} aria-label="停止等待"><Square size={16} fill="currentColor" /></Button> : <Button className={`send-button ${!s.portrait || !ready ? 'send-labelled' : ''}`} disabled={disabled || (s.agentQuestion && !s.extra.trim())} onClick={() => create()} aria-label={!s.portrait ? '上传人像' : !ready ? unavailable : run ? s.extra.trim() ? '发送修改要求' : '再生成一个版本' : '开始创作'}>{!s.portrait ? <>上传人像 <Plus size={16} /></> : !ready ? <>连接模型 <ArrowRight size={16} /></> : <ArrowUp size={19} />}</Button>}
    </div>
  </div>;
  return <>
    {!hasWork ? <section className="creation-home">
      <div className="home-heading"><h1>今天，换个狗头。</h1><p>还是你的穿搭，还是你的姿态。只是多一点犬系气质。</p></div>
      <div className="home-composer">{composer}<div className="home-start"><span>手边没有照片？</span><Button variant="link" onClick={() => void s.useExample()} disabled={disabled}>用示例试试 <ArrowRight size={14} /></Button></div></div>
      <section className="home-example" aria-label="狗头变身示例">
        <div className="example-pair"><figure><img src="/images/example-person.png" alt="原创 AI 示例中的人像" /><figcaption>原来的你</figcaption></figure><span className="pair-arrow"><ArrowRight size={22} /></span><figure><img src="/images/example-dog.png" alt="同一人物的柴犬头效果示例" /><figcaption>犬系分身</figcaption></figure></div>
        <div className="example-foot"><p>换个物种，穿搭照旧。</p><span>AI 预制示例 · 非模型实测</span></div>
      </section>
      <p className="home-footnote">只转换头部，保留身体、穿搭和背景。照片与作品保存在当前浏览器。</p>
    </section> : <div className="project-workspace">
      <CreationCanvas />
      <aside className="chat-panel" aria-label="创作对话">
        <div className="chat-heading"><Dog size={18} /><h1>犬系创作助手</h1><span>{s.agentMode ? 'Agent' : '手动'}</span></div>
        <button className="mobile-conversation-toggle" aria-expanded={conversationOpen} aria-controls="project-conversation" onClick={() => setConversationOpen(v => !v)}>{conversationOpen ? '收起创作对话' : '查看创作对话'}<ChevronDown size={16} /></button>
        <div id="project-conversation" className={`conversation ${conversationOpen ? 'conversation-open' : ''}`} ref={conversation}>
          <div className="chat-welcome"><p>从这张照片，认识另一个你。</p><span>选好犬种，或说说想法。我会保留你的身体和穿搭，把头部变成新的角色。</span></div>
          <div className="reference-message"><img src={s.portrait!.src} alt="当前项目的原始人像" /><div><strong>参考人像</strong><span>{s.portrait!.name}</span></div></div>
          {!versions.length && <div className="quick-directions"><p>也可以从一句想法开始</p>{['自然一点，像真的一样', '眼神拽一点，嘴巴闭上', '开心地吐舌头，保留眼镜'].map(text => <button key={text} disabled={disabled} onClick={() => { s.setExtra(text); input.current?.focus(); }}>{text}<ArrowUp size={14} /></button>)}</div>}
          {versions.slice().reverse().map((v, i) => <div className="conversation-turn" key={v.id}><p className="user-message">{v.request}</p><button className="chat-result" aria-pressed={v.id === run?.id} disabled={disabled} onClick={() => s.selectVersion(v.id)}><img src={v.result!.image} alt="" /><span><strong>版本 {i + 1} · {v.breedLabel || '犬系分身'}</strong><small>{v.parentId ? '基于已有作品修改' : '从原始人像创作'}</small></span><ArrowRight size={15} /></button></div>)}
          {s.busy && <p className="live-status" role="status"><span className="working-dot" />{s.agentStatus?.message || '正在创作…'}</p>}
          {s.agentNote && !s.agentQuestion && <p className="assistant-note" role="status">{s.agentNote}</p>}
        </div>
        <div className="chat-compose-area">
          {s.runs.find(r => r.request !== undefined)?.status === 'error' && <p className="assistant-note error-note" role="alert">{s.runs.find(r => r.request !== undefined)?.error} 你的作品与要求已保留。</p>}
          {!ready && <div className="connection-notice"><span>{unavailable}，之后即可直接创作。</span></div>}
          {composer}
          <p className="composer-disclosure">{s.busy ? '停止等待不保证供应商停止处理。' : `本轮最多 ${s.agentMode && !textOnly ? s.maxRenders : 1} 次绘图 · ${s.agentMode && !textOnly ? '图片交给助手与绘图模型' : '图片仅交给绘图模型'}`}</p>
        </div>
      </aside>
    </div>}
    <Dialog open={photoOpen} onOpenChange={setPhotoOpen}><DialogContent className="photo-dialog"><DialogHeader><DialogTitle>{s.portrait ? '用另一张人像开始' : '先选一张人像'}</DialogTitle><DialogDescription>{s.portrait ? '更换照片会建立新项目，已有作品保留在历史中。' : '单人、清楚的照片效果更容易控制。默认只换头部。'}</DialogDescription></DialogHeader><PortraitUpload /></DialogContent></Dialog>
    <Dialog open={breedOpen} onOpenChange={setBreedOpen}><DialogContent className="breed-choice-dialog"><DialogHeader><DialogTitle>选一个犬系分身</DialogTitle><DialogDescription>表情可以自由改，选完就能继续创作。</DialogDescription></DialogHeader><BreedPicker /><Button onClick={() => setBreedOpen(false)}>用这个犬种</Button></DialogContent></Dialog>
    <Dialog open={optionsOpen} onOpenChange={setOptionsOpen}><DialogContent><DialogHeader><DialogTitle>创作设置</DialogTitle><DialogDescription>两种创作方式共用绘图连接，切换不需要重新接入。</DialogDescription></DialogHeader>
      <div className="work-options"><label htmlFor="studio-model">绘图模型</label>{chosen ? <Select value={chosen.id} onValueChange={s.setSelected}><SelectTrigger id="studio-model"><SelectValue /></SelectTrigger><SelectContent>{s.profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}{!s.hasKey(p.id) ? ' · 未连接' : ''}</SelectItem>)}</SelectContent></Select> : <Button variant="outline" onClick={() => { setOptionsOpen(false); navigate('/models'); }}>连接绘图模型</Button>}
      <label htmlFor="work-style">画面质感</label><Select value={s.style} onValueChange={v => s.setStyle(v as Style)}><SelectTrigger id="work-style"><SelectValue /></SelectTrigger><SelectContent>{styles.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent></Select>
      <label htmlFor="work-freedom">修改范围</label><Select value={s.freedom} onValueChange={v => s.setFreedom(v as 'head' | 'scene')}><SelectTrigger id="work-freedom"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="head">只换头部，保留身体与背景</SelectItem><SelectItem value="scene">允许按要求调整场景</SelectItem></SelectContent></Select>
      {s.agentMode && <label className="repair-option"><Checkbox disabled={textOnly} checked={!textOnly && s.maxRenders === 2} onCheckedChange={v => s.setMaxRenders(v ? 2 : 1)} />{textOnly ? '文字助手不检查作品' : '检查发现问题时，允许自动修正一次'}</label>}
      <p>保存项目仅限当前浏览器。开始创作才发送图片；调用按供应商计费。</p><Button onClick={() => setOptionsOpen(false)}>完成</Button></div>
    </DialogContent></Dialog>
  </>;
}
