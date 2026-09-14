import { useState } from "react";
import { BrainCircuit, ArrowUpRight, Eye, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useSession } from "@/lib/session";
import { directorPresets, directorCatalog, directorSchema, directorCanSee } from "../../shared/agent";

export function DirectorSettings() {
  const s = useSession();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<import("../../shared/agent").DirectorConfig>({ ...directorPresets[0], model: "", inputMode: "text" as const });
  const [key, setKey] = useState("");
  const [provider, setProvider] = useState("0");
  const catalog = provider === "custom" ? undefined : directorCatalog[Number(provider)];
  const selectedModel = catalog?.models.find(m => m.id === config.model);
  const vision = directorCanSee(config);
  function changeOpen(value: boolean) {
    setOpen(value);
    if (value) {
      const current = s.director || { ...directorPresets[0], model: "", inputMode: "text" as const };
      setConfig(current);
      const index = directorPresets.findIndex(p => p.endpoint === current.endpoint);
      setProvider(index < 0 ? "custom" : String(index));
      setKey(s.directorKey);
    } else setKey("");
  }
  return (
    <section className="director-settings">
      <BrainCircuit size={26} strokeWidth={1.5} aria-hidden="true" />
      <div>
        <h2>创作助手的理解模型</h2>
        <p>{s.director
          ? `${s.director.name} · ${directorCanSee(s.director) ? "视觉策划与检查" : "文字策划，不读图"} · ${s.hasDirectorKey ? "已配置，待实际调用验证" : "需补充本次会话密钥"}`
          : "OpenAI、千问、Gemini、DeepSeek、智谱、MiniMax、Kimi，也可自定义兼容接口。"}</p>
      </div>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild><Button variant="outline" disabled={s.busy}>{s.director ? "管理助手" : "接入助手"}</Button></DialogTrigger>
        <DialogContent className="director-dialog">
          <DialogHeader>
            <DialogTitle>连接创作助手</DialogTitle>
            <DialogDescription>选择厂商，填写你要使用的模型 ID，再核对输入能力。绘图模型仍单独负责出图。</DialogDescription>
          </DialogHeader>
          <form onSubmit={e => {
            e.preventDefault();
            const parsed = directorSchema.safeParse(config);
            if (!parsed.success || ((!s.hasDirectorKey || config.endpoint !== s.director?.endpoint || !!key) && (key.trim().length < 8 || /[\r\n]/.test(key)))) {
              toast.error("请填写名称、模型 ID、有效的 HTTPS 接口和 API Key。"); return;
            }
            s.saveDirector({ ...parsed.data, inputMode: vision ? "vision" : "text" }, key.trim());
            changeOpen(false);
            toast.success("助手配置已保存，尚未验证接口能力。");
          }}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="director-provider">供应商</FieldLabel>
                <Select value={provider} onValueChange={v => {
                  if (v === provider || (v !== "custom" && !directorPresets[Number(v)])) return;
                  setProvider(v); setKey("");
                  setConfig(v === "custom" ? { name: "自定义助手", model: "", endpoint: "", inputMode: "text" } : { ...directorPresets[Number(v)], model: "", inputMode: "text" });
                }}>
                  <SelectTrigger id="director-provider" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent position="popper">
                    {directorCatalog.map((p, i) => <SelectItem key={p.label} value={String(i)}>{p.label}</SelectItem>)}
                    <SelectItem value="custom">自定义 · OpenAI 兼容</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="director-model">模型 ID</FieldLabel>
                <Input id="director-model" required maxLength={160} autoComplete="off" spellCheck={false} placeholder="粘贴供应商控制台中的模型 ID" value={config.model} onChange={e => setConfig({ ...config, model: e.target.value })} />
              </Field>
              <div className="director-capability" aria-live="polite">
                {vision ? <Eye size={18} aria-hidden="true" /> : <MessageSquare size={18} aria-hidden="true" />}
                <div>
                  <strong>{vision ? "看图 → 制定方案 → 绘图 → 检查" : "文字策划 → 绘图"}</strong>
                  <p>{vision ? "理解模型会接收原图；检查时还会接收生成结果。" : "理解模型只接收文字，不看照片、不检查作品、不自动修正。原图仍会交给绘图模型。"}</p>
                </div>
              </div>
              {catalog && <p className="director-provider-note">{catalog.note} <a href={catalog.docs} target="_blank" rel="noreferrer">官方文档 <ArrowUpRight size={12} aria-hidden="true" /></a></p>}
              <Field>
                <FieldLabel htmlFor="director-mode">模型输入能力 · 需支持工具调用</FieldLabel>
                <Select value={config.inputMode} onValueChange={v => setConfig({ ...config, inputMode: v as "vision" | "text" })}>
                  <SelectTrigger id="director-mode" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="text">文字与工具调用</SelectItem>
                    <SelectItem value="vision" disabled={selectedModel?.mode === "text"}>图像、文字与工具调用</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="director-key">API Key · 已保存的连接可留空</FieldLabel>
                <Input id="director-key" type="password" autoComplete="new-password" placeholder="输入所选供应商的 API Key" value={key} onChange={e => setKey(e.target.value)} />
              </Field>
            </FieldGroup>
            <details className="director-advanced" open={provider === "custom" ? true : undefined}>
              <summary>配置名称与接口地址</summary>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="director-name">配置名称</FieldLabel>
                  <Input id="director-name" required maxLength={48} value={config.name} onChange={e => setConfig({ ...config, name: e.target.value })} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="director-endpoint">完整 Chat Completions 地址</FieldLabel>
                  <Input id="director-endpoint" required type="url" placeholder="https://api.example.com/v1/chat/completions" value={config.endpoint} onChange={e => { setConfig({ ...config, endpoint: e.target.value }); setKey(""); }} />
                </Field>
              </FieldGroup>
              <p>自定义域名需由站点维护者加入 ALLOWED_API_HOSTS 并重启服务。使用通用 API 密钥；订阅或 Coding Plan 不一定适用。</p>
            </details>
            <p className="settings-note">模型 ID 由你填写，保存不发起调用；能力与费用以供应商为准。</p>
            <DialogFooter>
              {s.director && <Button type="button" variant="ghost" onClick={() => { s.removeDirector(); changeOpen(false); }}>移除助手</Button>}
              <Button type="submit">保存助手配置</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
