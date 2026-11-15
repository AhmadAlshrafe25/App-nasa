import type {
  CheckInRequest, CheckInResponse, Dashboard, FamilyMessage, FamilyMessageIn,
  SupportResponse, SyncResult, SyncStatus,
} from '@workspace/api-client-react';

/** The Python API is routed at the site root under /api, independent of this app's base path. */
export const API_PREFIX = '/api';
export const ASTRONAUT_ID = 'AST-01';
// Dashboard anomaly scoring can approach four seconds on a cold start.
export const API_TIMEOUT_MS = 10_000;

export type ApiResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'offline' }
  | { status: 'error'; message: string };

type ValidationDetail = { loc?: unknown[]; msg?: string };

function describeDetail(detail: unknown, fallback: string): string {
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const parts = (detail as ValidationDetail[]).map(item => {
      const field = Array.isArray(item.loc) ? String(item.loc[item.loc.length - 1] ?? '') : '';
      return [field, item.msg].filter(Boolean).join(': ');
    }).filter(Boolean);
    if (parts.length) return parts.join('; ');
  }
  return fallback;
}

/**
 * Calls the API with a short timeout. Network failures, timeouts, gateway errors and
 * non-JSON replies (a proxy or app shell page instead of the API) all count as offline.
 */
export async function apiRequest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_PREFIX}${path}`, {
      method: init.method ?? 'GET',
      headers: init.body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
    if (response.status === 502 || response.status === 503 || response.status === 504) return { status: 'offline' };
    const isJson = (response.headers.get('content-type') ?? '').includes('json');
    if (!isJson) return { status: 'offline' };
    const payload: unknown = await response.json();
    if (response.ok) return { status: 'ok', data: payload as T };
    const detail = (payload as { detail?: unknown } | null)?.detail;
    return { status: 'error', message: describeDetail(detail, `Request failed (${response.status}).`) };
  } catch {
    return { status: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

const astronautPath = `/astronauts/${ASTRONAUT_ID}`;

/** allow_online is false so check-in state is never sent to an outside language model from this demo. */
export const getSupport = () => apiRequest<SupportResponse>('/companion/support', { method: 'POST', body: { astronaut_id: ASTRONAUT_ID, allow_online: false } });
export const getFamilyMessages = () => apiRequest<FamilyMessage[]>(`/family/messages/${ASTRONAUT_ID}`);
export const markMessageViewed = (id: number) => apiRequest<FamilyMessage>(`/family/messages/${id}/viewed`, { method: 'PATCH' });
export const createFamilyMessage = (input: Omit<FamilyMessageIn, 'astronaut_id' | 'media_type'>) =>
  apiRequest<FamilyMessage>('/family/messages', { method: 'POST', body: { ...input, astronaut_id: ASTRONAUT_ID, media_type: 'text' } });
export const getSyncStatus = () => apiRequest<SyncStatus>('/mission/sync-status');
export const syncEarth = () => apiRequest<SyncResult>('/mission/sync', { method: 'POST' });
export const queueSampleCheckin = (reading: CheckInRequest) => apiRequest<CheckInResponse>(`${astronautPath}/checkin`, { method: 'POST', body: reading });
export const getDashboard = () => apiRequest<Dashboard>(`${astronautPath}/dashboard`);
