import type { ProfileData } from './profileStorage';
import type { LegacyDraftProof } from './accountDraft';

export type AccountUser = { id: string; legacyDraft?: LegacyDraftProof };
export type RemoteProfile = { profile: ProfileData | null; revision: number };

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export class ProfileConflictError extends ApiError {
  constructor(public remote: RemoteProfile) { super('账号数据已在另一台设备上更新', 409); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    ...init,
  });
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new ApiError('服务暂时不可用，请稍后重试', response.status); }
  if (response.status === 409 && path === '/api/profile') throw new ProfileConflictError(payload as RemoteProfile);
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'error' in payload && typeof payload.error === 'string'
      ? payload.error : '请求失败，请稍后重试';
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export const getSession = () => request<{ user: AccountUser | null }>('/api/session');
export const loginAccount = (inviteCode: string) =>
  request<{ user: AccountUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ inviteCode }) });
export const logout = () => request<{ ok: true }>('/api/auth/logout', { method: 'POST', body: '{}' });
export const getRemoteProfile = () => request<RemoteProfile>('/api/profile');
export const putRemoteProfile = (profile: ProfileData, revision: number) => request<RemoteProfile>('/api/profile', { method: 'PUT', body: JSON.stringify({ profile, revision }) });
