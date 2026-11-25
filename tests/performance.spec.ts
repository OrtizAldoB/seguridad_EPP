import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app';
import { bootstrap } from '../src/config/bootstrap';

interface CallOptions {
  method?: string;
  token?: string;
  body?: unknown;
}

interface CallResult {
  status: number;
  body: any;
  ms: number;
}

interface PerfStat {
  endpoint: string;
  role: string;
  samples: number;
  avg: number;
  min: number;
  max: number;
  p95: number;
  statuses: number[];
}

let server: Server;
let baseUrl: string;
const tokens: Record<string, string> = {};
const stats: PerfStat[] = [];

async function call(path: string, options: CallOptions = {}): Promise<CallResult> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const t0 = performance.now();
  const response = await fetch(`${baseUrl}/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const ms = performance.now() - t0;
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  return { status: response.status, body, ms };
}

async function login(email: string): Promise<string> {
  const res = await call('/auth/login', { method: 'POST', body: { email, password: 'Clave123!' } });
  expect(res.status).toBe(200);
  return res.body.data.accessToken as string;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function measure(role: string, endpoint: string, fn: () => Promise<CallResult>, samples = 12): Promise<PerfStat> {
  // warmup
  for (let i = 0; i < 2; i++) await fn();
  const times: number[] = [];
  const statuses: number[] = [];
  for (let i = 0; i < samples; i++) {
    const r = await fn();
    times.push(r.ms);
    statuses.push(r.status);
  }
  const stat: PerfStat = {
    endpoint,
    role,
    samples,
    avg: Number((times.reduce((a, b) => a + b, 0) / times.length).toFixed(2)),
    min: Number(Math.min(...times).toFixed(2)),
    max: Number(Math.max(...times).toFixed(2)),
    p95: Number(percentile(times, 95).toFixed(2)),
    statuses,
  };
  stats.push(stat);
  return stat;
}

function expectPerf(stat: PerfStat, maxP95Ms: number, allowedStatuses: number[] = [200, 201]) {
  expect(stat.statuses.every((s) => allowedStatuses.includes(s))).toBe(true);
  expect(stat.p95).toBeLessThan(maxP95Ms);
}

beforeAll(async () => {
  bootstrap();
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  tokens.admin = await login('admin@epp.com');
  tokens.vendedor = await login('vendedor@epp.com');
  tokens.almacen = await login('almacen@epp.com');
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  // Print summary for visibility
  console.log('\n=== RESUMEN RENDIMIENTO ===');
  console.table(stats.map((s) => ({ role: s.role, endpoint: s.endpoint, avg: s.avg, p95: s.p95, max: s.max, samples: s.samples })));
});

describe('rendimiento por rol - ADMINISTRADOR', () => {
  it('endpoints clave dentro de umbral', async () => {
    const t = tokens.admin;
    expectPerf(await measure('ADMIN', 'GET /auth/me', () => call('/auth/me', { token: t })), 300);
    expectPerf(await measure('ADMIN', 'GET /usuarios', () => call('/usuarios?limit=20', { token: t })), 400);
    expectPerf(await measure('ADMIN', 'GET /clientes', () => call('/clientes?limit=20', { token: t })), 400);
    expectPerf(await measure('ADMIN', 'GET /productos', () => call('/productos?limit=20', { token: t })), 400);
    expectPerf(await measure('ADMIN', 'GET /cotizaciones', () => call('/cotizaciones?limit=20', { token: t })), 500);
    expectPerf(await measure('ADMIN', 'GET /pedidos', () => call('/pedidos?limit=20', { token: t })), 500);
    expectPerf(await measure('ADMIN', 'GET /reportes/resumen', () => call('/reportes/resumen?periodo=mensual', { token: t })), 800);
    expectPerf(await measure('ADMIN', 'GET /aprobaciones/pendientes', () => call('/aprobaciones/pendientes', { token: t })), 500);
  }, 60000);
});

describe('rendimiento por rol - VENDEDOR', () => {
  it('endpoints clave dentro de umbral', async () => {
    const t = tokens.vendedor;
    expectPerf(await measure('VENDEDOR', 'GET /auth/me', () => call('/auth/me', { token: t })), 300);
    expectPerf(await measure('VENDEDOR', 'GET /clientes', () => call('/clientes?limit=20', { token: t })), 400);
    expectPerf(await measure('VENDEDOR', 'GET /productos', () => call('/productos?limit=20', { token: t })), 400);
    expectPerf(await measure('VENDEDOR', 'GET /cotizaciones', () => call('/cotizaciones?limit=20', { token: t })), 500);
    expectPerf(await measure('VENDEDOR', 'GET /pedidos', () => call('/pedidos?limit=20', { token: t })), 500);
    expectPerf(await measure('VENDEDOR', 'GET /reportes/resumen', () => call('/reportes/resumen?periodo=mensual', { token: t })), 800);
  }, 60000);
});

describe('rendimiento por rol - ALMACENERO', () => {
  it('endpoints clave dentro de umbral', async () => {
    const t = tokens.almacen;
    expectPerf(await measure('ALMACEN', 'GET /auth/me', () => call('/auth/me', { token: t })), 300);
    expectPerf(await measure('ALMACEN', 'GET /productos', () => call('/productos?limit=20', { token: t })), 400);
    expectPerf(await measure('ALMACEN', 'GET /inventario/disponibilidad', () => call('/inventario/disponibilidad', { token: t })), 500);
    expectPerf(await measure('ALMACEN', 'GET /inventario/kardex', () => call('/inventario/kardex?limit=20', { token: t })), 500);
    expectPerf(await measure('ALMACEN', 'GET /pedidos', () => call('/pedidos?limit=20', { token: t })), 500);
    expectPerf(await measure('ALMACEN', 'GET /notificaciones', () => call('/notificaciones?limit=20', { token: t })), 400);
    expectPerf(await measure('ALMACEN', 'GET /despacho/pendientes', () => call('/despacho/pendientes', { token: t })), 500);
  }, 60000);
});

describe('rendimiento de escrituras criticas', () => {
  it('login y operaciones de lectura/escritura bajo carga moderada', async () => {
    const loginStat = await measure('ALL', 'POST /auth/login', () => call('/auth/login', {
      method: 'POST',
      body: { email: 'admin@epp.com', password: 'Clave123!' },
    }), 8);
    expectPerf(loginStat, 1200, [200]);

    // Concurrent read burst - all users hitting their dashboard endpoints simultaneously
    const burst = await Promise.all(Array.from({ length: 15 }, (_, i) => {
      const role = ['admin', 'vendedor', 'almacen'][i % 3];
      const token = tokens[role];
      const paths = ['/auth/me', '/productos?limit=20', '/pedidos?limit=20'];
      return call(paths[i % 3], { token });
    }));
    const burstTimes = burst.map((r) => r.ms);
    const burstP95 = percentile(burstTimes, 95);
    expect(burst.every((r) => r.status === 200)).toBe(true);
    expect(burstP95).toBeLessThan(1500);
    stats.push({
      endpoint: 'BURST 15 req mixtas', role: 'MIXTO', samples: 15,
      avg: Number((burstTimes.reduce((a, b) => a + b, 0) / burstTimes.length).toFixed(2)),
      min: Number(Math.min(...burstTimes).toFixed(2)),
      max: Number(Math.max(...burstTimes).toFixed(2)),
      p95: Number(burstP95.toFixed(2)),
      statuses: burst.map((r) => r.status),
    });
  }, 60000);
});
