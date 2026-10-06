import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, CalendarDays, Check, ChevronDown, Circle, Flag, ListChecks, Pencil, Plus, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import { addDays, createGoal, daysUntil, feedbackSuggestion, nextAction, type FeedbackReason, type GoalAction, type GoalInput, type GoalKind, type TaskGoal } from '../lib/taskPlan';
import type { MindRole } from '../lib/profileStorage';
import './goal-board.css';

const KINDS: Record<GoalKind, string> = { interview: '面试准备', running: '跑步计划', general: '自己的事情' };
const REASONS: Record<FeedbackReason, string> = { distracted: '被娱乐带走了', unclear: '不知道怎么开始', anxious: '有点担心做不好', busy: '今天确实没空' };

function dateLabel(date: string, today: string) {
  const days = daysUntil(today, date);
  return days === 0 ? '今天' : days === 1 ? '明天' : `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = ref.current; node?.showModal(); return () => { if (node?.open) node.close(); }; }, []);
  return <dialog ref={ref} className="goal-dialog" aria-labelledby="goal-dialog-title" onCancel={onClose} onClick={(event) => { if (event.target === ref.current) onClose(); }}>
    <div className="goal-dialog__inside"><div className="goal-dialog__header"><h2 id="goal-dialog-title">{title}</h2><button type="button" className="goal-icon-button" aria-label="关闭" onClick={onClose}><X size={20}/></button></div>{children}</div>
  </dialog>;
}

function CreateGoal({ today, onCreate, onClose }: { today: string; onCreate: (goal: TaskGoal) => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<GoalKind>('interview');
  const [manualKind, setManualKind] = useState(false);
  const [deadline, setDeadline] = useState(addDays(today, 10));
  const [manualDeadline, setManualDeadline] = useState(false);
  const [context, setContext] = useState('');
  const [minutes, setMinutes] = useState('');
  const [frequency, setFrequency] = useState<GoalInput['frequency']>('alternate');
  const [error, setError] = useState('');

  function changeTitle(value: string) {
    setTitle(value);
    if (!manualKind) setKind(/跑步|慢跑|跑公里/.test(value) ? 'running' : /面试|求职/.test(value) ? 'interview' : 'general');
    const match = /(\d{1,3})\s*天后/.exec(value);
    if (!manualDeadline && match) setDeadline(addDays(today, Number(match[1])));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      onCreate(createGoal({ title: title.trim(), kind, context: context.trim(), deadline, estimatedMinutes: minutes ? Number(minutes) : null, frequency }, today));
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '请检查填写的内容'); }
  }

  return <Modal title="给想做的事，一个位置" onClose={onClose}><form className="goal-form" onSubmit={submit}>
    <label htmlFor="goal-title">最近想完成什么？</label>
    <input id="goal-title" value={title} maxLength={120} required placeholder="例如：10天后要面试，还没开始准备" onChange={(event) => changeTitle(event.target.value)} autoFocus/>
    <div className="goal-kind-options" aria-label="事情类型">{(Object.keys(KINDS) as GoalKind[]).map((value) => <button type="button" key={value} aria-pressed={kind === value} onClick={() => { setKind(value); setManualKind(true); }}>{KINDS[value]}</button>)}</div>
    <label htmlFor="goal-deadline">{kind === 'running' ? '计划安排到哪天？' : '希望在哪天前完成？'}</label>
    <input id="goal-deadline" type="date" value={deadline} min={today} max="9999-12-31" required onInput={(event) => { setDeadline(event.currentTarget.value); setManualDeadline(true); }}/>
    <label htmlFor="goal-context">{kind === 'interview' ? '面试什么岗位？（可选）' : '有什么想补充的？（可选）'}</label>
    <input id="goal-context" value={context} maxLength={500} placeholder={kind === 'interview' ? '例如：产品经理，应届生' : '你的想法、当前情况，或希望留下的成果'} onChange={(event) => setContext(event.target.value)}/>
    {kind === 'running' && <div className="goal-form__columns"><div><label htmlFor="goal-minutes">预计每次多久（分钟，可选）</label><input id="goal-minutes" type="number" min={1} max={1440} step={1} value={minutes} placeholder="按自己的情况填写" onChange={(event) => setMinutes(event.target.value)}/></div><div><label htmlFor="goal-frequency">安排频率</label><select id="goal-frequency" value={frequency} onChange={(event) => setFrequency(event.target.value as GoalInput['frequency'])}><option value="alternate">隔天</option><option value="daily">每天</option></select></div></div>}
    <p className="goal-form__hint"><Sparkles size={14}/>根据填写内容生成本地建议，行动和日期都可以修改。{kind === 'running' && deadline && daysUntil(today, deadline) / (frequency === 'daily' ? 1 : 2) >= 60 && '这次先安排前60次跑步。'}</p>
    {error && <p className="goal-error" role="alert">{error}</p>}
    <button className="goal-primary" type="submit">生成我的安排 <ArrowRight size={17}/></button>
  </form></Modal>;
}

function EditAction({ action, goal, onSave, onClose }: { action: GoalAction; goal: TaskGoal; onSave: (action: GoalAction) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(action);
  const [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.criterion.trim()) { setError('写清这一步和完成标准，再保存。'); return; }
    if (!draft.scheduledDate || draft.scheduledDate > goal.deadline) { setError('行动日期需要在目标日期之前或当天。'); return; }
    onSave({ ...draft, title: draft.title.trim(), criterion: draft.criterion.trim() });
    onClose();
  }
  return <Modal title="把这一步，调成适合自己" onClose={onClose}><form className="goal-form" onSubmit={submit}>
    <label htmlFor="action-title">这一步做什么</label><input id="action-title" value={draft.title} maxLength={160} required onChange={(event) => { const value = event.target.value; setDraft((current) => ({ ...current, title: value })); }}/>
    <label htmlFor="action-criterion">做到什么算完成</label><textarea id="action-criterion" value={draft.criterion} maxLength={300} rows={3} required onChange={(event) => { const value = event.target.value; setDraft((current) => ({ ...current, criterion: value })); }}/>
    <div className="goal-form__columns"><div><label htmlFor="action-date">安排日期</label><input id="action-date" type="date" value={draft.scheduledDate} min={goal.createdOn} max={goal.deadline} required onInput={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, scheduledDate: value })); }}/></div><div><label htmlFor="action-time">计划几点做（可选）</label><input id="action-time" type="time" value={draft.time} onInput={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, time: value })); }}/></div></div>
    <label htmlFor="action-minutes">预计耗时（分钟，可选）</label><input id="action-minutes" type="number" min={1} max={1440} step={1} value={draft.estimatedMinutes ?? ''} onChange={(event) => { const value = event.target.value; setDraft((current) => ({ ...current, estimatedMinutes: value ? Number(value) : null })); }}/>
    <p className="goal-form__hint">这里只保存你的安排时间；暂未设置系统通知。</p>
    {error && <p className="goal-error" role="alert">{error}</p>}<button className="goal-primary" type="submit">保存调整 <Check size={17}/></button>
  </form></Modal>;
}

function EditGoal({ goal, onSave, onClose }: { goal: TaskGoal; onSave: (goal: TaskGoal) => void; onClose: () => void }) {
  const [title, setTitle] = useState(goal.title);
  const [deadline, setDeadline] = useState(goal.deadline);
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ ...goal, title: title.trim(), deadline, actions: goal.actions.map((item) => ({ ...item, scheduledDate: item.scheduledDate > deadline ? deadline : item.scheduledDate })) });
    onClose();
  }
  return <Modal title="调整目标" onClose={onClose}><form className="goal-form" onSubmit={submit}><label htmlFor="edit-goal-title">想完成的事</label><input id="edit-goal-title" value={title} required pattern=".*\S.*" maxLength={120} onChange={(event) => setTitle(event.target.value)}/><label htmlFor="edit-goal-deadline">目标日期</label><input id="edit-goal-deadline" type="date" min={goal.createdOn} max="9999-12-31" required value={deadline} onInput={(event) => setDeadline(event.currentTarget.value)}/><p className="goal-form__hint">提前目标日期时，之后的行动会移到该日。已完成的记录会保留；延后日期后可逐项调整计划。</p><button type="submit" className="goal-primary">保存目标 <Check size={17}/></button></form></Modal>;
}

type Props = { goals: TaskGoal[]; today: string; selectedId: string | null; onSelect: (id: string) => void; onChange: (goals: TaskGoal[]) => void; role: MindRole; preview: boolean; previewSaved: boolean; saveError: boolean; onRetry: () => void };

export default function GoalBoard({ goals, today, selectedId, onSelect, onChange, role, preview, previewSaved, saveError, onRetry }: Props) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<GoalAction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [finishingGoal, setFinishingGoal] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showCompleted, setShowCompleted] = useState(() => goals.length > 0 && goals.every((value) => !nextAction(value)));
  const [completion, setCompletion] = useState('');
  const candidateGoal = goals.find((value) => value.id === selectedId);
  const goal = candidateGoal && (showCompleted ? !nextAction(candidateGoal) : nextAction(candidateGoal)) ? candidateGoal : undefined;
  const action = goal ? nextAction(goal) : undefined;
  const complete = goals.filter((value) => !nextAction(value));
  const ongoing = goals.filter((value) => nextAction(value));
  const visibleGoals = showCompleted ? complete : ongoing;
  const done = goal?.actions.filter((value) => value.completedAt).length ?? 0;
  const days = goal ? daysUntil(today, goal.deadline) : 0;
  const overdue = action && action.scheduledDate < today;
  const future = action && action.scheduledDate > today;
  const reason = action?.feedback;
  const liveActionId = action?.id ?? '';

  useEffect(() => { setFeedbackOpen(false); setExpanded(false); setEditing(null); setEditingGoal(false); setDeleting(false); setFinishingGoal(false); setCompletion(''); }, [selectedId]);
  useEffect(() => { setFeedbackOpen(false); }, [liveActionId]);

  function replace(updated: TaskGoal) { onChange(goals.map((value) => value.id === updated.id ? updated : value)); setShowCompleted(!nextAction(updated)); }
  function updateAction(updated: GoalAction) { if (goal) replace({ ...goal, actions: goal.actions.map((value) => value.id === updated.id ? updated : value) }); }
  function finish() {
    if (!action) return;
    updateAction({ ...action, completedAt: new Date().toISOString(), feedback: null });
    setCompletion(`已完成「${action.title}」。这一步算数。`);
  }
  function switchGroup(completed: boolean) {
    setShowCompleted(completed);
    const first = (completed ? complete : ongoing)[0];
    if (first) onSelect(first.id);
  }

  return <section className="goal-board" id="my-actions" aria-labelledby="goal-board-title">
    <div className="goal-board__heading"><div><span className="goal-eyebrow"><Flag size={13}/> 留一点时间，给想做的事</span><h2 id="goal-board-title">这一周，向前一步。</h2></div><button type="button" className="goal-add" onClick={() => setCreating(true)} disabled={goals.length >= 20}><Plus size={17}/><span>新建目标</span></button></div>
    {goals.length > 0 && <><div className="goal-groups"><button type="button" aria-pressed={!showCompleted} onClick={() => switchGroup(false)}>进行中 <span>{ongoing.length}</span></button><button type="button" aria-pressed={showCompleted} onClick={() => switchGroup(true)}>已完成 <span>{complete.length}</span></button></div><div className="goal-tabs" aria-label="选择目标">{visibleGoals.map((value) => <button type="button" key={value.id} aria-pressed={goal?.id === value.id} onClick={() => onSelect(value.id)}>{value.title}</button>)}{visibleGoals.length === 0 && <span className="goal-tabs__empty">{showCompleted ? '完成的目标会留在这里。' : '暂时没有进行中的目标，给下一件事留个位置。'}</span>}</div></>}
    {goals.length === 0 ? <div className="goal-empty"><div className="goal-empty__copy"><span>从一件在意的事开始</span><h3>给未来一个日期，<br/>给今天一个行动。</h3><p>面试、跑步，或一直想做的事。</p><button type="button" onClick={() => setCreating(true)}>写下我的目标 <ArrowRight size={17}/></button></div><div className="goal-empty__art" aria-hidden="true"><i/><i/><i/><i/></div></div> : goal && <div className={`goal-card ${!action ? 'goal-card--complete' : ''}`}>
      <div className="goal-card__overview"><div><span className="goal-card__kind">{KINDS[goal.kind]}</span><h3>{goal.title}</h3><p><CalendarDays size={14}/>{dateLabel(goal.deadline, today)}{goal.kind === 'running' ? ' · 计划终点' : ' · 目标日期'}<span className="goal-countdown">{!action ? '已完成' : days > 0 ? `还有 ${days} 天` : days === 0 ? '今天到期' : `已过 ${Math.abs(days)} 天，可调整安排`}</span></p></div><div className="goal-progress"><strong>{done}<small> / {goal.actions.length}</small></strong><span>已完成行动</span><div role="progressbar" aria-label="目标完成进度" aria-valuenow={done} aria-valuemin={0} aria-valuemax={goal.actions.length}><i style={{ width: `${done / goal.actions.length * 100}%` }}/></div></div></div>
      {completion && <p className="goal-celebration" role="status"><Check size={15}/>{completion}</p>}
      {action ? <div className="goal-action"><div className="goal-action__top"><span className="goal-action__label"><i/>{future ? '接下来的一步' : overdue ? '待接上的一步' : '今天这一步'}</span><span>{dateLabel(action.scheduledDate, today)}{action.time && ` ${action.time}`}{action.estimatedMinutes && ` · 预计 ${action.estimatedMinutes} 分钟`}</span></div><h4>{action.title}</h4><p className="goal-criterion"><Check size={15}/><span>完成标准：{action.criterion}</span></p>
        {overdue && <p className="goal-action__gentle">这一步还在等你，今天继续或调整到合适的日期都可以。</p>}
        {future && <p className="goal-action__gentle">这一步安排在未来，也可以按自己的情况提前完成。</p>}
        {role === 'monkey' && <div className="goal-role-hint"><span>猴子想带你走神</span><p>先看这一件事：{action.title}。</p></div>}
        {role === 'monster' && <div className="goal-role-hint"><span>把担心落到一件具体的事</span><p>{days >= 0 ? `距目标日期还有 ${days} 天，` : '目标日期已经过去，'}当前还有 {goal.actions.length - done} 项行动待完成。先接上这一项。</p></div>}
        <div className="goal-action__buttons"><button className="goal-primary" type="button" onClick={finish}><Check size={17}/>完成了</button><button className="goal-secondary" type="button" aria-expanded={feedbackOpen} onClick={() => setFeedbackOpen(!feedbackOpen)}>卡住了</button><button className="goal-text-button" type="button" onClick={() => setEditing(action)}><Pencil size={14}/>调整安排</button></div>
        {feedbackOpen && <div className="goal-feedback"><p>现在，主要卡在哪里？</p><div>{(Object.keys(REASONS) as FeedbackReason[]).map((value) => <button type="button" key={value} aria-pressed={reason === value} onClick={() => updateAction({ ...action, feedback: value })}>{REASONS[value]}</button>)}</div></div>}
        {reason && <div className="goal-advice" aria-live="polite"><span><Sparkles size={14}/>给这一步的本地建议</span><p>{feedbackSuggestion(goal, action, reason)}</p>{reason === 'busy' && <button type="button" className="goal-text-button" onClick={() => setEditing(action)}>选一个合适的日期 <ArrowRight size={14}/></button>}</div>}
      </div> : <div className="goal-finished"><span><Check size={23}/></span><div><h4>这份安排，已经走完。</h4><p>完成记录已经留下。你可以继续新目标，也可以在计划里撤销某次完成。</p></div></div>}
      <div className="goal-card__footer"><button type="button" className="goal-text-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><ListChecks size={16}/>{expanded ? '收起计划' : '查看完整计划'}<ChevronDown className={expanded ? 'goal-rotated' : ''} size={14}/></button><span>安排来自本地建议</span><button className="goal-icon-button" type="button" aria-label="删除这个目标" onClick={() => setDeleting(true)}><Trash2 size={15}/></button></div>
      {expanded && <ol className="goal-plan">{goal.actions.map((item) => <li key={item.id} className={item.completedAt ? 'goal-plan__done' : ''}><button type="button" className="goal-plan__check" aria-label={item.completedAt ? `撤销完成：${item.title}` : `完成：${item.title}`} onClick={() => updateAction({ ...item, completedAt: item.completedAt ? '' : new Date().toISOString(), feedback: null })}>{item.completedAt ? <Check size={17}/> : <Circle size={17}/>}</button><div><span>{dateLabel(item.scheduledDate, today)}{item.time && ` ${item.time}`}</span><strong>{item.title}</strong><p>{item.criterion}</p></div><button type="button" className="goal-icon-button" aria-label={`调整：${item.title}`} onClick={() => setEditing(item)}>{item.completedAt ? <RotateCcw size={14}/> : <Pencil size={14}/>}</button></li>)}</ol>}
    </div>}
    {preview && goals.length > 0 && <p className="goal-preview-note">{previewSaved ? '当前是示例浏览，目标已保存在本机；登录后可选择导入自己的账号。' : '当前是示例浏览，目标尚未保存完成。'}</p>}
    {saveError && <p className="goal-error" role="alert">保存未完成，请重试。刷新前请保留当前页面。<button type="button" className="goal-text-button" onClick={onRetry}>重试保存</button></p>}
    {goals.length >= 20 && <p className="goal-preview-note">已达到20个目标。可以删除不再需要的目标后继续添加。</p>}
    {creating && <CreateGoal today={today} onClose={() => setCreating(false)} onCreate={(value) => { onChange([...goals, value]); onSelect(value.id); setShowCompleted(false); }}/>}
    {goal && <button type="button" className="goal-text-button" onClick={() => setEditingGoal(true)}><Pencil size={13}/>修改目标和日期</button>}
    {goal && action && expanded && <button type="button" className="goal-text-button" onClick={() => setFinishingGoal(true)}><Check size={13}/>标记整个目标完成</button>}
    {finishingGoal && goal && <Modal title="整个目标已经完成了吗？" onClose={() => setFinishingGoal(false)}><p className="goal-delete-copy">还有 {goal.actions.filter((item) => !item.completedAt).length} 项行动未记录完成。确认后会一起标记完成；之后可以在完整计划里逐项撤销。</p><div className="goal-delete-actions"><button type="button" className="goal-secondary" onClick={() => setFinishingGoal(false)}>继续当前计划</button><button type="button" className="goal-primary" onClick={() => { const completedAt = new Date().toISOString(); replace({ ...goal, actions: goal.actions.map((item) => ({ ...item, completedAt: item.completedAt || completedAt, feedback: null })) }); setFinishingGoal(false); setCompletion('已记录整个目标完成。'); }}>确认已完成</button></div></Modal>}
    {editingGoal && goal && <EditGoal goal={goal} onSave={replace} onClose={() => setEditingGoal(false)}/>}
    {editing && goal && <EditAction action={editing} goal={goal} onSave={updateAction} onClose={() => setEditing(null)}/>}
    {deleting && goal && <Modal title="删除这个目标？" onClose={() => setDeleting(false)}><p className="goal-delete-copy">「{goal.title}」和它的行动记录会一起删除。</p><div className="goal-delete-actions"><button className="goal-secondary" type="button" onClick={() => setDeleting(false)}>保留目标</button><button className="goal-danger" type="button" onClick={() => { const remaining = goals.filter((value) => value.id !== goal.id); onChange(remaining); const target = remaining.find((value) => showCompleted ? !nextAction(value) : nextAction(value)) ?? remaining[0]; if (target) { onSelect(target.id); setShowCompleted(!nextAction(target)); } setDeleting(false); }}>确认删除</button></div></Modal>}
  </section>;
}
