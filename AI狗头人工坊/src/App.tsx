import { useEffect, useState, lazy, Suspense } from 'react';
import { Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom';
import { Dog, Settings2, Plus, History, ArrowLeft, Columns2 } from 'lucide-react';
import { Toaster } from 'sonner';
import { SessionProvider, useSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Studio from '@/pages/Studio';
const Models = lazy(() => import('@/pages/Models'));
const Compare = lazy(() => import('@/pages/Compare'));
function Shell() {
  const s = useSession(); const location = useLocation(); const navigate = useNavigate();
  const [history, setHistory] = useState(false);
  const studio = location.pathname === '/';
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  return <div className={`app-shell ${studio ? 'studio-shell' : 'settings-shell'}`}>
    <a className="skip-link" href="#main">跳到主要内容</a>
    <header className="app-bar">
      <Link className="app-brand" to="/" aria-label="狗头人工坊首页"><Dog size={26} strokeWidth={1.7} /><span>狗头人工坊</span></Link>
      <div className="project-crumb">{studio ? s.portrait ? s.portrait.name.replace(/\.[^.]+$/, '') : '新创作' : location.pathname === '/models' ? '模型设置' : '模型实验'}</div>
      <nav aria-label="主导航">
        {!studio && <Button variant="ghost" asChild><Link to="/" aria-label="返回创作"><ArrowLeft size={16} /><span>返回创作</span></Link></Button>}
        <Button variant="ghost" disabled={s.busy || s.preparing || !s.hydrated} onClick={() => { s.newProject(); navigate('/'); }} aria-label="新建创作"><Plus size={18} /><span>新建</span></Button>
        <Button variant="ghost" disabled={s.busy || s.preparing} onClick={() => setHistory(true)} aria-label="打开项目历史"><History size={18} /><span>历史</span></Button>
        <Button variant="ghost" asChild aria-label="模型设置"><Link to="/models"><Settings2 size={18} /><span>设置</span></Link></Button>
      </nav>
    </header>
    <main id="main" className={studio ? 'studio-main' : 'utility-main'}>
      {s.saveError && <p className="storage-error" role="alert">{s.saveError}</p>}
      <Suspense fallback={<p className="page-loading" role="status">正在打开页面…</p>}><Routes>
        <Route path="/" element={<Studio />} /><Route path="/models" element={<Models />} /><Route path="/compare" element={<Compare />} />
        <Route path="*" element={<div className="page-intro"><h1>这里还没有作品。</h1><Link to="/">返回创作</Link></div>} />
      </Routes></Suspense>
    </main>
    <Dialog open={history} onOpenChange={setHistory}><DialogContent className="history-dialog"><DialogHeader><DialogTitle>最近的创作</DialogTitle><DialogDescription>照片与作品仅保存在当前浏览器。清除网站数据会移除这些项目，请下载需要保留的作品。</DialogDescription></DialogHeader>
      <div className="project-list">{s.projects.filter(p => p.portrait).length ? s.projects.filter(p => p.portrait).map(p => <button className="project-entry" key={p.id} onClick={async () => { await s.openProject(p.id); navigate('/'); setHistory(false); }}>
        <img src={p.runs.find(r => r.id === p.studioRun)?.result?.image || p.portrait!.src} alt="" />
        <span><strong>{p.title}</strong><small>{p.runs.filter(r => r.result).length} 张作品 · {new Date(p.updatedAt).toLocaleDateString('zh-CN')}</small></span><ArrowLeft className="entry-arrow" size={16} />
      </button>) : <div className="history-empty"><History size={28} /><p>从第一张人像开始</p><span>创作过的项目会自动出现在这里。</span></div>}</div>
      <Button variant="ghost" asChild><Link to="/compare" onClick={() => setHistory(false)}><Columns2 size={16} />打开模型实验</Link></Button>
    </DialogContent></Dialog>
    <Toaster position="top-center" richColors closeButton />
  </div>;
}
export default function App() { return <SessionProvider><Shell /></SessionProvider>; }
