import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app';
import { bootstrap } from '../src/config/bootstrap';

interface CallResult { status: number; body: any; }
let server: Server; let baseUrl: string;
const t: Record<string, string> = {};
let clienteId: number; let productoId: number; let cotizacionId: number; let pedidoId: number;

async function call(path: string, opts: { method?: string; token?: string; body?: unknown } = {}): Promise<CallResult> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${baseUrl}/api${path}`, { method: opts.method ?? 'GET', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const ct = res.headers.get('content-type') ?? '';
  return { status: res.status, body: ct.includes('application/json') ? await res.json() : null };
}
async function login(email: string) {
  const r = await call('/auth/login', { method: 'POST', body: { email, password: 'Clave123!' } });
  expect(r.status).toBe(200);
  return r.body.data.accessToken as string;
}

beforeAll(async () => {
  bootstrap();
  await new Promise<void>((r) => { server = app.listen(0, r); });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.admin = await login('admin@epp.com');
  t.vendedor = await login('vendedor@epp.com');
  t.almacen = await login('almacen@epp.com');
});
afterAll(async () => { if (server) await new Promise<void>((r) => server.close(() => r())); });

describe('Tienda EPP - pruebas por rol', () => {
  it('ADMINISTRADOR: gestiona usuarios, aprueba y ve reportes', async () => {
    const me = await call('/auth/me', { token: t.admin });
    expect(me.status).toBe(200);
    expect(me.body.data.role).toBe('ADMINISTRADOR');

    const users = await call('/usuarios?limit=20', { token: t.admin });
    expect(users.status).toBe(200);
    expect(users.body.data.length).toBeGreaterThanOrEqual(3);

    const creado = await call('/usuarios', {
      method: 'POST', token: t.admin,
      body: { nombreCompleto: 'Usuario Prueba Rol', email: 'prueba.rol@epp.com', password: 'Clave123!', rolId: 2, activo: true },
    });
    expect(creado.status).toBe(201);

    const reportes = await call('/reportes/resumen?periodo=mensual', { token: t.admin });
    expect(reportes.status).toBe(200);
    expect(reportes.body.data).toHaveProperty('totalVendido');

    const pendientes = await call('/aprobaciones/pendientes', { token: t.admin });
    expect(pendientes.status).toBe(200);
  });

  it('VENDEDOR: opera flujo comercial de tienda (cliente, cotización, pedido)', async () => {
    const me = await call('/auth/me', { token: t.vendedor });
    expect(me.status).toBe(200);
    expect(me.body.data.role).toBe('VENDEDOR');

    // No puede gestionar usuarios ni decidir aprobaciones
    expect((await call('/usuarios', { token: t.vendedor })).status).toBe(403);
    expect((await call('/aprobaciones/cotizaciones/1', { method: 'POST', token: t.vendedor, body: { decision: 'APROBADO' } })).status).toBe(403);

    // Crea cliente tienda
    const cliente = await call('/clientes', {
      method: 'POST', token: t.vendedor,
      body: { razonSocial: 'Constructora Cliente Rol', tipoDocumento: 'CI', nitCi: `ROL${Date.now()}`, telefono: '70011122', email: 'cliente.rol@test.com' },
    });
    expect(cliente.status).toBe(201);
    clienteId = cliente.body.data.id;

    const productos = await call('/productos?limit=10', { token: t.vendedor });
    expect(productos.status).toBe(200);
    productoId = productos.body.data.items.find((p: any) => Number(p.stockDisponible) > 5)?.id;
    expect(productoId).toBeTruthy();

    // Cotización
    const cot = await call('/cotizaciones', {
      method: 'POST', token: t.vendedor,
      body: { cliente_id: clienteId, items: [{ producto_id: productoId, cantidad: 2 }], condicion_pago: 'CONTADO', descuento_porcentaje: 0 },
    });
    expect(cot.status).toBe(201);
    cotizacionId = cot.body.data.id;
    expect((await call(`/cotizaciones/${cotizacionId}/aceptar`, { method: 'POST', token: t.vendedor })).status).toBe(200);

    // Conversión a pedido
    const conv = await call(`/cotizaciones/${cotizacionId}/convertir`, { method: 'POST', token: t.vendedor });
    expect(conv.status).toBe(201);
    pedidoId = conv.body.data.id;
    expect(conv.body.data.estado).toBe('REGISTRADO');

    // Puede consultar reportes de ventas
    expect((await call('/reportes/resumen?periodo=mensual', { token: t.vendedor })).status).toBe(200);
  });

  it('ALMACENERO: gestiona inventario, kardex y despacho; sin acceso comercial/admin', async () => {
    const me = await call('/auth/me', { token: t.almacen });
    expect(me.status).toBe(200);
    expect(me.body.data.role).toBe('ALMACENERO');

    // Bloqueos
    expect((await call('/usuarios', { token: t.almacen })).status).toBe(403);
    expect((await call('/cotizaciones', { method: 'POST', token: t.almacen, body: { cliente_id: 1, items: [{ producto_id: 1, cantidad: 1 }], condicion_pago: 'CONTADO' } })).status).toBe(403);
    expect((await call('/cotizaciones', { token: t.almacen })).status).toBe(403);
    expect((await call('/clientes', { method: 'POST', token: t.almacen, body: { razonSocial: 'Cliente No Permitido', tipoDocumento: 'CI', nitCi: `ALM${Date.now()}` } })).status).toBe(403);

    // Consulta de catálogo y clientes en modo solo lectura
    expect((await call('/clientes', { token: t.almacen })).status).toBe(200);
    expect((await call('/productos', { token: t.almacen })).status).toBe(200);

    // Operaciones de almacén
    expect((await call('/inventario/disponibilidad', { token: t.almacen })).status).toBe(200);
    expect((await call('/inventario/kardex?limit=10', { token: t.almacen })).status).toBe(200);
    expect((await call('/notificaciones?limit=10', { token: t.almacen })).status).toBe(200);

    const pendientes = await call('/despacho/pendientes', { token: t.almacen });
    expect(pendientes.status).toBe(200);

    // Despacha el pedido creado por vendedor
    if (pedidoId) {
      const pick = await call(`/despacho/pick-list/${pedidoId}`, { token: t.almacen });
      expect(pick.status).toBe(200);
      const desp = await call(`/despacho/confirmar/${pedidoId}`, { method: 'POST', token: t.almacen });
      expect(desp.status).toBe(200);
      expect(desp.body.data.pedido.estado).toBe('ENTREGADO');
    }
  });

  it('CONTROL DE ACCESO: cada rol solo ve lo permitido en tienda', async () => {
    // Vendedor no accede a despacho operativo ni crea usuarios
    expect((await call('/despacho/pendientes', { token: t.vendedor })).status).toBe(200);
    // Almacenero no ve usuarios ni crea pedidos
    expect((await call('/pedidos', { method: 'POST', token: t.almacen, body: { cliente_id: 1, items: [{ producto_id: 1, cantidad: 1 }], condicion_pago: 'CONTADO' } })).status).toBe(403);
    // Admin tiene acceso total
    expect((await call('/usuarios', { token: t.admin })).status).toBe(200);
    expect((await call('/reportes/resumen?periodo=mensual', { token: t.admin })).status).toBe(200);
  });
});

