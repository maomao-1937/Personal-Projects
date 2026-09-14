import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Upload,
  Download,
  Pencil,
  Trash2,
  Plug,
  KeyRound,
  ArrowRight,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { PromptWriter } from "@/components/PromptWriter";
import { DirectorSettings } from "@/components/DirectorSettings";
import { ModelDialog } from "@/components/ModelDialog";
import { useSession } from "@/lib/session";
import { downloadJSON } from "@/lib/files";
import {
  configSchema,
  providerInfo,
  publicProfile,
  type ModelProfile,
} from "../../shared/models";

export default function Models() {
  const s = useSession();
  const [adminToken, setAdminToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const returnFocus = useRef<HTMLElement | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const removeFocus = useRef<HTMLButtonElement | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ModelProfile | null>(null);
  const [removing, setRemoving] = useState<ModelProfile | null>(null);
  function edit(profile: ModelProfile | null) {
    returnFocus.current = document.activeElement as HTMLElement;
    setEditing(profile);
    setOpen(true);
  }
  async function importProfiles(file?: File) {
    if (!file) return;
    try {
      if (file.size > 100_000)
        throw new Error("配置文件超过 100 KB，请确认文件内容。");
      const parsed = configSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success)
        throw new Error("配置格式不正确，请导入从工坊导出的 JSON 文件。");
      const unique = parsed.data.models
        .filter(
          (p) =>
            !s.profiles.some(
              (old) =>
                old.provider === p.provider &&
                old.model === p.model &&
                old.endpoint === p.endpoint,
            ),
        )
        .map((p) => publicProfile({ ...p, id: crypto.randomUUID() }));
      if (unique.length + s.profiles.length > 30)
        throw new Error("导入后将超过 30 个模型，请先移除不需要的配置。");
      s.persist([...s.profiles, ...unique]);
      toast.success(
        unique.length
          ? `已导入 ${unique.length} 个模型，请补充 API Key。`
          : "这些模型已存在，无需重复导入。",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "无法读取配置文件。",
      );
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  }
  return (
    <>
      <header className="page-intro with-action">
        <div>
          <h1>把你想试的模型，接进来。</h1>
          <p>管理自己的图像编辑接口，再回工坊看看它们的本领。</p>
        </div>
        <Button ref={addButton} disabled={s.busy} onClick={() => edit(null)}>
          <Plus data-icon="inline-start" />
          添加模型
        </Button>
      </header>
      <section className="managed-connections">
        <div><h2>配置一次，之后直接创作</h2><p>先添加绘图模型和创作助手，再保存到服务器。密钥不会下发到前台，刷新后仍可使用。</p><p>两种创作方式共用绘图模型；只有 Agent 创作会使用创作助手。</p></div>
        {s.connectionError && <p role="alert">{s.connectionError}<Button variant="link" onClick={() => void s.loadConnections()}>重新连接</Button></p>}
        {s.managed.adminMode === 'token' && <label>站点管理口令<input type="password" autoComplete="off" value={adminToken} onChange={e => setAdminToken(e.target.value)} /></label>}
        {s.managed.adminMode === 'disabled' ? <p>上线环境需维护者配置 STUDIO_ADMIN_TOKEN 后开启保存；当前仍可使用会话密钥。</p> : <>
          <label htmlFor="default-model">默认绘图模型<select id="default-model" value={s.selected || s.profiles[0]?.id || ''} onChange={e => s.setSelected(e.target.value)}><option value="" disabled>先添加一个模型</option>{s.profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <div className="managed-actions"><Button disabled={s.busy || saving || s.profiles.some(p => !s.canSaveKey(p.id))} onClick={async () => { setSaving(true); setSaveMessage(''); try { await s.saveConnections(adminToken); setAdminToken(''); setSaveMessage('已保存到服务器。刷新或切换创作方式，无需再次输入密钥。'); } catch (e) { setSaveMessage(e instanceof Error ? e.message : '保存失败，请重试。'); } finally { setSaving(false); } }}>{saving ? '正在保存…' : '保存连接与默认设置'}</Button><span>{s.managed.adminMode === 'local' ? '本机管理 · 保存不调用模型' : '受管理口令保护'}</span></div>
        </>}
        {saveMessage && <p role="status">{saveMessage}</p>}
      </section>
      <section className="prompt-writer-settings"><div><h2>DeepSeek 提示词生成器</h2><p>把简单想法扩写为可编辑的狗头人提示词，不调用绘图模型。</p></div><PromptWriter settings /></section>
      <DirectorSettings />
      <section className="models-section" aria-label="已添加的模型">
        <div className="section-heading">
          <h2>
            绘图模型 <span>{s.profiles.length}</span>
          </h2>
          <div className="toolbar-actions">
            <Button
              variant="ghost"
              disabled={s.busy}
              onClick={() => importInput.current?.click()}
            >
              <Upload data-icon="inline-start" />
              导入
            </Button>
            <Button
              variant="ghost"
              disabled={!s.profiles.length}
              onClick={() =>
                downloadJSON(
                  { version: 1, models: s.profiles.map(publicProfile) },
                  "狗头人工坊-模型配置.json",
                )
              }
            >
              <Download data-icon="inline-start" />
              导出
            </Button>
            <input
              ref={importInput}
              className="sr-only"
              type="file"
              accept="application/json,.json"
              aria-label="导入模型配置文件"
              tabIndex={-1}
              onChange={(e) => void importProfiles(e.target.files?.[0])}
            />
          </div>
        </div>
        {!s.profiles.length ? (
          <div className="models-empty">
            <Empty>
              <EmptyHeader>
                <EmptyMedia>
                  <Plug size={40} strokeWidth={1.25} />
                </EmptyMedia>
                <EmptyTitle>第一个模型，等你接入</EmptyTitle>
                <EmptyDescription>
                  准备好 API Key、模型 ID 和接口地址。
                  <br />
                  OpenAI / Gemini / 千问 / Seedream
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <div className="model-list">
            {s.profiles.map((p) => {
              const succeeded = s.runs.some(
                (r) =>
                  r.profile.id === p.id &&
                  r.status === "success" &&
                  r.profile.endpoint === p.endpoint &&
                  r.profile.model === p.model,
              );
              return (
                <article key={p.id} className="model-row">
                  <div className="provider-monogram" aria-hidden="true">
                    {providerInfo[p.provider].short.slice(0, 1)}
                  </div>
                  <div className="model-name">
                    <h3>{p.name}</h3>
                    <p>{p.model}</p>
                  </div>
                  <div className="model-connection">
                    <span className={s.hasKey(p.id) ? "connected" : ""}>
                      {s.hasKey(p.id) ? (
                        <Check size={14} aria-hidden="true" />
                      ) : (
                        <KeyRound size={14} aria-hidden="true" />
                      )}
                      {s.hasKey(p.id) ? s.managedProfile(p.id) ? "服务端已保存" : "会话可用，尚未持久保存" : "需补充密钥"}
                    </span>
                    <small>
                      {succeeded ? "已有生成记录" : "尚未验证生成效果"}
                    </small>
                  </div>
                  <div className="model-row-actions">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={s.busy}
                      aria-label={`编辑 ${p.name}`}
                      onClick={() => edit(p)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={s.busy}
                      aria-label={`移除 ${p.name}`}
                      onClick={(e) => {
                        removeFocus.current = e.currentTarget;
                        setRemoving(p);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {!!s.profiles.length && (
          <div className="return-studio">
            <Button variant="link" asChild>
              <Link to="/">
                回到创作工坊 <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        )}
      </section>
      <section className="connection-guide">
        <div>
          <h2>一个入口，不同模型。</h2>
          <p>
            同一协议的模型可以复用接入方式。更换模型
            ID，就能继续探索；接口协议不同，则需要对应适配。
          </p>
        </div>
        <dl>
          <div>
            <dt>两种连接方式</dt>
            <dd>会话密钥刷新后失效；保存到服务器后持续可用。导出文件不含密钥。</dd>
          </div>
          <div>
            <dt>配置保存 ≠ 接口已连通</dt>
            <dd>以实际生成结果判断，保存时不会发送测试请求。</dd>
          </div>
          <div>
            <dt>自定义服务地址</dt>
            <dd>支持已开放域名的兼容接口，新增域名需站点维护者配置。</dd>
          </div>
        </dl>
      </section>
      <ModelDialog
        open={open}
        onOpenChange={setOpen}
        profile={editing}
        returnFocus={returnFocus.current}
      />
      <Dialog open={!!removing} onOpenChange={(v) => !v && setRemoving(null)}>
        <DialogContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            (removeFocus.current?.isConnected
              ? removeFocus.current
              : addButton.current
            )?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>移除这个模型？</DialogTitle>
            <DialogDescription>
              将移除「{removing?.name}
              」的本地配置与会话密钥。保存连接与默认设置后，服务端连接也会移除；已有作品仍在项目历史中。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (removing) s.removeProfile(removing.id);
                setRemoving(null);
                toast.success("模型已移除");
              }}
            >
              移除模型
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
