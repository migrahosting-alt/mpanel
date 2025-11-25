// src/lib/apiClient.ts
// Production deploys set VITE_MPANEL_API_BASE_URL to https://api.migrahosting.com/api/live.php
export const API_BASE =
  import.meta.env.VITE_MPANEL_API_BASE_URL?.replace(/\/$/, '') ||
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ||
  '/api';

type QueryValue = string | number | boolean | null | undefined;

type RequestOptions = {
  responseType?: 'json' | 'blob';
  headers?: Record<string, string>;
  params?: Record<string, QueryValue>;
  signal?: AbortSignal;
};

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  if (token) {
    return { 'Authorization': `Bearer ${token}` };
  }
  return {};
}

function buildUrl(path: string, params?: Record<string, QueryValue>) {
  if (!params) return `${API_BASE}${path}`;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    search.append(key, String(value));
  });

  const queryString = search.toString();
  if (!queryString) {
    return `${API_BASE}${path}`;
  }
  const separator = path.includes('?') ? '&' : '?';
  return `${API_BASE}${path}${separator}${queryString}`;
}

async function handle<T>(res: Response, options?: RequestOptions): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const errorData = await res.clone().json();
      if (errorData?.error) {
        message = errorData.error;
      }
    } catch {
      try {
        const fallbackText = await res.text();
        if (fallbackText) {
          message = fallbackText;
        }
      } catch {
        // ignore additional parsing errors
      }
    }
    throw new Error(message);
  }

  if (options?.responseType === 'blob') {
    return (await res.blob()) as T;
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    return (text ? (text as unknown as T) : (undefined as T));
  }

  return (await res.json()) as T;
}

const isRequestOptions = (value: any): value is RequestOptions => {
  if (!value || typeof value !== 'object') return false;
  const optionKeys: (keyof RequestOptions)[] = ['responseType', 'headers', 'params', 'signal'];
  return optionKeys.some((key) => key in value);
};

export const api = {
  async get<T>(path: string, options?: RequestOptions) {
    const res = await fetch(buildUrl(path, options?.params), { 
      credentials: 'include',
      headers: {
        ...getAuthHeaders(),
        ...options?.headers
      },
      signal: options?.signal
    });
    return handle<T>(res, options);
  },
  async post<T>(path: string, body?: any, options?: RequestOptions) {
    const res = await fetch(buildUrl(path, options?.params), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options?.headers
      },
      signal: options?.signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handle<T>(res, options);
  },
  async put<T>(path: string, body: any, options?: RequestOptions) {
    const res = await fetch(buildUrl(path, options?.params), {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options?.headers
      },
      signal: options?.signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handle<T>(res, options);
  },
  async delete<T>(path: string, bodyOrOptions?: any, maybeOptions?: RequestOptions) {
    let body = bodyOrOptions;
    let options = maybeOptions;

    if (isRequestOptions(bodyOrOptions)) {
      options = bodyOrOptions;
      body = undefined;
    }

    const headers = body !== undefined ? {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options?.headers
    } : {
      ...getAuthHeaders(),
      ...options?.headers
    };

    const res = await fetch(buildUrl(path, options?.params), {
      method: 'DELETE',
      credentials: 'include',
      headers,
      signal: options?.signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handle<T>(res, options);
  },
};

// Export as both 'api' and 'apiClient' for compatibility
export const apiClient = api;
export default api;
