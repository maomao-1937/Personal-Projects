import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Columns2, Download, LoaderCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty';
import { RunOutput } from '@/components/Preview';
import { useSession } from '@/lib/session';
import { downloadJSON } from '@/lib/files';
import { breeds, publicProfile } from '../../shared/models';

export default function Compare() {
  const s = useSession(); const navigate = useNavigate();
  const [selection, setSelection] = useState<string[]>([]);
  const selected = selection.filter(id => s.profiles.some(p => p.id === id) && s.hasKey(id));
  const latest = s.runs.filter(r => r.group === s.compareGroup);
  const baseline = latest[0];
  const source = s.compareSource;
  const inputPortrait = source?.portrait || s.portrait;
  const inputPrompt = source?.prompt || s.prompt;
  function start() {
    if (!inputPortrait) { navigate('/'); return; }
    if (s.profiles.filter(p => s.hasKey(p.id)).length < 2) { navigate('/models'); return; }
    if (selected.length < 2) return;
    void s.startRuns(s.profiles.filter(p => selected.includes(p.id)), 'compare');
  }
  function exportRuns() {
    downloadJSON({ version: 1, note: '单次试验，不代表模型综合排名。输入图片经过统一预处理，模型输出参数并不完全相同。', runs: latest.map(r => ({ id: r.id, group: r.group, profile: publicProfile(r.profile), prompt: r.prompt, breed: r.breed, breedLabel: r.breedLabel, sourceName: r.portrait.name, startedAt: r.startedAt, status: r.status, error: r.error, inputHash: r.result?.inputHash, durationMs: r.result?.durationMs, width: r.result?.width, height: r.result?.height, requestId: r.result?.requestId, parameters: r.result?.parameters })) }, `狗头人工坊-对比记录-${s.compareGroup?.slice(0, 8)}.json`);
  }
  return <>
    <header className="page-intro"><h1><span>同一个任务，</span><span>看看模型的不同。</span></h1><p>固定照片和提示词，一次对比 2–3 个模型的实际效果。</p></header>
    <div className="compare-setup">
      <section className="compare-source"><h2 className="control-label">{source ? "已冻结作品的实际输入与提示词" : "本次输入"}</h2><div className="source-summary">{inputPortrait ? <img src={inputPortrait.src} alt="本次对比冻结的图片输入" /> : <div className="source-placeholder"><Columns2 size={28} strokeWidth={1.25} aria-hidden="true" /></div>}<div><h3>{inputPortrait ? inputPortrait.name : '还没有选择人像'}</h3><p>{source?.breedLabel || (s.breed === 'custom' ? s.customBreed : breeds.find(b => b.id === s.breed)?.label)} · {source ? '沿用该次实际完整提示词' : s.freedom === 'scene' ? '按要求调整场景' : '保留姿势、服装与背景'}</p><Button variant="link" asChild><Link to="/">{inputPortrait ? '返回作品' : '去准备一张人像'} <ArrowRight data-icon="inline-end" /></Link></Button></div></div><details className="compare-prompt"><summary>查看本次完整提示词</summary><p>{inputPrompt}</p></details></section>
      <section className="compare-models"><div className="label-row"><h2 className="control-label">选择模型 <span className="optional">{selected.length} / 3</span></h2><Button variant="link" disabled={s.busy} asChild><Link to="/models"><Plus data-icon="inline-start" />接入模型</Link></Button></div>
        {s.profiles.length ? <FieldGroup className="compare-choices">{s.profiles.map(p => <Field key={p.id} orientation="horizontal"><Checkbox id={`compare-${p.id}`} checked={selected.includes(p.id)} disabled={s.busy || !s.hasKey(p.id) || (!selected.includes(p.id) && selected.length >= 3)} onCheckedChange={v => setSelection(prev => v ? [...prev, p.id] : prev.filter(id => id !== p.id))} /><FieldLabel htmlFor={`compare-${p.id}`}>{p.name}<span>{!s.hasKey(p.id) ? '需补充密钥' : p.model}</span></FieldLabel></Field>)}</FieldGroup> : <p className="no-models">还没有接入模型。先添加两个，再让它们做同一道题。</p>}
        <div className="compare-start"><Button disabled={s.busy || s.preparing || (!!inputPortrait && s.profiles.filter(p => s.hasKey(p.id)).length >= 2 && selected.length < 2)} onClick={start}>{s.busy ? <><LoaderCircle className="spinner" data-icon="inline-start" />正在对比…</> : !inputPortrait ? '先准备一张人像' : s.profiles.filter(p => s.hasKey(p.id)).length < 2 ? '接入至少两个模型' : `开始对比${selected.length ? ` · ${selected.length} 个模型` : ''}`}{!s.busy && <ArrowRight data-icon="inline-end" />}</Button>{s.busy && <Button variant="ghost" onClick={s.cancel}>停止等待</Button>}</div><p className="compare-cost">每个所选模型各调用一次，按供应商实际计费。</p>
      </section>
    </div>
    <section className="comparison-results" aria-label="对比结果"><div className="section-heading"><h2>对比结果</h2>{latest.length > 0 && <Button variant="ghost" disabled={s.busy} onClick={exportRuns}><Download data-icon="inline-start" />导出记录</Button>}</div>
      {!latest.length ? <div className="compare-empty"><Empty><EmptyHeader><EmptyMedia><Columns2 size={36} strokeWidth={1.25} /></EmptyMedia><EmptyTitle>把差异，放在一起看</EmptyTitle><EmptyDescription>生成后并排查看犬头自然度、身体保留和背景一致性。<br />只记录实际结果，不预设哪个模型更好。</EmptyDescription></EmptyHeader></Empty></div> : <><div className="run-baseline"><p>本轮记录：{baseline.portrait.name} · {baseline.breedLabel || breeds.find(b => b.id === baseline.breed)?.label}</p><details><summary>本轮提示词</summary><p>{baseline.prompt}</p></details></div><div className={`comparison-grid count-${latest.length}`}>{latest.map(run => <article key={run.id}><div className="compare-output-heading"><h3>{run.profile.name}</h3><span>{run.status === 'loading' ? '生成中' : run.status === 'success' ? '已完成' : '未完成'}</span></div><RunOutput run={run} compact /></article>)}</div></>}
      <p className="comparison-footnote">观察建议：犬头是否自然衔接？原来的姿势和穿搭是否保留？背景有没有被改动？<br />同一输入不等于完全相同的生成参数，单次结果仅供本轮观察。</p>
    </section>
  </>;
}
