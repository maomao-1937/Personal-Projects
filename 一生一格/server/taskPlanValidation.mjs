function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function textWithin(value, max, required = true) {
  return typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
}

function timestamp(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)) return false;
  return isoDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}

/** Optional profile fields preserve compatibility with existing version 3 profiles. */
export function validGoals(value) {
  if (!Array.isArray(value) || value.length > 20) return false;
  const goalIds = new Set();
  const actionIds = new Set();
  return value.every((goal) => {
    if (!goal || typeof goal !== 'object' || Array.isArray(goal)) return false;
    if (!textWithin(goal.id, 100) || goalIds.has(goal.id) || !textWithin(goal.title, 120)
      || !['interview', 'running', 'general'].includes(goal.kind) || !textWithin(goal.context, 500, false)) return false;
    goalIds.add(goal.id);
    if (!isoDate(goal.createdOn) || !isoDate(goal.deadline) || goal.deadline < goal.createdOn || !Array.isArray(goal.actions) || goal.actions.length > 60) return false;
    return goal.actions.every((action) => {
      if (!action || typeof action !== 'object' || Array.isArray(action) || !textWithin(action.id, 100) || actionIds.has(action.id)) return false;
      actionIds.add(action.id);
      return textWithin(action.title, 160) && textWithin(action.criterion, 300)
        && isoDate(action.scheduledDate) && action.scheduledDate >= goal.createdOn && action.scheduledDate <= goal.deadline
        && typeof action.time === 'string' && /^(?:|(?:[01]\d|2[0-3]):[0-5]\d)$/.test(action.time)
        && (action.estimatedMinutes === null || (Number.isInteger(action.estimatedMinutes) && action.estimatedMinutes >= 1 && action.estimatedMinutes <= 1440))
        && timestamp(action.completedAt)
        && (action.feedback === null || ['distracted', 'unclear', 'anxious', 'busy'].includes(action.feedback));
    });
  });
}
