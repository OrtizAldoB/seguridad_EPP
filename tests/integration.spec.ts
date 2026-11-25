import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app';
import { bootstrap } from '../src/config/bootstrap';
import { fechaHoyIso } from '../src/shared/fechas';

interface CallOptions {
  method?: string;
  token?: string;
  body?: unknown;
}

interface CallResult {
  status: number;
  body: any;
  type?: string;
  bytes?: number;
}

let server: Server;
let baseUrl: string;
let admin: string;
let vendedor: string;
let almacen: string;
let clienteId: number;
let cascoId: number;
let cascoCodigo: string;
let stockInicialCasco: number;

async function call(path: string, options: CallOptions = {}): Promise<CallResult> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const response = await fetch(`${baseUrl}/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return { status: response.status, body: await response.json(), type: contentType };
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return { status: response.status, body: null, type: contentType, bytes: buffer.length };
}

async function login(email: string): Promise<string> {
  const response = await call('/auth/login', {
    method: 'POST',
    body: { email, password: 'Clave123!' },
  });
  expect(response.status).toBe(200);
  expect(response.body.data.accessToken).toBeTypeOf('string');
  return response.body.data.accessToken as string;
}

async function productoPorCodigo(token: string, codigo: string): Promise<any> {
  const response = await call(`/productos?q=${encodeURIComponent(codigo)}&limit=100`, { token });
  expect(response.status).toBe(200);
  const producto = response.body.data.items.find((item: any) => item.codigo === codigo);
  expect(producto).toBeDefined();
  return producto;
}

async function disponible(token: string, productoId: number): Promise<number> {
  const response = await call('/inventario/disponibilidad', { token });
  expect(response.status).toBe(200);
  const producto = response.body.data.find((item: any) => item.id === productoId);
  expect(producto).toBeDefined();
  return Number(producto.stockComprometido);
}

beforeAll(async () => {
  bootstrap();
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  admin = await login('admin@epp.com');
  vendedor = await login('vendedor@epp.com');
  almacen = await login('almacen@epp.com');

  const cliente = await call('/clientes', {
    method: 'POST',
    token: vendedor,
    body: {
      razonSocial: 'Cliente de pruebas automatizadas',
      tipoDocumento: 'CI',
      nitCi: `TEST${Date.now()}`,
      telefono: '70000000',
      email: 'pruebas@epp.com',
    },
  });
  expect(cliente.status).toBe(201);
  clienteId = cliente.body.data.id;

  const casco = await productoPorCodigo(vendedor, 'CASCO-001');
  cascoId = casco.id;
  cascoCodigo = casco.codigo;
  stockInicialCasco = casco.stockReal;
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('autenticación y RBAC', () => {
  it('responde health y rechaza credenciales inválidas', async () => {
    const health = await call('/health');
    expect(health.status).toBe(200);
    expect(health.body.data.status).toBe('ok');

    const invalido = await call('/auth/login', {
      method: 'POST',
      body: { email: 'admin@epp.com', password: 'incorrecta' },
    });
    expect(invalido.status).toBe(401);
  });

  it('bloquea rutas sin token y acciones fuera de rol', async () => {
    expect((await call('/clientes')).status).toBe(401);

    const vendedorCreaUsuario = await call('/usuarios', {
      method: 'POST',
      token: vendedor,
      body: { nombreCompleto: 'Sin permiso', email: 'sin@permiso.com', password: 'Clave123!', rolId: 1 },
    });
    expect(vendedorCreaUsuario.status).toBe(403);

    const almacenCotiza = await call('/cotizaciones', {
      method: 'POST',
      token: almacen,
      body: { cliente_id: clienteId, items: [{ producto_id: cascoId, cantidad: 1 }], condicion_pago: 'CONTADO' },
    });
    expect(almacenCotiza.status).toBe(403);
    expect((await call('/cotizaciones', { token: almacen })).status).toBe(403);
    expect((await call('/clientes', { token: almacen })).status).toBe(200);
    expect((await call('/productos', { token: almacen })).status).toBe(200);
    expect((await call('/pedidos', { token: almacen })).status).toBe(200);

    const vendedorAprueba = await call('/aprobaciones/pedidos/1', {
      method: 'POST',
      token: vendedor,
      body: { decision: 'APROBADO' },
    });
    expect(vendedorAprueba.status).toBe(403);

    expect((await call('/usuarios', { token: admin })).status).toBe(200);
  });
});

describe('reglas de negocio', () => {
  it('calcula semáforo y valida NIT duplicado', async () => {
    const gafas = await productoPorCodigo(vendedor, 'GAFAS-001');
    expect(gafas.semaforo).toBe('ROJO');

    const casco = await productoPorCodigo(vendedor, cascoCodigo);
    expect(casco.semaforo).toBe('VERDE');
    expect(Number(casco.stockDisponible)).toBe(Number(casco.stockReal) - Number(casco.stockComprometido));

    const duplicado = await call('/clientes', {
      method: 'POST',
      token: vendedor,
      body: { razonSocial: 'Duplicado', nitCi: '123456789001' },
    });
    expect(duplicado.status).toBe(409);
  });

  it('crea cliente al crear usuario y valida nombres sin números', async () => {
    const sufijo = Date.now();
    const nombre = 'Usuario Nuevo Prueba';
    const usuario = await call('/usuarios', {
      method: 'POST',
      token: admin,
      body: {
        nombreCompleto: nombre,
        email: `usuariocliente${sufijo}@test.com`,
        password: 'Clave123!',
        rolId: 3,
        tipoDocumento: 'CI',
        nitCi: `USRCLI${sufijo}`,
        telefono: '70001234',
        direccion: 'Av. Central',
      },
    });
    expect(usuario.status).toBe(201);
    expect(usuario.body.data.clienteId).toBeGreaterThan(0);

    const clientes = await call(`/clientes?q=${encodeURIComponent(nombre)}&limit=10`, { token: admin });
    expect(clientes.status).toBe(200);
    expect(clientes.body.data.items.some((cliente: any) => cliente.razonSocial === nombre)).toBe(true);

    const invalido = await call('/usuarios', {
      method: 'POST',
      token: admin,
      body: {
        nombreCompleto: 'Usuario 123',
        email: `invalido${sufijo}@test.com`,
        password: 'Clave123!',
        rolId: 3,
      },
    });
    expect(invalido.status).toBe(422);
  });

  it('acepta cliente con telefono, correo y direccion vacios', async () => {
    const respuesta = await call('/clientes', {
      method: 'POST',
      token: vendedor,
      body: {
        razonSocial: 'Cliente Campos Opcionales',
        tipoDocumento: 'NIT',
        nitCi: `${Date.now()}`,
        telefono: '',
        email: '',
        direccion: '',
        estado: 'ACTIVO',
      },
    });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.telefono).toBeNull();
    expect(respuesta.body.data.email).toBeNull();
    expect(respuesta.body.data.direccion).toBeNull();
  });

  it('registra movimientos de kardex actualizando stock', async () => {
    const movimiento = await call('/inventario/movimientos', {
      method: 'POST',
      token: almacen,
      body: {
        producto_id: cascoId,
        tipo_movimiento: 'ENTRADA_COMPRA',
        cantidad: 10,
        referencia: 'TEST-entrada',
        observacion: 'Prueba automatizada',
      },
    });
    expect(movimiento.status).toBe(201);
    expect(Number(movimiento.body.data.stockNuevo)).toBe(stockInicialCasco + 10);

    const kardex = await call(`/inventario/kardex?producto_id=${cascoId}&limit=5`, { token: almacen });
    expect(kardex.status).toBe(200);
    expect(kardex.body.data.length).toBeGreaterThan(0);
  });
});

describe('ciclo comercial completo', () => {
  let cotizacionId: number;
  let pedidoId: number;

  it('crea cotización, la acepta, la convierte y despacha generando notificación', async () => {
    const cotizacion = await call('/cotizaciones', {
      method: 'POST',
      token: vendedor,
      body: {
        cliente_id: clienteId,
        items: [{ producto_id: cascoId, cantidad: 5 }],
        condicion_pago: 'CONTADO',
        descuento_porcentaje: 0,
      },
    });
    expect(cotizacion.status).toBe(201);
    cotizacionId = cotizacion.body.data.id;
    expect(Number(cotizacion.body.data.total)).toBeCloseTo(5 * 45.5 * 1.16, 2);
    expect(cotizacion.body.data.vigente).toBe(true);
    expect(cotizacion.body.data.diasRestantes).toBeGreaterThan(0);

    expect((await call(`/cotizaciones/${cotizacionId}/aceptar`, { method: 'POST', token: vendedor })).status).toBe(200);

    const conversion = await call(`/cotizaciones/${cotizacionId}/convertir`, { method: 'POST', token: vendedor });
    expect(conversion.status).toBe(201);
    pedidoId = conversion.body.data.id;
    expect(conversion.body.data.estado).toBe('REGISTRADO');

    const notificaciones = await call('/notificaciones?leida=false', { token: almacen });
    expect(notificaciones.status).toBe(200);
    expect(notificaciones.body.data.length).toBeGreaterThan(0);

    const pickList = await call(`/despacho/pick-list/${pedidoId}`, { token: almacen });
    expect(pickList.status).toBe(200);
    expect(pickList.body.data.items.length).toBe(1);

    const despacho = await call(`/despacho/confirmar/${pedidoId}`, { method: 'POST', token: almacen });
    expect(despacho.status).toBe(200);
    expect(despacho.body.data.pedido.estado).toBe('ENTREGADO');

    const casco = await productoPorCodigo(vendedor, cascoCodigo);
    expect(Number(casco.stockReal)).toBe(stockInicialCasco + 10 - 5);
    expect(Number(casco.stockComprometido)).toBe(0);
  });

  it('exige aprobación para crédito y rechaza descuentos al crédito', async () => {
    const conDescuento = await call('/cotizaciones', {
      method: 'POST',
      token: vendedor,
      body: {
        cliente_id: clienteId,
        items: [{ producto_id: cascoId, cantidad: 2 }],
        condicion_pago: 'CREDITO',
        descuento_porcentaje: 15,
      },
    });
    expect(conDescuento.status).toBe(400);

    const cotizacion = await call('/cotizaciones', {
      method: 'POST',
      token: vendedor,
      body: {
        cliente_id: clienteId,
        items: [{ producto_id: cascoId, cantidad: 2 }],
        condicion_pago: 'CREDITO',
        descuento_porcentaje: 0,
        plazo_meses: 3,
      },
    });
    expect(cotizacion.status).toBe(201);
    const id = cotizacion.body.data.id;
    expect(Number(cotizacion.body.data.requiere_aprobacion)).toBe(1);
    expect(Number(cotizacion.body.data.plazo_meses)).toBe(3);
    expect(Number(cotizacion.body.data.interes_monto)).toBeGreaterThan(0);

    expect((await call(`/cotizaciones/${id}/aceptar`, { method: 'POST', token: vendedor })).status).toBe(200);

    const sinAprobar = await call(`/cotizaciones/${id}/convertir`, { method: 'POST', token: vendedor });
    expect(sinAprobar.status).toBe(409);

    const aprobar = await call(`/aprobaciones/cotizaciones/${id}`, {
      method: 'POST',
      token: admin,
      body: { decision: 'APROBADO', observacion: 'Aprobado en pruebas automatizadas' },
    });
    expect(aprobar.status).toBe(200);

    const convertir = await call(`/cotizaciones/${id}/convertir`, { method: 'POST', token: vendedor });
    expect(convertir.status).toBe(201);
  });

  it('aprueba pedido directo a crédito y registra auditoría financiera', async () => {
    const pedido = await call('/pedidos', {
      method: 'POST',
      token: vendedor,
      body: {
        cliente_id: clienteId,
        items: [{ producto_id: cascoId, cantidad: 3 }],
        condicion_pago: 'CREDITO',
        descuento_porcentaje: 0,
        dias_entrega: 3,
      },
    });
    expect(pedido.status).toBe(201);
    expect(pedido.body.data.estado).toBe('PENDIENTE_APROBACION');

    const aprobacion = await call(`/aprobaciones/pedidos/${pedido.body.data.id}`, {
      method: 'POST',
      token: admin,
      body: { decision: 'APROBADO', observacion: 'Crédito autorizado' },
    });
    expect(aprobacion.status).toBe(200);

    const historial = await call('/aprobaciones/historial', { token: admin });
    expect(historial.status).toBe(200);
    expect(historial.body.data.length).toBeGreaterThanOrEqual(2);
    expect(historial.body.data.some((item: any) => item.decision === 'APROBADO')).toBe(true);
  });
});

describe('reportes y exportación', () => {
  it('devuelve indicadores, rankings y archivos reales XLSX y PDF', async () => {
    const resumen = await call('/reportes/resumen?periodo=mensual', { token: admin });
    expect(resumen.status).toBe(200);
    expect(resumen.body.data).toHaveProperty('totalVendido');
    expect(resumen.body.data).toHaveProperty('serie');

    for (const ruta of ['top-productos', 'top-clientes']) {
      const response = await call(`/reportes/${ruta}?periodo=mensual&limit=5`, { token: admin });
      expect(response.status).toBe(200);
    }
    for (const ruta of ['ventas', 'cotizaciones', 'kardex']) {
      const response = await call(`/reportes/${ruta}?periodo=mensual`, { token: admin });
      expect(response.status).toBe(200);
    }

    const xlsx = await call('/reportes/exportar.xlsx?tipo=ventas&periodo=mensual', { token: admin });
    expect(xlsx.status).toBe(200);
    expect(xlsx.type).toContain('spreadsheetml');
    expect(xlsx.bytes).toBeGreaterThan(1000);

    const pdf = await call('/reportes/exportar.pdf?tipo=kardex&periodo=mensual', { token: admin });
    expect(pdf.status).toBe(200);
    expect(pdf.type).toContain('application/pdf');
    expect(pdf.bytes).toBeGreaterThan(500);
  });
});

describe('ciclo de vida y fecha de entrega de pedidos', () => {
  it('genera fecha de entrega futura y bloquea transiciones inválidas', async () => {
    const body = {
      cliente_id: clienteId,
      items: [{ producto_id: cascoId, cantidad: 1 }],
      condicion_pago: 'CONTADO',
      descuento_porcentaje: 0,
      dias_entrega: 2,
    };
    const pedido = await call('/pedidos', { method: 'POST', token: vendedor, body });
    expect(pedido.status).toBe(201);
    expect(pedido.body.data.fecha_estimada_entrega >= fechaHoyIso()).toBe(true);

    const pedidoIdCiclo = pedido.body.data.id;
    const salto = await call(`/pedidos/${pedidoIdCiclo}/estado`, {
      method: 'PATCH',
      token: almacen,
      body: { estado: 'ENTREGADO' },
    });
    expect(salto.status).toBe(409);

    const fechaInvalida = await call('/pedidos', {
      method: 'POST',
      token: vendedor,
      body: { ...body, dias_entrega: 0 },
    });
    expect(fechaInvalida.status).toBe(422);

    const cancelar = await call(`/pedidos/${pedidoIdCiclo}/estado`, {
      method: 'PATCH',
      token: almacen,
      body: { estado: 'CANCELADO' },
    });
    expect(cancelar.status).toBe(200);

    const reabrir = await call(`/pedidos/${pedidoIdCiclo}/estado`, {
      method: 'PATCH',
      token: almacen,
      body: { estado: 'REGISTRADO' },
    });
    expect(reabrir.status).toBe(409);
  });
});

describe('concurrencia sobre stock comprometido', () => {
  it('reserva una sola vez cuando dos pedidos simultáneos compiten por el mismo producto', async () => {
    const tapon = await productoPorCodigo(vendedor, 'TAPON-001');
    const ajuste = await call('/inventario/movimientos', {
      method: 'POST',
      token: almacen,
      body: {
        producto_id: tapon.id,
        tipo_movimiento: 'AJUSTE_MANUAL',
        cantidad: 10 - Number(tapon.stockReal),
        referencia: 'TEST-concurrencia',
        observacion: 'Dejar exactamente 10 unidades disponibles',
      },
    });
    expect(ajuste.status).toBe(201);
    const antes = await disponible(almacen, tapon.id);
    expect(antes).toBe(0);

    const body = {
      cliente_id: clienteId,
      items: [{ producto_id: tapon.id, cantidad: 10 }],
      condicion_pago: 'CONTADO',
      descuento_porcentaje: 0,
      dias_entrega: 2,
    };
    const resultados = await Promise.all([
      call('/pedidos', { method: 'POST', token: vendedor, body }),
      call('/pedidos', { method: 'POST', token: vendedor, body }),
    ]);
    const statuses = resultados.map((resultado) => resultado.status).sort();

    expect(statuses).toContain(201);
    expect(statuses).toContain(409);

    const despues = await disponible(almacen, tapon.id);
    expect(despues).toBe(antes + 10);
  });
});
