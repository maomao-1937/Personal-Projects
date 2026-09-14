import { useRef, useState } from 'react';
import { ImageUp, ArrowUpRight, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSession } from '@/lib/session';
import { readImage } from '@/lib/files';

export function PortraitUpload() {
  const s = useSession(); const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false); const [error, setError] = useState(''); const [reading, setReading] = useState(false);
  async function upload(file?: File) {
    if (!file || s.busy || reading || s.preparing) return;
    setError(''); setReading(true); s.setPreparing(true);
    try { s.replacePortrait({ src: await readImage(file), name: file.name, isExample: false }); }
    catch (e) { setError(e instanceof Error ? e.message : '读取失败，请重试。'); }
    finally { setReading(false); s.setPreparing(false); if (input.current) input.current.value = ''; }
  }
  return <section className="upload-section" aria-label="你的照片">
    <div className="label-row"><h2 className="control-label">你的照片</h2>{s.portrait && <Button variant="ghost" size="icon" aria-label="移除照片" disabled={s.busy || reading || s.preparing} onClick={() => s.replacePortrait(null)}><X /></Button>}</div>
    <input ref={input} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label="选择人像文件" tabIndex={-1} onChange={e => void upload(e.target.files?.[0])} />
    <button type="button" className={`upload-target ${drag ? 'is-dragging' : ''} ${s.portrait ? 'has-photo' : ''}`} disabled={s.busy || reading || s.preparing} onClick={() => input.current?.click()} onDragOver={e => { e.preventDefault(); if (!s.busy) setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files[0]); }} aria-describedby="upload-help">
      {s.portrait ? <><img src={s.portrait.src} alt="已选择的原始人像" /><span className="replace-photo"><RefreshCw size={15} aria-hidden="true" /> 更换照片</span></> : <><ImageUp size={30} strokeWidth={1.5} aria-hidden="true" /><strong>{reading ? '正在读取照片…' : '上传人像'}</strong><span>或将照片拖到这里</span></>}
    </button>
    <p id="upload-help" className="upload-help">{s.portrait ? <span className="filename">{s.portrait.name}</span> : 'JPG、PNG、WebP · 最大 10 MB'}</p>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <Button variant="link" className="example-link" disabled={s.busy || reading || s.preparing} onClick={() => void s.useExample()}>使用示例人像 <ArrowUpRight data-icon="inline-end" /></Button>
  </section>;
}
