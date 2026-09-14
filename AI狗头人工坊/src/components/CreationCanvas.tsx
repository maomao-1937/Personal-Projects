import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Maximize2, RotateCcw, Columns2, Check, FileText, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useSession } from '@/lib/session';
import { downloadData, downloadJSON } from '@/lib/files';

export function CreationCanvas() {
  const s = useSession(); const navigate = useNavigate();
  const [originalFor, setOriginalFor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false); const [details, setDetails] = useState(false);
  const versions = s.runs.filter(r => r.result && r.request !== undefined).slice().reverse();
  const run = versions.find(r => r.id === s.studioRun);
  const original = run?.originalPortrait?.src || s.portrait?.src;
  const showOriginal = !!run && originalFor === run.id;
  const picture = run && !showOriginal ? run.result!.image : original;
  const number = versions.findIndex(r => r.id === run?.id) + 1;
  return <section className="project-canvas" aria-label="作品画布">
    <div className="work-toolbar"><span>{run ? `版本 ${number}` : '参考人像'}<small>{run ? run.breedLabel : '等待创作'}</small></span>
      <div>{run && <Button variant="ghost" disabled={s.busy} onClick={() => s.selectVersion(null)}><RotateCcw size={15} /><span>从原图再创作</span></Button>}
      <Button variant="ghost" size="icon" aria-label="放大查看图片" onClick={() => setExpanded(true)}><Maximize2 size={17} /></Button></div>
    </div>
    <div className="canvas-surface"><div className="artwork-frame">
      <img src={picture} alt={run && !showOriginal ? `版本 ${number} 的狗头人作品` : '本项目的原始人像'} />
      {run && <button className="original-toggle" disabled={s.busy} onClick={() => setOriginalFor(showOriginal ? null : run.id)}><img src={showOriginal ? run.result!.image : original} alt="" /><span>{showOriginal ? '看狗头效果' : '切回自己'}</span></button>}
      {s.busy && <div className="artwork-progress" role="status"><LoaderCircle size={16} className="spinner" />{s.agentStatus?.message || '正在创作…'}</div>}
    </div>
    <p className="artwork-label">{showOriginal ? '原始人像' : run ? `版本 ${number} · ${run.parentId ? '基于已有作品修改' : '从原始人像创作'}` : '身体、穿搭、背景照旧。新的角色，从头开始。'}</p>
    </div>
    <div className="work-result-bar"><div>{run ? <><strong>{run.profile.name}</strong><span>{(run.result!.durationMs / 1000).toFixed(1)} 秒 · {run.result!.width} × {run.result!.height}</span></> : <span>选个犬种，发送第一条创作要求。</span>}</div>
      {run && <div className="work-result-actions"><Button variant="ghost" size="icon" aria-label="查看作品记录" onClick={() => setDetails(true)}><FileText size={17} /></Button><Button variant="ghost" disabled={s.busy} onClick={() => { s.setCompareSource(run); navigate('/compare'); }}><Columns2 size={16} /><span>换模型对比</span></Button><Button onClick={() => downloadData(run.result!.image, `狗头人-版本${number}-${run.id.slice(0, 8)}.png`)}><Download size={16} />下载</Button></div>}
    </div>
    {!!versions.length && <div className="project-versions" aria-label="作品版本"><span>版本</span>{versions.map((v, i) => <button key={v.id} disabled={s.busy} aria-pressed={run?.id === v.id} aria-label={`选择版本 ${i + 1}`} onClick={() => s.selectVersion(v.id)}><img src={v.result!.image} alt="" /><span>{i + 1}</span>{v.id === run?.id && <Check size={12} />}</button>)}</div>}
    <Dialog open={expanded} onOpenChange={setExpanded}><DialogContent className="image-dialog"><DialogHeader><DialogTitle>{run && !showOriginal ? `作品 · 版本 ${number}` : '原始人像'}</DialogTitle><DialogDescription>完整查看图片，关闭后继续创作。</DialogDescription></DialogHeader><img src={picture} alt="放大后的图片" /></DialogContent></Dialog>
    <Dialog open={details} onOpenChange={setDetails}><DialogContent><DialogHeader><DialogTitle>这张作品的记录</DialogTitle><DialogDescription>对应所选版本的实际输入、提示词与检查。</DialogDescription></DialogHeader>{run && <div className="work-record"><p>{run.request}</p><p>编辑来源：{run.parentId ? '选中的狗头作品' : '原始人像'}</p><details><summary>完整绘图提示词</summary><p>{run.prompt}</p></details>{run.review ? <><h3>本次检查</h3>{run.review.observations.map((o, i) => <p key={i}>{o.area}：{o.finding}</p>)}</> : <p>这张作品没有有效的视觉检查记录。</p>}{run.trace?.length ? <details><summary>本轮工具与 Skill 记录</summary>{run.trace.filter(e => e.type === "skill").map((e, i) => e.type === "skill" ? <p key={i}>{e.name} · {e.version}<br />SHA-256：{e.sha256}</p> : null)}<p>完整执行事件包含在导出的记录中。</p></details> : null}<Button variant="outline" onClick={() => downloadJSON({ version: 4, id: run.id, parentId: run.parentId, request: run.request, profile: run.profile, prompt: run.prompt, review: run.review, plan: run.plan, events: run.trace, inputHash: run.result?.inputHash, parameters: run.result?.parameters }, '狗头人工坊-作品记录.json')}>导出记录</Button></div>}</DialogContent></Dialog>
  </section>;
}
