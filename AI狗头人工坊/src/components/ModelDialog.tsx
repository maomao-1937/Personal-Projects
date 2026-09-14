import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import { useSession } from '@/lib/session';
import { profileSchema, providerInfo, providerTypes, type ModelProfile, type ProviderType } from '../../shared/models';

export function ModelDialog({ open, onOpenChange, profile, returnFocus }: { returnFocus?: HTMLElement | null; open: boolean; onOpenChange: (v: boolean) => void; profile: ModelProfile | null }) {
  const s = useSession();
  const [draft, setDraft] = useState({ provider: 'openai' as ProviderType, name: '', endpoint: '', model: '', key: '' });
  const { provider, name, endpoint, model, key } = draft;
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) { setDraft(value => ({ ...value, key: '' })); return; }
    setDraft({
      provider: profile?.provider || 'openai', name: profile?.name || '',
      endpoint: profile?.endpoint || providerInfo.openai.endpoint, model: profile?.model || '',
      key: profile ? s.keys[profile.id] || '' : '',
    });
    setErrors({});
  }, [open, profile]);
  function changeProvider(value: ProviderType) {
    setDraft(old => ({ ...old, provider: value, endpoint: providerInfo[value].endpoint, model: '', key: '' }));
    setErrors({});
  }
  function save(event: FormEvent) {
    event.preventDefault();
    const parsed = profileSchema.safeParse({ id: profile?.id || crypto.randomUUID(), name: name.trim() || providerInfo[provider].short, provider, endpoint, model });
    const nextErrors: Record<string, string> = {};
    if (!parsed.success) for (const issue of parsed.error.issues) nextErrors[String(issue.path[0])] = issue.path[0] === 'endpoint' ? '请填写完整 HTTPS 端点，不能在地址里放密钥或查询参数。' : issue.path[0] === 'model' ? '请填写供应商控制台提供的模型 ID。' : '名称最多 48 个字符。';
    if ((!profile || !s.managedProfile(profile.id) || endpoint !== profile.endpoint || !!key) && (!key.trim() || key.trim().length < 8 || key.length > 2048 || /[\r\n]/.test(key))) nextErrors.key = '请输入有效的 API Key（至少 8 个字符，不包含换行）。';
    if (!profile && s.profiles.length >= 30) nextErrors.name = '最多保存 30 个模型，请先移除不需要的配置。';
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    s.saveProfile(parsed.data!, key.trim()); onOpenChange(false); toast.success('会话配置已更新，可在设置页保存到服务器');
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="model-dialog" onCloseAutoFocus={event => { if (returnFocus?.isConnected) { event.preventDefault(); returnFocus.focus(); } }}><DialogHeader><DialogTitle>{profile ? '编辑模型' : '添加一个模型'}</DialogTitle><DialogDescription>填入供应商的接口信息，就能在工坊中调用。</DialogDescription></DialogHeader>
    <form onSubmit={save} noValidate autoComplete="off">
      <FieldGroup>
        <Field><FieldLabel htmlFor="provider">接口类型</FieldLabel><Select value={provider} onValueChange={v => changeProvider(v as ProviderType)}><SelectTrigger id="provider" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{providerTypes.map(p => <SelectItem key={p} value={p}>{providerInfo[p].label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
        <Field data-invalid={!!errors.name}><FieldLabel htmlFor="model-name">显示名称 <span className="optional">选填</span></FieldLabel><Input id="model-name" value={name} maxLength={48} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder={`例如：我的 ${providerInfo[provider].short}`} aria-invalid={!!errors.name} />{errors.name && <FieldError>{errors.name}</FieldError>}</Field>
        <Field data-invalid={!!errors.model}><FieldLabel htmlFor="model-id">模型 ID</FieldLabel><Input id="model-id" name="drawing-model-id" type="text" required placeholder="粘贴供应商控制台中的模型 ID" value={model} maxLength={160} onChange={e => setDraft({ ...draft, model: e.target.value })} autoComplete="off" spellCheck={false} aria-invalid={!!errors.model} />{errors.model && <FieldError>{errors.model}</FieldError>}</Field>
        <Field data-invalid={!!errors.endpoint}><FieldLabel htmlFor="endpoint">完整接口地址</FieldLabel><Input id="endpoint" name="drawing-api-endpoint" value={endpoint} maxLength={600} onChange={e => setDraft({ ...draft, endpoint: e.target.value })} type="url" autoComplete="off" spellCheck={false} aria-invalid={!!errors.endpoint} aria-describedby="endpoint-help" /><FieldDescription id="endpoint-help">{providerInfo[provider].hint}</FieldDescription>{errors.endpoint && <FieldError>{errors.endpoint}</FieldError>}</Field>
        <Field data-invalid={!!errors.key}><FieldLabel htmlFor="api-key">API Key</FieldLabel><Input id="api-key" name="provider-api-key" type="password" autoComplete="new-password" spellCheck={false} value={key} maxLength={2048} onChange={e => setDraft({ ...draft, key: e.target.value })} placeholder="在这里粘贴密钥，不需要发到聊天中" aria-invalid={!!errors.key} aria-describedby="key-help" /><FieldDescription id="key-help">当前先保留为会话连接；在设置页保存到服务器后，刷新仍可用。已有服务端密钥留空可保持。保存不调用模型。</FieldDescription>{errors.key && <FieldError>{errors.key}</FieldError>}</Field>
      </FieldGroup>
      <div className="model-doc-link"><a href={providerInfo[provider].docs} target="_blank" rel="noreferrer">查看官方接口文档 <ArrowUpRight size={14} aria-hidden="true" /></a></div>
      <DialogFooter><DialogClose asChild><Button type="button" variant="outline">取消</Button></DialogClose><Button type="submit">保存模型</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
