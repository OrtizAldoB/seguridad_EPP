-- 003_proveedores_compras.sql
BEGIN;

CREATE TABLE IF NOT EXISTS proveedores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  razon_social TEXT NOT NULL,
  nit_ci TEXT NOT NULL UNIQUE COLLATE NOCASE,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  contacto TEXT,
  estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS compras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  proveedor_id INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  estado TEXT NOT NULL DEFAULT 'REGISTRADA' CHECK (estado IN ('REGISTRADA','RECIBIDA','CANCELADA')),
  observacion TEXT,
  total REAL NOT NULL DEFAULT 0,
  fecha_emision TEXT NOT NULL DEFAULT (date('now')),
  fecha_recepcion TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS compra_detalles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  compra_id INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos_epp(id) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  costo_unitario REAL NOT NULL CHECK (costo_unitario >= 0),
  subtotal REAL NOT NULL,
  UNIQUE (compra_id, producto_id)
);

CREATE INDEX IF NOT EXISTS idx_proveedores_estado ON proveedores(estado, nit_ci);
CREATE INDEX IF NOT EXISTS idx_compras_proveedor_fecha ON compras(proveedor_id, fecha_emision DESC);
CREATE INDEX IF NOT EXISTS idx_compras_estado ON compras(estado, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_compra_detalles_producto ON compra_detalles(producto_id);

INSERT OR IGNORE INTO permisos (modulo, accion, codigo, descripcion) VALUES
  ('proveedores','leer','proveedores.leer','Consultar proveedores'),
  ('proveedores','crear','proveedores.crear','Registrar proveedores'),
  ('proveedores','actualizar','proveedores.actualizar','Editar proveedores'),
  ('proveedores','eliminar','proveedores.eliminar','Dar de baja proveedores'),
  ('compras','leer','compras.leer','Consultar compras'),
  ('compras','crear','compras.crear','Registrar compras'),
  ('compras','actualizar','compras.actualizar','Editar/recibir compras');

INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p WHERE r.codigo = 'ADMINISTRADOR' AND p.modulo IN ('proveedores','compras');

INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r JOIN permisos p ON p.codigo IN ('proveedores.leer','compras.leer','compras.crear','compras.actualizar')
WHERE r.codigo = 'ALMACENERO';

COMMIT;
