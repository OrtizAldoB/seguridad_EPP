import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app';
import { bootstrap } from '../src/config/bootstrap';
import { listarMovimientosReserva } from '../src/modules/reservas/reservas.repository';

interface CallResult {
  status: number;
  body: any;
}

let server: Server;
let baseUrl: string;
const t: Record<string, string> = {};
let productoId: number;
let stockInicial: number;
let clienteId: number;
let pedidoId: number;
let cotizacionId: number;
let pedidoCreditoId: number;

async function call(path: string, opts: { method?: string; token?: string; body?: unknown } = {}): Promise<CallResult> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${baseUrl}/api${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const ct = res.headers.get('content-type') ?? '';
  return { status: res.status, body: ct.includes('application/json') ? await res.json() : null };
}

async function login(email: string): Promise<string> {
  const r = await call('/auth/login', { method: 'POST', body: { email, password: 'Clave123!' } });
  expect(r.status).toBe(200);
  return r.body.data.accessToken as string;
}

beforeAll(async () => {
  bootstrap();
  await new Promise<void>((r) => {
    server = app.listen(0, r);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.admin = await login('admin@epp.com');
  t.vendedor = await login('vendedor@epp.com');
  t.almacen = await login('almacen@epp.com');
});

afterAll(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
});

describe('Tienda EPP - comprador y regresiones P6-P17', () => {
  it('registro valida datos, crea rol COMPRADOR y permite login', async () => {
    const email = `comprador.${Date.now()}@test.com`;
    const nitCi = `NIT${Date.now()}`;
    const registro = await call('/auth/registro', {
      method: 'POST',
      body: {
        nombreCompleto: 'Comprador Web',
        email,
        password: 'Clave123!',
        tipoDocumento: 'CI',
        nitCi,
        telefono: '70000000',
        direccion: 'Av. Central',
      },
    });
    expect(registro.status).toBe(201);
    expect(registro.body.data.user.role).toBe('COMPRADOR');
    t.comprador = registro.body.data.accessToken as string;

    const reingreso = await call('/auth/login', { method: 'POST', body: { email, password: 'Clave123!' } });
    expect(reingreso.status).toBe(200);
    expect(reingreso.body.data.user.role).toBe('COMPRADOR');

    const debil = await call('/auth/registro', {
      method: 'POST',
      body: { nombreCompleto: 'Comprador Debil', email: `debil.${Date.now()}@test.com`, password: 'abc123', tipoDocumento: 'CI', nitCi: `DB${Date.now()}` },
    });
    expect(debil.status).toBe(422);

    const duplicado = await call('/auth/registro', {
      method: 'POST',
      body: { nombreCompleto: 'Comprador Duplicado', email, password: 'Clave123!', tipoDocumento: 'CI', nitCi: `OT${Date.now()}` },
    });
    expect(duplicado.status).toBe(409);
  });

  it('comprador ve catálogo y carrito, pero no módulos internos', async () => {
    const catalogo = await call('/tienda/catalogo', { token: t.comprador });
    expect(catalogo.status).toBe(200);
    expect(Array.isArray(catalogo.body.data.items)).toBe(true);
    const producto = catalogo.body.data.items.find((p: any) => Number(p.stockDisponible) > 10);
    expect(producto).toBeTruthy();
    productoId = producto.id;
    stockInicial = Number(producto.stockDisponible);

    expect((await call('/clientes', { token: t.comprador })).status).toBe(403);
    expect((await call('/usuarios', { token: t.comprador })).status).toBe(403);
    expect(
      (
        await call('/pedidos', {
          method: 'POST',
          token: t.comprador,
          body: { cliente_id: 1, items: [{ producto_id: 1, cantidad: 1 }], condicion_pago: 'CONTADO' },
        })
      ).status,
    ).toBe(403);
  });

  it('checkout valida carrito vacío y stock; reserva y vacía el carrito', async () => {
    const vacio = await call('/tienda/carrito', { token: t.comprador });
    expect(vacio.status).toBe(200);
    expect(vacio.body.data.items).toHaveLength(0);

    const checkoutVacio = await call('/tienda/checkout', {
      method: 'POST',
      token: t.comprador,
      body: { condicionPago: 'CONTADO', diasEntrega: 3 },
    });
    expect(checkoutVacio.status).toBe(400);

    const agregar = await call('/tienda/carrito/items', {
      method: 'POST',
      token: t.comprador,
      body: { productoId, cantidad: 2 },
    });
    expect(agregar.status).toBe(201);
    expect(agregar.body.data.items).toHaveLength(1);
    expect(agregar.body.data.items[0].cantidad).toBe(2);

    const excedido = await call('/tienda/carrito/items', {
      method: 'POST',
      token: t.comprador,
      body: { productoId, cantidad: stockInicial + 1 },
    });
    expect(excedido.status).toBe(409);

    const actualizar = await call(`/tienda/carrito/items/${productoId}`, {
      method: 'PATCH',
      token: t.comprador,
      body: { cantidad: 1 },
    });
    expect(actualizar.status).toBe(200);
    expect(actualizar.body.data.items[0].cantidad).toBe(1);

    const checkout = await call('/tienda/checkout', {
      method: 'POST',
      token: t.comprador,
      body: { condicionPago: 'CONTADO', diasEntrega: 3, observacion: 'Compra de prueba' },
    });
    expect(checkout.status).toBe(201);
    pedidoId = checkout.body.data.id;
    expect(checkout.body.data.estado).toBe('REGISTRADO');

    const despues = await call('/tienda/carrito', { token: t.comprador });
    expect(despues.body.data.items).toHaveLength(0);

    const mios = await call('/tienda/mis-pedidos', { token: t.comprador });
    expect(mios.status).toBe(200);
    expect(mios.body.data.some((p: any) => p.pedido.id === pedidoId)).toBe(true);

    const detalleMio = await call(`/tienda/mis-pedidos/${pedidoId}`, { token: t.comprador });
    expect(detalleMio.status).toBe(200);

    const productos = await call('/productos?limit=100', { token: t.admin });
    const productoActualizado = productos.body.data.items.find((p: any) => p.id === productoId);
    expect(Number(productoActualizado.stockDisponible)).toBe(stockInicial - 1);

    const movimientos = listarMovimientosReserva(pedidoId);
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0].tipo).toBe('RESERVA');
    expect(movimientos[0].cantidad).toBe(1);
  });

  it('invalida aprobación de cotización cuando se edita después de aprobar', async () => {
    const cliente = await call('/clientes', {
      method: 'POST',
      token: t.vendedor,
      body: { razonSocial: 'Cliente Aprobaciones', tipoDocumento: 'CI', nitCi: `APR${Date.now()}` },
    });
    expect(cliente.status).toBe(201);
    clienteId = cliente.body.data.id;

    const cotizacion = await call('/cotizaciones', {
      method: 'POST',
      token: t.vendedor,
      body: {
        cliente_id: clienteId,
        items: [{ producto_id: productoId, cantidad: 1 }],
        condicion_pago: 'CONTADO',
        descuento_porcentaje: 20,
      },
    });
    expect(cotizacion.status).toBe(201);
    cotizacionId = cotizacion.body.data.id;
    expect(cotizacion.body.data.requiere_aprobacion).toBe(1);

    const aprobar = await call(`/aprobaciones/cotizaciones/${cotizacionId}`, {
      method: 'POST',
      token: t.admin,
      body: { decision: 'APROBADO', observacion: 'Revisión financiera' },
    });
    expect(aprobar.status).toBe(200);

    const aprobada = await call(`/cotizaciones/${cotizacionId}`, { token: t.vendedor });
    expect(aprobada.body.data.aprobada_en).toBeTruthy();

    const pendientes = await call('/aprobaciones/pendientes', { token: t.admin });
    expect(pendientes.body.data.cotizaciones.some((c: any) => c.id === cotizacionId)).toBe(false);

    const reaprobar = await call(`/aprobaciones/cotizaciones/${cotizacionId}`, {
      method: 'POST',
      token: t.admin,
      body: { decision: 'APROBADO', observacion: 'Segunda aprobación' },
    });
    expect(reaprobar.status).toBe(409);

    const editar = await call(`/cotizaciones/${cotizacionId}`, {
      method: 'PATCH',
      token: t.vendedor,
      body: { observacion: 'Editada después de aprobar' },
    });
    expect(editar.status).toBe(200);
    expect(editar.body.data.aprobada_en).toBeNull();
    expect(editar.body.data.estado).toBe('ENVIADA');

    const pendientesTrasEdicion = await call('/aprobaciones/pendientes', { token: t.admin });
    expect(pendientesTrasEdicion.body.data.cotizaciones.some((c: any) => c.id === cotizacionId)).toBe(true);
  });

  it('obliga a aprobar pedidos por la bandeja, no por cambio de estado', async () => {
    const pedido = await call('/pedidos', {
      method: 'POST',
      token: t.vendedor,
      body: {
        cliente_id: clienteId,
        items: [{ producto_id: productoId, cantidad: 1 }],
        condicion_pago: 'CREDITO',
        dias_entrega: 3,
      },
    });
    expect(pedido.status).toBe(201);
    pedidoCreditoId = pedido.body.data.id;
    expect(pedido.body.data.estado).toBe('PENDIENTE_APROBACION');

    const patch = await call(`/pedidos/${pedidoCreditoId}/estado`, {
      method: 'PATCH',
      token: t.admin,
      body: { estado: 'REGISTRADO' },
    });
    expect([403, 409]).toContain(patch.status);

    const aprobar = await call(`/aprobaciones/pedidos/${pedidoCreditoId}`, {
      method: 'POST',
      token: t.admin,
      body: { decision: 'APROBADO', observacion: 'Crédito autorizado' },
    });
    expect(aprobar.status).toBe(200);

    const detalle = await call(`/pedidos/${pedidoCreditoId}`, { token: t.admin });
    expect(detalle.body.data.estado).toBe('REGISTRADO');
  });
});
