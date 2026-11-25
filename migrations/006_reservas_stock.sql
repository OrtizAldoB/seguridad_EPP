CREATE TABLE IF NOT EXISTS reservas_stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos_epp(id) ON DELETE CASCADE,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('RESERVA', 'LIBERACION', 'DESPACHO')),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reservas_stock_pedido ON reservas_stock(pedido_id);
CREATE INDEX IF NOT EXISTS idx_reservas_stock_producto ON reservas_stock(producto_id);
