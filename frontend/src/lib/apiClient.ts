// src/lib/apiClient.ts
const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:3000/api';

type RequestOptions = {
  responseType?: 'json' | 'blob';
  headers?: Record<string, string>;
};

async function handle<T>(res: Response, options?: RequestOptions): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  
  if (options?.responseType === 'blob') {
    return (await res.blob()) as T;
  }
  
  return (await res.json()) as T;
}

export const api = {
  async get<T>(path: string, options?: RequestOptions) {
    const res = await fetch(`${API_BASE}${path}`, { 
      credentials: 'include',
      headers: options?.headers
    });
    return handle<T>(res, options);
  },
  async post<T>(path: string, body?: any, options?: RequestOptions) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      body: JSON.stringify(body ?? {}),
    });
    return handle<T>(res, options);
  },
  async put<T>(path: string, body: any, options?: RequestOptions) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      body: JSON.stringify(body ?? {}),
    });
    return handle<T>(res, options);
  },
  async delete<T>(path: string, body?: any, options?: RequestOptions) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: body ? {
        'Content-Type': 'application/json',
        ...options?.headers
      } : options?.headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return handle<T>(res, options);
  },
};

// Export as both 'api' and 'apiClient' for compatibility
export const apiClient = api;
