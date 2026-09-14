import type { Portrait, Run } from './session';
import type { AgentHistory, DesignPlan } from '../../shared/agent';
import type { Breed, Style } from '../../shared/breeds';
import { publicProfile } from '../../shared/models';

export type Project = {
  id: string; title: string; updatedAt: string; portrait: Portrait | null;
  compareSourceId?: string | null; compareGroup?: string | null;
  runs: Run[]; studioRun: string | null; breed: Breed; customBreed: string;
  extra: string; style: Style; freedom: 'head' | 'scene'; agentMode: boolean;
  delegateBreed: boolean; agentPlan: DesignPlan | null; agentHistory: AgentHistory;
};
// Deliberate whitelist: connection keys, admin tokens and runtime objects never enter IDB.
export function projectRecord(p: Project): Project {
  return {
    id: p.id, title: p.title, updatedAt: p.updatedAt, portrait: p.portrait,
    runs: p.runs.map(r => ({
      id: r.id, group: r.group, projectId: r.projectId, parentId: r.parentId,
      profile: publicProfile(r.profile), prompt: r.prompt, request: r.request,
      breed: r.breed, breedLabel: r.breedLabel, portrait: r.portrait,
      originalPortrait: r.originalPortrait, startedAt: r.startedAt,
      status: r.status === 'loading' ? 'error' : r.status,
      error: r.status === 'loading' ? '上次等待已中断，可重新发起。供应商可能仍在处理。' : r.error,
      result: r.result, origin: r.origin, review: r.review, plan: r.plan, history: r.history, trace: r.trace,
      settings: r.settings ? { customBreed: r.settings.customBreed, style: r.settings.style, freedom: r.settings.freedom } : undefined,
    })),
    compareSourceId: p.compareSourceId, compareGroup: p.compareGroup,
    studioRun: p.studioRun, breed: p.breed, customBreed: p.customBreed,
    extra: p.extra, style: p.style, freedom: p.freedom, agentMode: p.agentMode,
    delegateBreed: p.delegateBreed, agentPlan: p.agentPlan, agentHistory: p.agentHistory,
  };
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('goutou.projects.v4', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function listProjects(): Promise<Project[]> {
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const req = db.transaction('projects').objectStore('projects').getAll();
    req.onsuccess = () => resolve((req.result as Project[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    req.onerror = () => reject(req.error);
  }); } finally { db.close(); }
}
export async function saveProject(project: Project) {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('projects', 'readwrite');
    tx.objectStore('projects').put(projectRecord(project));
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  }); } finally { db.close(); }
}
