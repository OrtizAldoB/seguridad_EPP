BEGIN;

ALTER TABLE clientes ADD COLUMN tipo_documento TEXT NOT NULL DEFAULT 'NIT' CHECK (tipo_documento IN ('NIT', 'CI'));
UPDATE clientes SET tipo_documento = 'CI' WHERE nit_ci GLOB '*[A-Za-z]*';

CREATE TABLE solicitudes_compra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  proveedor_id INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','APROBADA','RECHAZADA')),
  observacion TEXT,
  motivo_rechazo TEXT,
  compra_id INTEGER REFERENCES compras(id) ON DELETE SET NULL,
  aprobado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  aprobado_en TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE solicitud_compra_detalles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitud_id INTEGER NOT NULL REFERENCES solicitudes_compra(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos_epp(id) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  UNIQUE (solicitud_id, producto_id)
);

CREATE INDEX idx_solicitudes_estado ON solicitudes_compra(estado, creado_en DESC);
CREATE INDEX idx_solicitudes_proveedor ON solicitudes_compra(proveedor_id, estado);
CREATE INDEX idx_solicitud_detalles_producto ON solicitud_compra_detalles(producto_id);

INSERT OR IGNORE INTO permisos (modulo, accion, codigo, descripcion) VALUES
  ('solicitudes','leer','solicitudes.leer','Consultar solicitudes de compra'),
  ('solicitudes','crear','solicitudes.crear','Registrar solicitudes de compra'),
  ('solicitudes','decidir','solicitudes.decidir','Aprobar o rechazar solicitudes de compra');

INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r JOIN permisos p ON p.codigo IN ('solicitudes.leer','solicitudes.decidir')
WHERE r.codigo = 'ADMINISTRADOR';

INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r JOIN permisos p ON p.codigo IN ('solicitudes.leer','solicitudes.crear')
WHERE r.codigo = 'ALMACENERO';

DELETE FROM rol_permisos
WHERE rol_id = (SELECT id FROM roles WHERE codigo = 'ALMACENERO')
  AND permiso_id = (SELECT id FROM permisos WHERE codigo = 'compras.crear');

COMMIT;
