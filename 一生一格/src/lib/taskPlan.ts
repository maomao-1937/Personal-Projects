export type GoalKind = 'interview' | 'running' | 'general';
export type FeedbackReason = 'distracted' | 'unclear' | 'anxious' | 'busy';
export type GoalAction = {
  id: string;
  title: string;
  criterion: string;
  scheduledDate: string;
  time: string;
  estimatedMinutes: number | null;
  completedAt: string;
  feedback: FeedbackReason | null;
};
export type TaskGoal = {
  id: string;
  title: string;
  kind: GoalKind;
  context: string;
  deadline: string;
  createdOn: string;
  actions: GoalAction[];
};
export type GoalInput = {
  title: string;
  kind: GoalKind;
  context: string;
  deadline: string;
  estimatedMinutes: number | null;
  frequency: 'daily' | 'alternate';
};

const DAY_MS = 86_400_000;
const kinds = ['interview', 'running', 'general'];
const reasons = ['distracted', 'unclear', 'anxious', 'busy'];

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Read the device's calendar date, including when its UTC day differs. */
export function localDate(date: Date = new Date()): string {
  if (!Number.isFinite(date.getTime())) throw new RangeError('日期无效');
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** UTC here represents calendar days only, so daylight saving cannot change the count. */
export function daysUntil(from: string, to: string): number {
  if (!validDate(from) || !validDate(to)) throw new RangeError('日期无效');
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function addDays(iso: string, days: number): string {
  if (!validDate(iso) || !Number.isSafeInteger(days)) throw new RangeError('日期无效');
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) throw new RangeError('日期超出范围');
  return date.toISOString().slice(0, 10);
}

function textWithin(value: unknown, max: number, required = true): value is string {
  return typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
}

function duration(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 1440);
}

function timestamp(value: unknown): value is string {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)) return false;
  return validDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}

function validGoal(value: unknown): value is TaskGoal {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const goal = value as TaskGoal;
  if (!textWithin(goal.id, 100) || !textWithin(goal.title, 120) || !kinds.includes(goal.kind) || !textWithin(goal.context, 500, false)) return false;
  if (!validDate(goal.createdOn) || !validDate(goal.deadline) || goal.deadline < goal.createdOn || !Array.isArray(goal.actions) || goal.actions.length > 60) return false;
  const ids = new Set<string>();
  return goal.actions.every((action) => {
    if (!action || typeof action !== 'object' || Array.isArray(action) || !textWithin(action.id, 100) || ids.has(action.id)) return false;
    ids.add(action.id);
    return textWithin(action.title, 160) && textWithin(action.criterion, 300)
      && validDate(action.scheduledDate) && action.scheduledDate >= goal.createdOn && action.scheduledDate <= goal.deadline
      && typeof action.time === 'string' && /^(?:|(?:[01]\d|2[0-3]):[0-5]\d)$/.test(action.time)
      && duration(action.estimatedMinutes) && timestamp(action.completedAt)
      && (action.feedback === null || reasons.includes(action.feedback));
  });
}

/** A damaged goal must not prevent an existing calendar or other goals from loading. */
export function normalizeGoals(value: unknown): TaskGoal[] {
  if (!Array.isArray(value)) return [];
  const goalIds = new Set<string>();
  const actionIds = new Set<string>();
  const normalized: TaskGoal[] = [];
  for (const candidate of value) {
    if (!validGoal(candidate) || goalIds.has(candidate.id) || candidate.actions.some((action) => actionIds.has(action.id))) continue;
    goalIds.add(candidate.id);
    candidate.actions.forEach((action) => actionIds.add(action.id));
    normalized.push({
      id: candidate.id, title: candidate.title, kind: candidate.kind, context: candidate.context,
      deadline: candidate.deadline, createdOn: candidate.createdOn,
      actions: candidate.actions.map((action) => ({
        id: action.id, title: action.title, criterion: action.criterion, scheduledDate: action.scheduledDate,
        time: action.time, estimatedMinutes: action.estimatedMinutes, completedAt: action.completedAt, feedback: action.feedback,
      })),
    });
    if (normalized.length === 20) break;
  }
  return normalized;
}

export function createGoal(input: GoalInput, today: string): TaskGoal {
  if (!textWithin(input.title, 120) || !kinds.includes(input.kind) || !textWithin(input.context, 500, false)
    || !duration(input.estimatedMinutes) || !['daily', 'alternate'].includes(input.frequency)) throw new RangeError('目标信息无效');
  const span = daysUntil(today, input.deadline);
  if (span < 0) throw new RangeError('目标日期不能早于今天');
  const title = input.title.trim();
  const context = input.context.trim();
  const makeAction = (actionTitle: string, criterion: string, scheduledDate: string): GoalAction => ({
    id: crypto.randomUUID(), title: actionTitle, criterion, scheduledDate, time: '',
    estimatedMinutes: input.estimatedMinutes, completedAt: '', feedback: null,
  });
  let actions: GoalAction[];
  if (input.kind === 'running') {
    const interval = input.frequency === 'alternate' ? 2 : 1;
    const count = Math.min(60, Math.floor(span / interval) + 1);
    actions = Array.from({ length: count }, (_, index) => makeAction(
      `第 ${index + 1} 次跑步`,
      input.estimatedMinutes === null ? '完成这次跑步，记录用时与感受。' : `按自己的节奏跑 ${input.estimatedMinutes} 分钟，记录完成情况。`,
      addDays(today, index * interval),
    ));
  } else {
    const phases = input.kind === 'interview' ? [
      ['梳理岗位要求', context ? `阅读「${context.slice(0, 180)}」的岗位要求，列出 3 项能力与对应经历。` : '阅读目标岗位要求，列出 3 项能力与对应经历。'],
      ['整理经历与简历', '选出 3 段相关经历，写清自己的行动和结果。'],
      ['准备常见问题', '写出自我介绍，以及 3 个常见问题的回答要点。'],
      ['练习一次模拟面试', '口头完成一次自我介绍和问答，记录一个需要改进的地方。'],
      ['确认面试安排', '确认时间、地点或会议链接，整理材料和要提问的问题。'],
    ] : [
      ['明确完成标准', `写下「${title}」完成时的具体结果，以及第一个可执行步骤。`],
      ['推进核心步骤', '完成一个核心步骤，留下可检查的结果。'],
      ['检查结果并收尾', '对照完成标准检查结果，处理一项遗漏。'],
    ];
    actions = phases.map(([phase, criterion], index) => makeAction(phase, criterion, addDays(today, Math.floor(span * index / (phases.length - 1)))));
  }
  return { id: crypto.randomUUID(), title, kind: input.kind, context, deadline: input.deadline, createdOn: today, actions };
}

export function nextAction(goal: TaskGoal): GoalAction | undefined {
  return goal.actions.filter((action) => !action.completedAt).reduce<GoalAction | undefined>((earliest, action) => {
    const key = action.scheduledDate + (action.time || '00:00');
    const earliestKey = earliest && earliest.scheduledDate + (earliest.time || '00:00');
    return !earliestKey || key < earliestKey ? action : earliest;
  }, undefined);
}

export function feedbackSuggestion(goal: TaskGoal, action: GoalAction, reason: FeedbackReason): string {
  const brief = (value: string, max: number) => {
    const characters = Array.from(value);
    return characters.length > max ? characters.slice(0, max).join('') + '…' : value;
  };
  const task = `「${brief(action.title, 36)}」`;
  const target = `「${brief(goal.title, 36)}」`;
  const criterion = brief(action.criterion, 70);
  const context = goal.context ? `围绕「${brief(goal.context, 24)}」，` : '';
  const duration = action.estimatedMinutes === null ? '' : `（预计 ${action.estimatedMinutes} 分钟）`;
  const speakingPhase = /模拟|试讲|口头|演练/.test(action.title) || /口头|试讲/.test(action.criterion);
  switch (reason) {
    case 'distracted': {
      if (goal.kind === 'running') return `先把跑鞋放到门口，选好熟悉的路线，再开始${task}${duration}。`;
      if (goal.kind === 'interview') {
        if (/岗位|要求/.test(action.title)) return `收起分心来源，打开岗位要求，为${task}先圈出一项关键能力。`;
        if (/简历|经历/.test(action.title)) return `收起分心来源，打开简历，为${task}先写清一段经历中自己的行动。`;
        if (speakingPhase) return `收起分心来源，打开回答提纲，为${task}先试讲一段自我介绍。`;
        if (/问题|回答/.test(action.title)) return `收起分心来源，为${task}先写第一条问题的回答要点。`;
        if (/安排|确认/.test(action.title)) return `收起分心来源，打开面试邀请，为${task}先核对时间和地点或会议链接。`;
      }
      return `收起分心来源，为${task}先完成标准中的第一项：${criterion}`;
    }
    case 'unclear': return goal.kind === 'running'
      ? `为${target}先穿好跑鞋，选一条熟悉路线，再按${task}的原安排行动：${criterion}`
      : `为${target}的${task}先写出完成标准中的第一项：${criterion}`;
    case 'anxious': {
      if (goal.kind === 'running') return `为${task}${duration}选一段熟悉路线，按自己的节奏完成这次跑步，允许过程不完美。`;
      if (goal.kind === 'interview' && speakingPhase) return `${context}先私下试讲${task}的一段回答，允许第一遍不完整，听回录音后只修改一个地方。`;
      return `${context}允许先写粗稿，为${task}只补完成标准中的第一项：${criterion}`;
    }
    case 'busy': return goal.kind === 'running'
      ? `查看真实可用的时间，为${task}${duration}重新安排日期，再保存安排。`
      : `查看真实可用的时间，为${target}的${task}${duration}重新安排日期或缩小完成标准，再保存安排。`;
  }
}
