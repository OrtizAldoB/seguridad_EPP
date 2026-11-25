import bcrypt from 'bcryptjs';
import { db, withImmediateTx } from './database';
import { env } from './env';

const COMPRADOR_DEMO_EMAIL = 'comprador@epp.com';
const COMPRADOR_DEMO_NIT = '555666777008';

const USUARIO_SEED = [
  { email: 'admin@epp.com', nombre: 'Elias Quentasi', rol: 'ADMINISTRADOR' },
  { email: 'vendedor@epp.com', nombre: 'Aldo Bracamonte', rol: 'VENDEDOR' },
  { email: 'almacen@epp.com', nombre: 'Almacen Central', rol: 'ALMACENERO' },
  { email: COMPRADOR_DEMO_EMAIL, nombre: 'Comprador Demo', rol: 'COMPRADOR' },
];

const CLIENTES_SEED = [
  {
    razon: 'Constructora del Sur S.A.',
    nit: '123456789001',
    telefono: '70123456',
    email: 'contacto@constructorsur.com',
    direccion: 'Av. Industrial 145, La Paz',
  },
  {
    razon: 'Minera Andina E.I.R.L.',
    nit: '987654321002',
    telefono: '71234567',
    email: 'compras@mineraandina.com',
    direccion: 'Calle Minas 78, Oruro',
  },
  {
    razon: 'Servicios Industriales Beta',
    nit: '102030405003',
    telefono: '72345678',
    email: 'ventas@betaind.com',
    direccion: 'Zona Industrial KM 4, Santa Cruz',
  },
  {
    razon: 'Comprador Demo',
    nit: COMPRADOR_DEMO_NIT,
    telefono: '70000009',
    email: COMPRADOR_DEMO_EMAIL,
    direccion: 'Av. Central 100, La Paz',
  },
];

const PRODUCTOS_SEED = [
  { codigo: 'CASCO-001', nombre: 'Casco de seguridad industrial', categoria: 'Cabeza', unidad: 'UND', precio: 45.5, real: 120, minimo: 30 },
  { codigo: 'GUANTE-001', nombre: 'Guantes de nitrilo', categoria: 'Manos', unidad: 'PAR', precio: 12.0, real: 200, minimo: 60 },
  { codigo: 'GAFAS-001', nombre: 'Gafas de seguridad transparentes', categoria: 'Ojos', unidad: 'UND', precio: 28.0, real: 15, minimo: 20 },
  { codigo: 'BOTAS-001', nombre: 'Botas con puntera de acero', categoria: 'Pies', unidad: 'PAR', precio: 85.0, real: 34, minimo: 24 },
  { codigo: 'CHALECO-001', nombre: 'Chaleco reflector', categoria: 'Cuerpo', unidad: 'UND', precio: 35.0, real: 90, minimo: 25 },
  { codigo: 'RESPIRADOR-001', nombre: 'Respirador N95', categoria: 'Vias respiratorias', unidad: 'UND', precio: 18.5, real: 8, minimo: 20 },
  { codigo: 'TAPON-001', nombre: 'Tapones para oidos', categoria: 'Oidos', unidad: 'PAR', precio: 6.5, real: 500, minimo: 100 },
];

const PROVEEDORES_SEED = [
  { razon: 'Cascos y Protectores del Norte', nit: 'PROV-001', telefono: '70100001', email: 'ventas@protectoresnorte.com', direccion: 'Av.Industrial 12, La Paz' },
  { razon: 'Guantes Industriales Delta', nit: 'PROV-002', telefono: '70100002', email: 'ventas@guantesdelta.com', direccion: 'Calle Fabricas 45, El Alto' },
  { razon: 'Botas Seguras del Sur', nit: 'PROV-003', telefono: '70100003', email: 'ventas@botasseguras.com', direccion: 'Av. Central 210, Sucre' },
  { razon: 'Respiradores Andinos', nit: 'PROV-004', telefono: '70100004', email: 'ventas@respiradoresandinos.com', direccion: 'Zona Industrial 8, Oruro' },
  { razon: 'Suministros EPP Bolivia', nit: 'PROV-005', telefono: '70100005', email: 'ventas@eppbolivia.com', direccion: 'Km 5 Carretera Norte, Santa Cruz' },
];

const OFERTAS_SEED = [
  { nit: 'PROV-001', codigo: 'CASCO-001', precio: 30, minimo: 50, descuento: 5 },
  { nit: 'PROV-001', codigo: 'GAFAS-001', precio: 18, minimo: 50, descuento: 3 },
  { nit: 'PROV-002', codigo: 'GUANTE-001', precio: 8, minimo: 100, descuento: 4 },
  { nit: 'PROV-002', codigo: 'TAPON-001', precio: 4, minimo: 200, descuento: 2 },
  { nit: 'PROV-003', codigo: 'BOTAS-001', precio: 60, minimo: 30, descuento: 6 },
  { nit: 'PROV-003', codigo: 'CHALECO-001', precio: 25, minimo: 50, descuento: 4 },
  { nit: 'PROV-004', codigo: 'RESPIRADOR-001', precio: 12, minimo: 50, descuento: 5 },
  { nit: 'PROV-004', codigo: 'GAFAS-001', precio: 16, minimo: 80, descuento: 2 },
  { nit: 'PROV-005', codigo: 'CASCO-001', precio: 32, minimo: 40, descuento: 3 },
  { nit: 'PROV-005', codigo: 'CHALECO-001', precio: 26, minimo: 60, descuento: 3 },
  { nit: 'PROV-005', codigo: 'GUANTE-001', precio: 7.5, minimo: 120, descuento: 5 },
];

export function seed(): void {
  withImmediateTx(() => {
    const passwordHash = bcrypt.hashSync(env.SEED_PASSWORD, env.BCRYPT_ROUNDS);

    for (const item of USUARIO_SEED) {
      const rol = db.prepare('SELECT id FROM roles WHERE codigo = ?').get(item.rol) as { id: number } | undefined;
      if (!rol) throw new Error(`Rol no encontrado en seed: ${item.rol}`);
      const existe = db.prepare('SELECT id FROM usuarios WHERE email = ? COLLATE NOCASE').get(item.email);
      if (!existe) {
        db.prepare(
          `INSERT INTO usuarios (nombre_completo, email, password_hash, rol_id, activo)
           VALUES (?, ?, ?, ?, 1)`,
        ).run(item.nombre, item.email, passwordHash, rol.id);
      }
    }

    for (const item of CLIENTES_SEED) {
      const existe = db.prepare('SELECT id FROM clientes WHERE nit_ci = ?').get(item.nit);
      if (!existe) {
        db.prepare(
          `INSERT INTO clientes (razon_social, nit_ci, telefono, email, direccion, estado)
           VALUES (?, ?, ?, ?, ?, 'ACTIVO')`,
        ).run(item.razon, item.nit, item.telefono, item.email, item.direccion);
      }
    }

    db.prepare(
      `UPDATE usuarios SET cliente_id = (SELECT id FROM clientes WHERE nit_ci = ?)
       WHERE email = ? AND cliente_id IS NULL`,
    ).run(COMPRADOR_DEMO_NIT, COMPRADOR_DEMO_EMAIL);

    for (const item of PRODUCTOS_SEED) {
      const existe = db.prepare('SELECT id FROM productos_epp WHERE codigo = ?').get(item.codigo);
      if (!existe) {
        db.prepare(
          `INSERT INTO productos_epp
            (codigo, nombre, categoria, unidad_medida, precio_unitario, stock_real, stock_comprometido, stock_minimo, activo)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, 1)`,
        ).run(item.codigo, item.nombre, item.categoria, item.unidad, item.precio, item.real, item.minimo);
      }
    }

    for (const item of PROVEEDORES_SEED) {
      const existe = db.prepare('SELECT id FROM proveedores WHERE nit_ci = ?').get(item.nit);
      if (!existe) {
        db.prepare(
          `INSERT INTO proveedores (razon_social, nit_ci, telefono, email, direccion, estado)
           VALUES (?, ?, ?, ?, ?, 'ACTIVO')`,
        ).run(item.razon, item.nit, item.telefono, item.email, item.direccion);
      }
    }

    for (const item of OFERTAS_SEED) {
      const proveedor = db.prepare('SELECT id FROM proveedores WHERE nit_ci = ?').get(item.nit) as { id: number } | undefined;
      const producto = db.prepare('SELECT id FROM productos_epp WHERE codigo = ?').get(item.codigo) as { id: number } | undefined;
      if (!proveedor || !producto) continue;
      db.prepare(
        `INSERT OR IGNORE INTO proveedor_productos
          (proveedor_id, producto_id, precio_unitario, minimo_compra, descuento_porcentaje)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(proveedor.id, producto.id, item.precio, item.minimo, item.descuento);
      db.prepare(
        `UPDATE productos_epp
         SET proveedor_id = ?, descuento_porcentaje = ?, costo_unitario = ?, actualizado_en = datetime('now')
         WHERE id = ?`,
      ).run(proveedor.id, item.descuento, item.precio, producto.id);
    }
  });

  console.log('[seed] usuarios, clientes, productos y proveedores listos');
}
