BEGIN;

ALTER TABLE productos_epp ADD COLUMN proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL;
ALTER TABLE productos_epp ADD COLUMN descuento_porcentaje REAL NOT NULL DEFAULT 0 CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100);
ALTER TABLE productos_epp ADD COLUMN costo_unitario REAL NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0);

CREATE TABLE proveedor_productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proveedor_id INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos_epp(id) ON DELETE CASCADE,
  precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
  minimo_compra INTEGER NOT NULL CHECK (minimo_compra > 0),
  descuento_porcentaje REAL NOT NULL DEFAULT 0 CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (proveedor_id, producto_id)
);

ALTER TABLE kardex_movimientos ADD COLUMN costo_unitario REAL NOT NULL DEFAULT 0;
ALTER TABLE kardex_movimientos ADD COLUMN valor_total REAL NOT NULL DEFAULT 0;
ALTER TABLE kardex_movimientos ADD COLUMN verificado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE kardex_movimientos ADD COLUMN verificado_en TEXT;

ALTER TABLE cotizaciones ADD COLUMN plazo_meses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cotizaciones ADD COLUMN interes_monto REAL NOT NULL DEFAULT 0;
ALTER TABLE cotizaciones ADD COLUMN fecha_limite_pago TEXT;

ALTER TABLE pedidos ADD COLUMN subtotal REAL NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN descuento_monto REAL NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN impuesto_monto REAL NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN interes_monto REAL NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN plazo_meses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN fecha_limite_pago TEXT;

CREATE INDEX idx_proveedor_productos_proveedor ON proveedor_productos(proveedor_id);
CREATE INDEX idx_proveedor_productos_producto ON proveedor_productos(producto_id);
CREATE INDEX idx_kardex_verificado_por ON kardex_movimientos(verificado_por);

COMMIT;
