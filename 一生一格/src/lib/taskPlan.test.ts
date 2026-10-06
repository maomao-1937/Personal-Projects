import assert from 'node:assert/strict';
import test from 'node:test';
import { addDays, createGoal, daysUntil, feedbackSuggestion, localDate, nextAction, normalizeGoals, type GoalInput } from './taskPlan.ts';

const input: GoalInput = { title: '准备产品经理面试', kind: 'interview', context: '产品经理', deadline: '2026-10-17', estimatedMinutes: null, frequency: 'daily' };

test('interview phases span today through deadline with unique IDs and concrete criteria', () => {
  const goal = createGoal(input, '2026-10-03');
  assert.deepEqual(goal.actions.map((action) => action.scheduledDate), ['2026-10-03', '2026-10-06', '2026-10-10', '2026-10-13', '2026-10-17']);
  assert.equal(new Set([goal.id, ...goal.actions.map((action) => action.id)]).size, 6);
  assert.match(goal.actions[0].criterion, /产品经理/);
  assert.ok(goal.actions.every((action) => action.criterion && action.scheduledDate <= goal.deadline && action.completedAt === '' && action.feedback === null));
  assert.deepEqual(normalizeGoals([goal]), [goal]);
  const sameDay = createGoal({ ...input, deadline: '2026-10-03' }, '2026-10-03');
  assert.ok(sameDay.actions.every((action) => action.scheduledDate === '2026-10-03'));
});

test('running preserves duration, calendar cadence and the 60 action bound', () => {
  const running = { ...input, title: '恢复跑步', kind: 'running' as const, estimatedMinutes: 37, deadline: '2026-10-10' };
  const daily = createGoal(running, '2026-10-03');
  const alternate = createGoal({ ...running, frequency: 'alternate' }, '2026-10-03');
  assert.equal(daily.actions.length, 8);
  assert.deepEqual(alternate.actions.map((action) => action.scheduledDate), ['2026-10-03', '2026-10-05', '2026-10-07', '2026-10-09']);
  assert.ok([...daily.actions, ...alternate.actions].every((action) => action.estimatedMinutes === 37 && action.criterion.includes('37')));
  const longPlan = createGoal({ ...running, deadline: '2027-12-31' }, '2026-10-03');
  assert.equal(longPlan.actions.length, 60);
  assert.deepEqual(normalizeGoals([longPlan]), [longPlan]);
});

test('calendar arithmetic handles leap days, year boundaries and daylight saving dates', () => {
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-09', -1), '2026-03-08');
  assert.equal(daysUntil('2026-03-07', '2026-03-09'), 2);
  assert.equal(daysUntil('2026-11-01', '2026-11-02'), 1);
  assert.equal(daysUntil('2026-10-05', '2026-10-03'), -2);
  assert.equal(localDate(new Date(2026, 9, 3, 23, 59)), '2026-10-03');
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', 'not-a-date', '0000-01-01']) {
    assert.throws(() => daysUntil(date, '2026-10-03'), RangeError);
    assert.throws(() => addDays(date, 1), RangeError);
    assert.throws(() => createGoal({ ...input, deadline: date }, '2026-10-03'), RangeError);
  }
  assert.throws(() => addDays('9999-12-31', 1), RangeError);
  assert.throws(() => addDays('0001-01-01', -1), RangeError);
  assert.throws(() => addDays('2026-10-03', 0.5), RangeError);
  assert.throws(() => createGoal({ ...input, deadline: '2026-10-02' }, '2026-10-03'), RangeError);
});

test('generation validates input and keeps generated actions inside storage limits', () => {
  for (const estimatedMinutes of [0, -1, 1.5, 1441, NaN]) assert.throws(() => createGoal({ ...input, estimatedMinutes }, '2026-10-03'), RangeError);
  assert.throws(() => createGoal({ ...input, title: ' ' }, '2026-10-03'), RangeError);
  assert.throws(() => createGoal({ ...input, context: '岗'.repeat(501) }, '2026-10-03'), RangeError);
  assert.equal(normalizeGoals([createGoal({ ...input, title: '事'.repeat(120), context: '岗'.repeat(500) }, '2026-10-03')]).length, 1);
  assert.equal(normalizeGoals([createGoal({ ...input, kind: 'general' }, '2026-10-03')]).length, 1);
});

test('next action selects earliest unfinished date and time without mutating order', () => {
  const goal = createGoal(input, '2026-10-03');
  goal.actions[0].completedAt = '2026-10-03T09:00:00.000Z';
  goal.actions[2].scheduledDate = goal.actions[1].scheduledDate;
  goal.actions[1].time = '16:00';
  goal.actions[2].time = '09:00';
  goal.actions.reverse();
  const originalIds = goal.actions.map((action) => action.id);
  assert.equal(nextAction(goal)?.time, '09:00');
  assert.deepEqual(goal.actions.map((action) => action.id), originalIds);
  goal.actions.forEach((action) => { action.completedAt = '2026-10-03T09:00:00.000Z'; });
  assert.equal(nextAction(goal), undefined);
  goal.actions[0].completedAt = '';
  assert.equal(nextAction(goal)?.id, goal.actions[0].id);
});

test('feedback gives a concrete suggestion tied to the goal, task and supplied duration', () => {
  const interview = createGoal(input, '2026-10-03');
  for (const reason of ['distracted', 'unclear', 'anxious', 'busy'] as const) {
    assert.ok(feedbackSuggestion(interview, interview.actions[0], reason).includes(interview.actions[0].title));
  }
  assert.match(feedbackSuggestion(interview, interview.actions[0], 'anxious'), /产品经理/);
  const running = createGoal({ ...input, title: '周末跑步', kind: 'running', estimatedMinutes: 37 }, '2026-10-03');
  assert.match(feedbackSuggestion(running, running.actions[0], 'busy'), /37 分钟/);
  assert.match(feedbackSuggestion(running, running.actions[0], 'unclear'), /周末跑步/);
});

test('running feedback prepares shoes and route while retaining the planned duration', () => {
  const running = createGoal({ ...input, title: '恢复晨跑', kind: 'running', estimatedMinutes: 37 }, '2026-10-03');
  const before = structuredClone(running);
  const distracted = feedbackSuggestion(running, running.actions[0], 'distracted');
  assert.match(distracted, /跑鞋/);
  assert.match(distracted, /路线/);
  assert.match(distracted, /37 分钟/);
  for (const reason of ['distracted', 'unclear', 'anxious', 'busy'] as const) {
    const suggestion = feedbackSuggestion(running, running.actions[0], reason);
    assert.doesNotMatch(suggestion, /材料|试讲|回答|粗稿/);
    assert.match(suggestion, /37/);
  }
  assert.deepEqual(running, before);
});

test('interview distraction suggestions match the current preparation phase', () => {
  const interview = createGoal(input, '2026-10-03');
  const expected = [/打开岗位要求.*关键能力/, /打开简历.*经历/, /第一条问题.*回答要点/, /回答提纲.*试讲/, /面试邀请.*核对时间/];
  interview.actions.forEach((action, index) => {
    const suggestion = feedbackSuggestion(interview, action, 'distracted');
    assert.match(suggestion, expected[index]);
    assert.ok(suggestion.includes(action.title));
  });
});

test('interview anxiety suggests speaking only for speaking phases and rough drafts for other phases', () => {
  const interview = createGoal(input, '2026-10-03');
  interview.actions.forEach((action, index) => {
    const suggestion = feedbackSuggestion(interview, action, 'anxious');
    assert.ok(suggestion.includes(action.title));
    assert.match(suggestion, /产品经理/);
    if (index === 3) assert.match(suggestion, /试讲.*回答/);
    else {
      assert.match(suggestion, /粗稿/);
      assert.doesNotMatch(suggestion, /试讲|录音/);
      assert.ok(suggestion.includes(action.criterion));
    }
  });
  const edited = { ...interview.actions[0], title: '整理自己的准备重点', criterion: '写下一个待确认的问题。' };
  assert.match(feedbackSuggestion(interview, edited, 'anxious'), /写下一个待确认的问题/);
  assert.doesNotMatch(feedbackSuggestion(interview, edited, 'anxious'), /试讲/);
});

test('feedback keeps long edited titles, criteria and context readable and concise', () => {
  const interview = createGoal({ ...input, title: '目标'.repeat(60), context: '岗位职责'.repeat(125) }, '2026-10-03');
  const action = { ...interview.actions[0], title: '准备内容'.repeat(40), criterion: '具体标准'.repeat(75) };
  for (const reason of ['distracted', 'unclear', 'anxious', 'busy'] as const) {
    const suggestion = feedbackSuggestion(interview, action, reason);
    assert.ok(Array.from(suggestion).length < 180);
    assert.ok(suggestion.includes('…'));
    assert.equal((suggestion.match(/「/g) ?? []).length, (suggestion.match(/」/g) ?? []).length);
  }
});

test('normalization isolates corrupt goals, rejects duplicate IDs and does not alias input', () => {
  const valid = createGoal(input, '2026-10-03');
  const corrupt = structuredClone(valid);
  corrupt.id = 'corrupt';
  corrupt.actions[0].scheduledDate = '2026-02-30';
  const loaded = normalizeGoals([null, corrupt, valid, valid]);
  assert.deepEqual(loaded, [valid]);
  loaded[0].actions[0].title = '本机修改';
  assert.notEqual(valid.actions[0].title, '本机修改');
  assert.deepEqual(normalizeGoals(undefined), []);
  assert.deepEqual(normalizeGoals({ goals: [] }), []);
  const oversized = Array.from({ length: 21 }, () => createGoal(input, '2026-10-03'));
  assert.equal(normalizeGoals(oversized).length, 20);
});
