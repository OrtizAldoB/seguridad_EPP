import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app';
import { bootstrap } from '../src/config/bootstrap';

let server: Server; let baseUrl: string;
const t: Record<string, string> = {};
async function call(path: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${baseUrl}/api${path}`, { method: opts.method ?? 'GET', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const ct = res.headers.get('content-type') ?? '';
  return { status: res.status, body: ct.includes('application/json') ? await res.json() : null };
}
async function login(email: string) { const r = await call('/auth/login', { method: 'POST', body: { email, password: 'Clave123!' } }); expect(r.status).toBe(200); return r.body.data.accessToken as string; }

beforeAll(async () => { bootstrap(); await new Promise<void>(r => { server = app.listen(0, r); }); baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; t.admin = await login('admin@epp.com'); t.almacen = await login('almacen@epp.com'); t.vendedor = await login('vendedor@epp.com'); });
afterAll(async () => { if (server) await new Promise<void>(r => server.close(() => r())); });

describe('Proveedores y compras por mayoreo (tienda EPP)', () => {
  it('admin crea proveedor, registra compra y al recibir ingresa stock al kardex', async () => {
    const prov = await call('/proveedores', { method: 'POST', token: t.admin, body: { razonSocial: 'Seguridad Industrial SA', nitCi: `PROV-${Date.now()}`, contacto: '70000002', telefono: '70000001', email: 'prov@test.com' } });
    expect(prov.status).toBe(201);
    const proveedorId = prov.body.data.id;

    const prodRes = await call('/productos?q=CASCO-001&limit=10', { token: t.admin });
    const prod = prodRes.body.data.items.find((p: any) => p.codigo === 'CASCO-001');
    const stockAntes = Number(prod.stockReal);

    const compra = await call('/compras', { method: 'POST', token: t.admin, body: { proveedor_id: proveedorId, observacion: 'Compra mayoreo prueba', items: [{ producto_id: prod.id, cantidad: 20, costo_unitario: 30 }] } });
    expect(compra.status).toBe(201);
    expect(compra.body.data.estado).toBe('REGISTRADA');
    expect(Number(compra.body.data.total)).toBe(600);

    const recibir = await call(`/compras/${compra.body.data.id}/recibir`, { method: 'POST', token: t.admin });
    expect(recibir.status).toBe(200);
    expect(recibir.body.data.estado).toBe('RECIBIDA');

    const prodDesp = await call('/productos?q=CASCO-001&limit=10', { token: t.admin });
    const prod2 = prodDesp.body.data.items.find((p: any) => p.codigo === 'CASCO-001');
    expect(Number(prod2.stockReal)).toBe(stockAntes + 20);

    const kardex = await call(`/inventario/kardex?producto_id=${prod.id}&limit=5`, { token: t.admin });
    expect(kardex.status).toBe(200);
    expect(kardex.body.data.some((k: any) => k.tipoMovimiento === 'ENTRADA_COMPRA' && k.referencia === compra.body.data.codigo)).toBe(true);
  });

  it('seed incluye cinco proveedores mayoristas con ofertas y mínimos', async () => {
    const respuesta = await call('/proveedores?estado=ACTIVO&limit=100', { token: t.admin });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.items.length).toBeGreaterThanOrEqual(5);
    const nits = respuesta.body.data.items.map((p: any) => p.nitCi);
    expect(nits).toEqual(expect.arrayContaining(['PROV-001', 'PROV-002', 'PROV-003', 'PROV-004', 'PROV-005']));

    const ofertas = await call('/proveedores/1/productos', { token: t.admin });
    expect(ofertas.status).toBe(200);
    expect(ofertas.body.data[0].minimoCompra).toBe(50);
  });

  it('respeta mínimos y catálogo de productos ofrecidos por proveedor', async () => {
    const prodRes = await call('/productos?q=CASCO-001&limit=10', { token: t.admin });
    const casco = prodRes.body.data.items.find((p: any) => p.codigo === 'CASCO-001');
    const guanteRes = await call('/productos?q=GUANTE-001&limit=10', { token: t.admin });
    const guante = guanteRes.body.data.items.find((p: any) => p.codigo === 'GUANTE-001');

    const prov = await call('/proveedores', {
      method: 'POST',
      token: t.admin,
      body: {
        razonSocial: 'Proveedor Mayorista SA',
        nitCi: `MAY-${Date.now()}`,
        telefono: '70003333',
        productos: [{ productoId: casco.id, precioUnitario: 28, minimoCompra: 12 }],
      },
    });
    expect(prov.status).toBe(201);
    const proveedorId = prov.body.data.id;

    const ofertas = await call(`/proveedores/${proveedorId}/productos`, { token: t.admin });
    expect(ofertas.body.data).toHaveLength(1);
    expect(ofertas.body.data[0].productoId).toBe(casco.id);

    const insuficiente = await call('/compras', {
      method: 'POST',
      token: t.admin,
      body: { proveedor_id: proveedorId, items: [{ producto_id: casco.id, cantidad: 5, costo_unitario: 28 }] },
    });
    expect(insuficiente.status).toBe(400);

    const noOfrecido = await call('/compras', {
      method: 'POST',
      token: t.admin,
      body: { proveedor_id: proveedorId, items: [{ producto_id: guante.id, cantidad: 100, costo_unitario: 8 }] },
    });
    expect(noOfrecido.status).toBe(400);

    const valido = await call('/compras', {
      method: 'POST',
      token: t.admin,
      body: { proveedor_id: proveedorId, items: [{ producto_id: casco.id, cantidad: 12, costo_unitario: 28 }] },
    });
    expect(valido.status).toBe(201);
  });

  it('rechaza teléfonos con letras en clientes, proveedores y registro', async () => {
    const contacto = await call('/proveedores', {
      method: 'POST',
      token: t.admin,
      body: { razonSocial: 'Proveedor Contacto Letras', nitCi: `PCL-${Date.now()}`, contacto: '7000abc12' },
    });
    expect(contacto.status).toBe(422);

    const cliente = await call('/clientes', {
      method: 'POST',
      token: t.admin,
      body: { razonSocial: 'Cliente Telefono', tipoDocumento: 'CI', nitCi: `CLI${Date.now()}`, telefono: '7000abc12' },
    });
    expect(cliente.status).toBe(422);

    const proveedor = await call('/proveedores', {
      method: 'POST',
      token: t.admin,
      body: { razonSocial: 'Proveedor Telefono', nitCi: `PTEL-${Date.now()}`, telefono: '7000abc12' },
    });
    expect(proveedor.status).toBe(422);

    const registro = await call('/auth/registro', {
      method: 'POST',
      body: {
        nombreCompleto: 'Usuario Telefono',
        email: `telefono${Date.now()}@test.com`,
        password: 'Clave123!',
        tipoDocumento: 'CI',
        nitCi: `REG${Date.now()}`,
        telefono: '7000abc12',
      },
    });
    expect(registro.status).toBe(422);

    const clienteValido = await call('/clientes', {
      method: 'POST',
      token: t.admin,
      body: { razonSocial: 'Cliente Valido', tipoDocumento: 'CI', nitCi: `CLIV${Date.now()}`, telefono: '70001234' },
    });
    expect(clienteValido.status).toBe(201);
  });

  it('rechaza fecha de emisión anterior al día actual', async () => {
    const proveedor = await call('/proveedores', { method: 'POST', token: t.admin, body: { razonSocial: 'Proveedor Fechas', nitCi: `FEC-${Date.now()}`, telefono: '70001234' } });
    expect(proveedor.status).toBe(201);

    const prodRes = await call('/productos?q=CASCO-001&limit=10', { token: t.admin });
    const prod = prodRes.body.data.items.find((p: any) => p.codigo === 'CASCO-001');

    const ahora = new Date();
    const ayer = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1);
    const ayerIso = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`;

    const pasada = await call('/compras', {
      method: 'POST',
      token: t.admin,
      body: { proveedor_id: proveedor.body.data.id, fecha_emision: ayerIso, items: [{ producto_id: prod.id, cantidad: 1, costo_unitario: 10 }] },
    });
    expect(pasada.status).toBe(422);

    const hoyIso = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    const vigente = await call('/compras', {
      method: 'POST',
      token: t.admin,
      body: { proveedor_id: proveedor.body.data.id, fecha_emision: hoyIso, items: [{ producto_id: prod.id, cantidad: 1, costo_unitario: 10 }] },
    });
    expect(vigente.status).toBe(201);
  });

  it('almacenero puede gestionar compras/proveedores; vendedor solo lectura', async () => {
    expect((await call('/proveedores', { token: t.almacen })).status).toBe(200);
    expect((await call('/compras', { token: t.almacen })).status).toBe(200);
    expect((await call('/proveedores', { token: t.vendedor })).status).toBe(403); // vendedor no gestiona abastecimiento
    expect((await call('/compras', { token: t.vendedor })).status).toBe(403);
    expect([403,422]).toContain((await call('/proveedores', { method: 'POST', token: t.vendedor, body: { razonSocial: 'X', nitCi: '12345678', telefono: '70001111' } })).status);
    expect((await call('/compras', { method: 'POST', token: t.vendedor, body: { proveedor_id: 1, items: [{ producto_id: 1, cantidad: 1, costo_unitario: 1 }] } })).status).toBe(403);
  });

  it('valida tipo NIT/CI y exige al menos un teléfono en proveedores', async () => {
    const nitConLetras = await call('/clientes', {
      method: 'POST',
      token: t.admin,
      body: { razonSocial: 'Cliente NIT Invalido', nitCi: `ABC${Date.now()}` },
    });
    expect(nitConLetras.status).toBe(422);

    const ciConLetras = await call('/clientes', {
      method: 'POST',
      token: t.admin,
      body: { razonSocial: 'Cliente CI Valido', tipoDocumento: 'CI', nitCi: `ABC${Date.now()}` },
    });
    expect(ciConLetras.status).toBe(201);

    const sinTelefono = await call('/proveedores', {
      method: 'POST',
      token: t.admin,
      body: { razonSocial: 'Proveedor Sin Contacto', nitCi: `SIN-${Date.now()}` },
    });
    expect(sinTelefono.status).toBe(422);
  });

  it('registra producto nuevo desde ofertas sin descuento y expone categorías predefinidas', async () => {
    const categorias = await call('/productos/categorias', { token: t.admin });
    expect(categorias.status).toBe(200);
    expect(categorias.body.data).toEqual(expect.arrayContaining(['Cabeza', 'Pecho', 'Botas']));

    const codigo = `NUEVO${Date.now()}`;
    const proveedor = await call('/proveedores', {
      method: 'POST',
      token: t.admin,
      body: {
        razonSocial: 'Proveedor Producto Nuevo',
        nitCi: `NUE-${Date.now()}`,
        telefono: '70002222',
        productos: [
          {
            productoNuevo: { codigo, nombre: 'Casco nuevo ofertado', categoria: 'Cabeza' },
            precioUnitario: 20,
            minimoCompra: 5,
          },
        ],
      },
    });
    expect(proveedor.status).toBe(201);

    const producto = await call(`/productos?q=${codigo}&limit=10`, { token: t.admin });
    expect(producto.body.data.items.some((p: any) => p.codigo === codigo)).toBe(true);

    const ofertas = await call(`/proveedores/${proveedor.body.data.id}/productos`, { token: t.admin });
    expect(ofertas.status).toBe(200);
    expect(ofertas.body.data[0].descuentoPorcentaje).toBeUndefined();
    expect(ofertas.body.data[0].precioUnitario).toBe(20);
  });

  it('almacenero envía solicitud, admin la aprueba y se genera compra automáticamente', async () => {
    const solicitud = await call('/solicitudes-compra', {
      method: 'POST',
      token: t.almacen,
      body: {
        proveedor_id: 1,
        observacion: 'Reposición de stock',
        items: [{ producto_id: 1, cantidad: 50 }],
      },
    });
    expect(solicitud.status).toBe(201);
    expect(solicitud.body.data.estado).toBe('PENDIENTE');

    const comoAdmin = await call('/solicitudes-compra', {
      method: 'POST',
      token: t.admin,
      body: { proveedor_id: 1, items: [{ producto_id: 1, cantidad: 50 }] },
    });
    expect(comoAdmin.status).toBe(403);

    const compraDirecta = await call('/compras', {
      method: 'POST',
      token: t.almacen,
      body: { proveedor_id: 1, items: [{ producto_id: 1, cantidad: 1, costo_unitario: 1 }] },
    });
    expect(compraDirecta.status).toBe(403);

    const aprobacion = await call(`/solicitudes-compra/${solicitud.body.data.id}/aprobar`, {
      method: 'POST',
      token: t.admin,
      body: {},
    });
    expect(aprobacion.status).toBe(200);
    expect(aprobacion.body.data.solicitud.estado).toBe('APROBADA');
    expect(aprobacion.body.data.compra.codigo).toMatch(/^COM-/);

    const compra = await call(`/compras/${aprobacion.body.data.compra.id}`, { token: t.admin });
    expect(compra.status).toBe(200);
    expect(compra.body.data.detalles).toHaveLength(1);
  });
});



