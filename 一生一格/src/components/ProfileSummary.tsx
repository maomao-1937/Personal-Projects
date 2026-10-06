import type { ProfileData } from '../lib/profileStorage';
import { nextAction, normalizeGoals } from '../lib/taskPlan';

export default function ProfileSummary({ label, profile }: { label: string; profile: ProfileData | null }) {
  const goals = normalizeGoals(profile?.goals);
  const completed = goals.reduce((count, goal) => count + goal.actions.filter((action) => action.completedAt).length, 0);
  const total = goals.reduce((count, goal) => count + goal.actions.length, 0);
  return <div className="profile-summary"><span>{label}</span><strong>{!profile ? '还没有资料' : profile.calendarConfigured === false ? '尚未设置生日' : `${profile.birthDate.replaceAll('-', '/')} 出生`}</strong>
    <small>{profile ? `${Object.values(profile.notes).filter((value) => value.trim()).length} 条周记录 · ${goals.length} 个目标` : '可以导入本机记录'}</small>
    {goals.length > 0 && <details><summary>行动已完成 {completed} / {total} · 查看目标</summary><ul>{goals.map((goal) => { const action = nextAction(goal); return <li key={goal.id}><b>{goal.title}</b><small>{goal.actions.filter((item) => item.completedAt).length}/{goal.actions.length} 项已完成 · 目标日期 {goal.deadline}</small>{action && <small>下一步：{action.title} · {action.scheduledDate}{action.time && ` ${action.time}`}</small>}</li>; })}</ul></details>}
  </div>;
}
