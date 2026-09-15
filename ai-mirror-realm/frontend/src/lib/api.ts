import axios, { AxiosError } from 'axios';

export const UNAUTHORIZED_EVENT = 'api:unauthorized';
export const CUSTOM_STYLE_ID = 'system-custom-prompt';

export interface ApiErrorBody {
  detail?: string | { msg?: string; message?: string; code?: string } | { msg?: string; message?: string; code?: string }[];
  message?: string;
  code?: string;
}

export interface StyleRecord {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  preview_url?: string | null;
  sort_order: number;
  prompt_template?: string;
  is_active?: boolean;
}

export type PortraitStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface PortraitRecord {
  id: string;
  style_id: string;
  selfie_url?: string;
  result_url?: string | null;
  status: PortraitStatus;
  error_message?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface UploadResponse {
  url: string;
  filename?: string;
}

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error: unknown, fallback = '请求失败，请稍后重试'): string {
  if (!axios.isAxiosError<ApiErrorBody>(error)) return fallback;
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (detail && !Array.isArray(detail) && typeof detail === 'object' && detail.message) {
    return detail.message;
  }
  if (Array.isArray(detail)) {
    const message = detail.find((item) => item?.msg)?.msg;
    if (message) return message.replace(/^Value error,\s*/i, '');
  }
  if (error.response?.data?.message) return error.response.data.message;
  if (!error.response) return '无法连接服务，请检查网络后重试';
  return fallback;
}

export function isNotFoundError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

export function getStyles(): Promise<StyleRecord[]> {
  return api.get<StyleRecord[]>('/styles').then((response) => response.data);
}

export function getStyle(id: string): Promise<StyleRecord> {
  return api.get<StyleRecord>(`/styles/${encodeURIComponent(id)}`).then((response) => response.data);
}

export function uploadSelfie(file: File): Promise<UploadResponse> {
  const body = new FormData();
  body.append('file', file);
  return api.post<UploadResponse>('/uploads/selfie', body).then((response) => response.data);
}

export interface CreatePortraitInput {
  selfieUrl: string;
  styleId?: string;
  userPrompt?: string;
}

export function createPortrait({ styleId, selfieUrl, userPrompt }: CreatePortraitInput): Promise<PortraitRecord> {
  return api
    .post<PortraitRecord>('/portraits', {
      style_id: styleId || null,
      selfie_url: selfieUrl,
      user_prompt: userPrompt?.trim() || null,
    })
    .then((response) => response.data);
}

export function getPortrait(id: string): Promise<PortraitRecord> {
  return api.get<PortraitRecord>(`/portraits/${encodeURIComponent(id)}`).then((response) => response.data);
}

export function getPortraitStatus(id: string, signal?: AbortSignal): Promise<PortraitRecord> {
  return api
    .get<PortraitRecord>(`/portraits/${encodeURIComponent(id)}/status`, { signal })
    .then((response) => response.data);
}

export function getPortraits(): Promise<PortraitRecord[]> {
  return api.get<PortraitRecord[]>('/portraits').then((response) => response.data);
}

export function deletePortrait(id: string): Promise<void> {
  return api.delete(`/portraits/${encodeURIComponent(id)}`).then(() => undefined);
}

export async function downloadProtectedImage(url: string, filename: string): Promise<void> {
  const path = url.startsWith('/api') ? url.slice(4) : url;
  const response = await api.get<Blob>(path, { responseType: 'blob' });
  const mime = String(response.headers['content-type'] || response.data.type || '').split(';')[0].toLowerCase();
  const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const filenameBase = filename.replace(/\.(?:png|jpe?g|webp)$/i, '');
  const objectUrl = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `${filenameBase}.${extension}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export default api;
