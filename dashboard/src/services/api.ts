/**
 * API service with automatic token refresh
 */

const API_URL = import.meta.env.VITE_API_URL || '';

// In-memory access token storage
let accessToken: string | null = null;

/**
 * Set the access token for API requests
 */
export function setAccessToken(token: string | null) {
  accessToken = token;
}

/**
 * Get the current access token
 */
export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Try to refresh the access token using the refresh token cookie
 * @returns true if refresh succeeded, false otherwise
 */
async function tryRefreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Include cookies
    });

    if (!response.ok) return false;

    const data = await response.json();
    accessToken = data.data.accessToken;
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch wrapper with automatic token refresh
 * - Adds Authorization header if access token is available
 * - On 401, attempts to refresh token and retry the request
 * - Redirects to login if refresh fails
 */
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${API_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies for refresh token
  });

  // If 401 and not the refresh endpoint itself, try to refresh
  if (response.status === 401 && !endpoint.includes('/auth/refresh')) {
    const refreshed = await tryRefreshToken();

    if (refreshed) {
      // Retry original request with new token
      (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
      response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });
    } else {
      // Refresh failed, clear token and redirect to login
      accessToken = null;
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  return response;
}

/**
 * Helper for GET requests
 */
export async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await apiFetch(endpoint);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  const data = await response.json();
  return data.data;
}

/**
 * Helper for POST requests
 */
export async function apiPost<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await apiFetch(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  const data = await response.json();
  return data.data;
}

/**
 * Helper for PUT requests
 */
export async function apiPut<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await apiFetch(endpoint, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  const data = await response.json();
  return data.data;
}

/**
 * Helper for DELETE requests
 */
export async function apiDelete<T>(endpoint: string): Promise<T> {
  const response = await apiFetch(endpoint, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  const data = await response.json();
  return data.data;
}

// --- Agent-specific API functions ---

/**
 * Kill agent response type
 */
export interface KillAgentResponse {
  agentId: string;
  status: 'killed';
  method: 'SIGTERM' | 'SIGKILL';
}

/**
 * Kill an agent by ID
 * @param agentId The ID of the agent to kill
 * @returns Kill response with status and method used
 */
export async function killAgent(agentId: string): Promise<KillAgentResponse> {
  return apiPost<KillAgentResponse>(`/api/agents/${agentId}/kill`);
}

// --- Story-specific API functions ---

/**
 * Retry story response type
 * Story 4.4: AC2, AC3, AC4
 */
export interface RetryStoryResponse {
  storyId: string;
  status: string;
  agentId: string;
}

/**
 * Retry story full response including meta and optional warning
 */
export interface RetryStoryFullResponse {
  data: RetryStoryResponse;
  meta: {
    timestamp: string;
    retryCount: number;
  };
  warning?: string;
}

/**
 * Retry a failed or killed story
 * Story 4.4: AC2 - Retry action success
 * @param storyId The ID of the story to retry
 * @returns Retry response with status, agentId, and optional warning
 */
export async function retryStory(storyId: string): Promise<RetryStoryFullResponse> {
  const response = await apiFetch(`/api/stories/${storyId}/retry`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to retry story' }));
    throw new Error(error.error || 'Failed to retry story');
  }

  return response.json();
}

// --- History API functions (Story 4.7) ---

import type {
  ExecutionRun,
  ExecutionRunWithEvents,
  PaginationMeta,
} from '../types/history';

export interface HistoryResponse {
  data: ExecutionRun[];
  meta: PaginationMeta & { timestamp: string };
}

export interface RunDetailResponse {
  data: ExecutionRunWithEvents;
  meta: { timestamp: string };
}

/**
 * Fetch execution history with optional filters and pagination
 * @param options Query options including filters and pagination
 * @returns List of execution runs with pagination metadata
 */
export async function fetchHistory(options: {
  project?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  page?: number;
  limit?: number;
}): Promise<HistoryResponse> {
  const params = new URLSearchParams();

  if (options.project) params.set('project', options.project);
  if (options.status) params.set('status', options.status);
  if (options.startDate) params.set('startDate', options.startDate);
  if (options.endDate) params.set('endDate', options.endDate);
  params.set('page', String(options.page || 1));
  params.set('limit', String(options.limit || 20));

  const response = await apiFetch(`/api/history?${params}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch history' }));
    throw new Error(error.error || 'Failed to fetch history');
  }

  return response.json();
}

/**
 * Fetch a specific run with its events
 * @param runId The run ID
 * @returns Run details with events
 */
export async function fetchRunDetail(runId: number): Promise<RunDetailResponse> {
  const response = await apiFetch(`/api/history/${runId}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch run details' }));
    throw new Error(error.error || 'Failed to fetch run details');
  }

  return response.json();
}
