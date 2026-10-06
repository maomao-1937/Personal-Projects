import { useState } from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';
import MindCharacters, { type CharacterRole } from './MindCharacters';
import { playCharacterSound } from '../lib/characterSound';
import type { MindGuide } from '../lib/profileStorage';
import { daysUntil, type GoalAction, type TaskGoal } from '../lib/taskPlan';
import './mind-cockpit.css';

export type MindRole = CharacterRole;

const INTRO: Record<MindRole, { title: string; body: string }> = {
  rational: {
    title: '理性决策者是什么？',
    body: '它会考虑眼前的任务、长期目标和行动的后果。在这个比喻里，它负责看清方向，决定现在做什么更合适。',
  },
  monster: {
    title: '恐惧怪兽是什么？',
    body: '它平时常常睡着；当截止日或糟糕的后果临近，就会突然醒来。猴子害怕它，理性决策者因此有机会重新掌舵。',
  },
  monkey: {
    title: '猴子是什么？',
    body: '它偏爱眼前轻松、有趣的事，容易从理性决策者手里抢走方向盘。',
  },
};

const DESCRIPTION: Record<MindRole, string> = {
  rational: '理性决策者掌舵：你看得见当下，也记得自己想去哪里。',
  monkey: '猴子想要眼前的轻松。先看见它，不急着责备自己。',
  monster: '恐惧怪兽醒了：也许有件事正在逼近。先认出这种感觉。',
};

type MindCockpitProps = {
  selected: MindRole;
  onSelect: (role: MindRole) => void;
  guide: MindGuide;
  onGuideChange: (guide: MindGuide) => void;
  guideDraftSaved: boolean;
  goal?: TaskGoal;
  action?: GoalAction;
  today?: string;
};

export default function MindCockpit({ selected, onSelect, guide, onGuideChange, guideDraftSaved, goal: taskGoal, action, today }: MindCockpitProps) {
  const [openRole, setOpenRole] = useState<MindRole | null>(null);
  const [editingGuide, setEditingGuide] = useState(false);
  const goal = taskGoal?.title ?? guide.goal.trim();

  function activateRole(role: MindRole) {
    if (guide.soundEnabled) playCharacterSound(role);
    onSelect(role);
    setOpenRole((current) => current === role ? null : role);
    setEditingGuide(false);
  }

  function returnToDirection() {
    onSelect('rational');
    setOpenRole(null);
    setEditingGuide(false);
    if (action) document.getElementById('my-actions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return <section className={`mind-cockpit mind-cockpit--${selected}`} aria-labelledby="mind-cockpit-title">
    <div className="mind-cockpit__top"><span className="mind-cockpit__eyebrow">心智驾驶舱</span><div className="mind-cockpit__sound-controls"><button className="mind-cockpit__sound" type="button" aria-label={guide.soundEnabled ? '关闭角色音效' : '开启角色音效'} aria-pressed={guide.soundEnabled} onClick={() => onGuideChange({ ...guide, soundEnabled: !guide.soundEnabled })}>{guide.soundEnabled ? <Volume2 size={14} aria-hidden="true"/> : <VolumeX size={14} aria-hidden="true"/>}<span>音效{guide.soundEnabled ? '开' : '关'}</span></button></div></div>
    <div className="mind-cockpit__heading"><h2 id="mind-cockpit-title">现在谁在掌舵？</h2></div>
    <MindCharacters selected={selected} openRole={openRole} onOpen={activateRole}/>
    <p className="mind-cockpit__instruction">点人物，看看此刻是谁在掌舵。</p>
    {openRole && <div className={`mind-cockpit__intro mind-cockpit__intro--${openRole}`} id="mind-character-intro" role="region" aria-labelledby="mind-character-intro-title">
      <div className="mind-cockpit__intro-top"><span>角色小档案</span><button type="button" onClick={() => setOpenRole(null)} aria-label="关闭角色简介"><X size={15} aria-hidden="true"/></button></div>
      <h3 id="mind-character-intro-title">{INTRO[openRole].title}</h3>
      <p>{INTRO[openRole].body}</p>
      {openRole === 'monkey' && <div className="mind-cockpit__nudge" aria-live="polite">
        <p>{action ? `你想推进「${goal}」。这一步是：${action.title}。` : goal ? `你想做的是「${goal}」。要把方向盘拿回来吗？` : '猴子想带你跑偏了。停一下，想想你现在真正想做什么。'}</p>
        <div className="mind-cockpit__nudge-actions"><button type="button" onClick={returnToDirection}>回到我的方向</button><button type="button" onClick={() => setOpenRole(null)}>稍后再说</button></div>
        {!taskGoal && <button className="mind-cockpit__personalize" type="button" aria-expanded={editingGuide} onClick={() => setEditingGuide((current) => !current)}>{editingGuide ? '收起' : goal ? '修改我的提醒' : '写一句自己的提醒（可选）'}</button>}
        {editingGuide && <div className="mind-cockpit__guide-form">
          <label htmlFor="mind-guide-goal">我想做的事</label>
          <input id="mind-guide-goal" type="text" value={guide.goal} maxLength={80} placeholder="例如：整理简历" onChange={(event) => onGuideChange({ ...guide, goal: event.target.value.slice(0, 80) })}/>
          {!guideDraftSaved && <p role="alert">本机保存失败，请检查浏览器存储设置。</p>}
        </div>}
      </div>}
      {openRole !== 'monkey' && taskGoal && action && <div className="mind-cockpit__nudge"><p>{openRole === 'rational' ? `「${taskGoal.title}」下一步：${action.title}。完成标准：${action.criterion}` : `${today && daysUntil(today, taskGoal.deadline) >= 0 ? `距目标日期还有 ${daysUntil(today, taskGoal.deadline)} 天。` : '可以重新调整目标安排。'}还有 ${taskGoal.actions.filter((item) => !item.completedAt).length} 项行动，先接上「${action.title}」。`}</p><div className="mind-cockpit__nudge-actions"><a href="#my-actions" className="mind-cockpit__action-link">看看我的下一步</a></div></div>}
      <small>这是理解拖延体验的比喻，不是对人的分类。</small>
    </div>}
    <p className="mind-cockpit__description" aria-live="polite">{DESCRIPTION[selected]}</p>
  </section>;
}
