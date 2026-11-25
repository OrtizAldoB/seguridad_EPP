const BASE = '/api';
const ACCESS_KEY = 'epp.accessToken';
const REFRESH_KEY = 'epp.refreshToken';

export interface AuthUser {
  id: number;
  nombreCompleto: string;
  email: string;
  role: 'ADMINISTRADOR' | 'VENDEDOR' | 'ALMACENERO' | 'COMPRADOR';
  roleNombre: string;
  permisos: string[];
  activo: boolean;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const tokens = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

interface ApiPayload<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
  error?: { code: string; message: string; details?: unknown };
}

async function readBody(response: Response): Promise<ApiPayload<unknown> | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as ApiPayload<unknown>;
  } catch {
    return null;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

function refreshAccess(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refresh = tokens.refresh;
  if (!refresh) return Promise.resolve(false);

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      const payload = await readBody(response);
      const data = payload?.data as { accessToken?: string; refreshToken?: string } | undefined;
      if (!response.ok || !data?.accessToken || !data.refreshToken) {
        tokens.clear();
        return false;
      }
      tokens.set(data.accessToken, data.refreshToken);
      return true;
    } catch {
      tokens.clear();
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiPayload<T>> {
  const { body, auth = true, headers: headerInit, ...rest } = options;
  const headers = new Headers(headerInit);

  if (body !== undefined && !(body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const access = tokens.access;
  if (auth && access) headers.set('Authorization', `Bearer ${access}`);

  const send = () => fetch(`${BASE}${path}`, {
    ...rest,
    headers,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });

  let response = await send();
  if (response.status === 401 && auth && (await refreshAccess())) {
    headers.set('Authorization', `Bearer ${tokens.access}`);
    response = await send();
  }

  const payload = await readBody(response);
  if (!response.ok || payload?.success === false) {
    if (response.status === 401) tokens.clear();
    throw new ApiError(
      response.status,
      payload?.error?.code ?? 'ERROR',
      payload?.error?.message ?? `Error ${response.status}`,
      payload?.error?.details,
    );
  }

  return (payload ?? { success: true, data: null as T }) as ApiPayload<T>;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const payload = await request<T>(path, options);
  return payload.data;
}

export async function apiWithMeta<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta: Record<string, unknown> }> {
  const payload = await request<T>(path, options);
  return { data: payload.data, meta: payload.meta ?? {} };
}

export async function downloadFile(path: string, filename: string): Promise<void> {
  const access = tokens.access;
  const headers = new Headers();
  if (access) headers.set('Authorization', `Bearer ${access}`);

  let response = await fetch(`${BASE}${path}`, { headers });
  if (response.status === 401 && (await refreshAccess())) {
    headers.set('Authorization', `Bearer ${tokens.access}`);
    response = await fetch(`${BASE}${path}`, { headers });
  }
  if (!response.ok) {
    const payload = await readBody(response);
    throw new ApiError(response.status, payload?.error?.code ?? 'ERROR', payload?.error?.message ?? 'No se pudo descargar');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const details = error.details;
    if (Array.isArray(details) && details.length > 0) {
      const first = details[0] as { message?: string; path?: (string | number)[] };
      return `${error.message}: ${first.path?.join('.') ?? 'dato'} ${first.message ?? ''}`.trim();
    }
    if (details && typeof details === 'object') {
      const flatten = details as { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
      const campo = Object.entries(flatten.fieldErrors ?? {}).find(([, mensajes]) => mensajes.length > 0);
      if (campo) return `${error.message}: ${campo[0]} ${campo[1][0]}`.trim();
      if (flatten.formErrors?.length) return `${error.message}: ${flatten.formErrors[0]}`.trim();
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}

export interface LoginResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface RegistroPayload {
  nombreCompleto: string;
  email: string;
  password: string;
  tipoDocumento: 'NIT' | 'CI';
  nitCi: string;
  telefono?: string;
  direccion?: string;
}

export const authApi = {
  registrar: (payload: RegistroPayload) =>
    api<LoginResult>('/auth/registro', { method: 'POST', auth: false, body: payload }),
  login: (email: string, password: string) =>
    api<LoginResult>('/auth/login', { method: 'POST', auth: false, body: { email, password } }),
  me: () => api<AuthUser>('/auth/me'),
  logout: (refreshToken: string) =>
    api<{ closed: boolean }>('/auth/logout', { method: 'POST', body: { refreshToken } }),
};
