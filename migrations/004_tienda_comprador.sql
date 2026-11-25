-- 004_tienda_comprador.sql
-- Cliente registrado: carrito persistente, checkout y pedidos propios.
BEGIN;

ALTER TABLE usuarios ADD COLUMN cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_cliente ON usuarios(cliente_id);

CREATE TABLE IF NOT EXISTS carrito_items (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos_epp(id) ON DELETE CASCADE,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (usuario_id, producto_id)
);

CREATE INDEX IF NOT EXISTS idx_carrito_usuario ON carrito_items(usuario_id);

INSERT OR IGNORE INTO roles (codigo, nombre, descripcion) VALUES
  ('COMPRADOR', 'Comprador', 'Cliente registrado: catalogo, carrito y pedidos propios');

INSERT OR IGNORE INTO permisos (modulo, accion, codigo, descripcion) VALUES
  ('tienda','comprar','tienda.comprar','Comprar EPP desde la tienda'),
  ('tienda','pedidos_propios','tienda.pedidos.propios','Consultar pedidos propios');

INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r JOIN permisos p ON p.codigo IN ('tienda.comprar', 'tienda.pedidos.propios')
WHERE r.codigo = 'COMPRADOR';

INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.codigo = 'ADMINISTRADOR' AND p.modulo = 'tienda';

COMMIT;
