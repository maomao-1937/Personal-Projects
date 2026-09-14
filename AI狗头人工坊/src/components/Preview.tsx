import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, ScanFace, LoaderCircle, ArrowLeftRight, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useSession, type Run } from '@/lib/session';
import { downloadData } from '@/lib/files';

export function Waiting({ startedAt }: { startedAt: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000))); tick(); const id = setInterval(tick, 1000); return () => clearInterval(id); }, [startedAt]);
  return <div className="waiting"><LoaderCircle className="spinner" size={30} aria-hidden="true" /><p role="status">正在给想象力一点时间</p><span>已等待 {seconds} 秒 · 正在等待模型返回</span></div>;
}
export function RunOutput({ run, compact = false }: { run: Run; compact?: boolean }) {
  const s = useSession(); const [view, setView] = useState('result');
  if (run.status === 'loading') return <div className="result-canvas"><Waiting startedAt={run.startedAt} /></div>;
  if (run.status === 'error') return <div className="result-canvas error-canvas"><Alert variant="destructive"><AlertTitle>这次没有生成成功</AlertTitle><AlertDescription>{run.error}</AlertDescription></Alert>{s.profiles.some(p => p.id === run.profile.id) && s.hasKey(run.profile.id) ? <Button variant="outline" disabled={s.busy} onClick={() => void s.retryRun(run)}>只重试这个模型</Button> : <Button variant="outline" asChild><Link to="/models">检查模型配置</Link></Button>}</div>;
  return <>
    <div className="result-canvas"><img className="output-image" src={view === 'original' ? run.portrait.src : run.result!.image} alt={view === 'original' ? '本次生成实际使用的输入图片' : `${run.profile.name} 生成的狗头人作品`} /></div>
    <div className="result-actions">
      <ToggleGroup type="single" value={view} onValueChange={v => v && setView(v)} aria-label="查看原图或生成结果"><ToggleGroupItem value="result">生成结果</ToggleGroupItem><ToggleGroupItem value="original">本次输入</ToggleGroupItem></ToggleGroup>
      <Button variant="ghost" size={compact ? 'icon' : 'default'} aria-label={`下载 ${run.profile.name} 作品`} onClick={() => downloadData(run.result!.image, `狗头人-${run.profile.name.replace(/[^\p{L}\p{N}-]/gu, '_')}-${run.id.slice(0, 6)}.png`)}><Download data-icon="inline-start" />{!compact && '下载作品'}</Button>
    </div>
    <p className="result-meta">{run.profile.model} <span>·</span> {(run.result!.durationMs / 1000).toFixed(1)} 秒 <span>·</span> {run.result!.width} × {run.result!.height}</p>
  </>;
}
export function Preview() {
  const s = useSession(); const run = s.runs.find(r => r.id === s.studioRun); const [original, setOriginal] = useState(false);
  return <section className="preview-section" aria-labelledby="preview-heading">
    <div className="preview-toolbar"><h2 id="preview-heading">效果预览</h2>{s.samplePreview ? <span className="sample-label">示例作品</span> : !s.busy && <Button variant="ghost" onClick={() => { s.showExample(); setOriginal(false); }}>看看示例 <ArrowLeftRight data-icon="inline-end" /></Button>}</div>
    {s.samplePreview ? <>
      <div className="sample-canvas"><img className="sample-main" src={original ? '/images/example-person.png' : '/images/example-dog.png'} alt={original ? 'AI 创作的示例原始人像' : '示例作品：身穿绿色衬衫的柴犬狗头人'} />
        <button className="original-inset" onClick={() => setOriginal(v => !v)} aria-label={original ? '查看狗头人示例' : '查看示例原始人像'}><img src={original ? '/images/example-dog.png' : '/images/example-person.png'} alt="" /><span><ArrowLeftRight size={13} aria-hidden="true" />{original ? '狗头人' : '原始人像'}</span></button>
      </div>
      <div className="preview-caption"><p>只换狗头，姿势和穿搭照旧。</p><span>示例由 AI 创作，不代表已接入模型的实测效果。</span></div>
    </> : run ? <RunOutput key={run.id} run={run} /> : <div className="result-canvas empty-canvas"><Empty><EmptyHeader><EmptyMedia><ScanFace size={36} strokeWidth={1.25} /></EmptyMedia><EmptyTitle>{s.portrait ? '照片就位，下一步换个狗头' : '新形象，从一张照片开始'}</EmptyTitle><EmptyDescription>{s.portrait ? '选好犬种和模型，点击「生成狗头人」。结果会出现在这里。' : '上传清晰的单人人像，或先用示例照片试一试。'}</EmptyDescription></EmptyHeader></Empty></div>}
    {!s.samplePreview && !run && <p className="preview-note"><Image size={14} aria-hidden="true" /> 以保留原图构图为目标，实际效果由所选模型决定。</p>}
  </section>;
}
