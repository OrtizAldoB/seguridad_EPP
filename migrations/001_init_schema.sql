-- 001_init_schema.sql
-- Esquema canonico: 12 entidades del dominio + soporte de sesiones y migraciones.

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  aplicada_en TEXT NOT NULL DEFAULT (datetime('now'))
);

BEGIN;

CREATE TABLE roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE CHECK (codigo <> ''),
  nombre TEXT NOT NULL,
  descripcion TEXT
);

CREATE TABLE permisos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  modulo TEXT NOT NULL,
  accion TEXT NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  descripcion TEXT NOT NULL,
  UNIQUE (modulo, accion)
);

CREATE TABLE rol_permisos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rol_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permiso_id INTEGER NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
  UNIQUE (rol_id, permiso_id)
);

CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_completo TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  rol_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  ultimo_acceso_en TEXT
);

CREATE TABLE sesiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  creada_en TEXT NOT NULL DEFAULT (datetime('now')),
  expira_en TEXT NOT NULL,
  revocada_en TEXT
);

CREATE TABLE clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  razon_social TEXT NOT NULL,
  nit_ci TEXT NOT NULL UNIQUE COLLATE NOCASE,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE productos_epp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL,
  unidad_medida TEXT NOT NULL DEFAULT 'UND',
  descripcion TEXT,
  precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
  stock_real INTEGER NOT NULL DEFAULT 0 CHECK (stock_real >= 0),
  stock_comprometido INTEGER NOT NULL DEFAULT 0 CHECK (stock_comprometido >= 0),
  stock_minimo INTEGER NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (stock_comprometido <= stock_real)
);

CREATE TABLE kardex_movimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos_epp(id) ON DELETE RESTRICT,
  tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('ENTRADA_COMPRA','SALIDA_VENTA','AJUSTE_MANUAL')),
  cantidad INTEGER NOT NULL CHECK (cantidad <> 0),
  stock_anterior INTEGER NOT NULL,
  stock_nuevo INTEGER NOT NULL,
  referencia TEXT,
  observacion TEXT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  fecha TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE cotizaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  vendedor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  subtotal REAL NOT NULL DEFAULT 0,
  descuento_porcentaje REAL NOT NULL DEFAULT 0 CHECK (descuento_porcentaje BETWEEN 0 AND 100),
  descuento_monto REAL NOT NULL DEFAULT 0,
  impuesto_monto REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  condicion_pago TEXT NOT NULL DEFAULT 'CONTADO' CHECK (condicion_pago IN ('CONTADO','CREDITO')),
  requiere_aprobacion INTEGER NOT NULL DEFAULT 0 CHECK (requiere_aprobacion IN (0,1)),
  estado TEXT NOT NULL DEFAULT 'ENVIADA' CHECK (estado IN ('BORRADOR','ENVIADA','ACEPTADA','VENCIDA','CONVERTIDA','RECHAZADA')),
  observacion TEXT,
  fecha_emision TEXT NOT NULL DEFAULT (date('now')),
  fecha_vencimiento TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (fecha_vencimiento >= fecha_emision)
);

CREATE TABLE cotizacion_detalles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cotizacion_id INTEGER NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos_epp(id) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
  descuento_porcentaje REAL NOT NULL DEFAULT 0 CHECK (descuento_porcentaje BETWEEN 0 AND 100),
  subtotal REAL NOT NULL,
  UNIQUE (cotizacion_id, producto_id)
);

CREATE TABLE pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  cotizacion_id INTEGER UNIQUE REFERENCES cotizaciones(id) ON DELETE SET NULL,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  vendedor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  estado TEXT NOT NULL DEFAULT 'REGISTRADO' CHECK (estado IN ('PENDIENTE_APROBACION','REGISTRADO','EN_PREPARACION','DESPACHADO','ENTREGADO','CANCELADO')),
  condicion_pago TEXT NOT NULL CHECK (condicion_pago IN ('CONTADO','CREDITO')),
  descuento_porcentaje REAL NOT NULL DEFAULT 0 CHECK (descuento_porcentaje BETWEEN 0 AND 100),
  total REAL NOT NULL DEFAULT 0,
  fecha_estimada_entrega TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  despachado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  despachado_en TEXT,
  observacion TEXT,
  CHECK (fecha_estimada_entrega >= date(creado_en))
);

CREATE TABLE pedido_detalles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos_epp(id) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
  subtotal REAL NOT NULL,
  UNIQUE (pedido_id, producto_id)
);

CREATE TABLE auditoria_financiera (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER REFERENCES pedidos(id) ON DELETE SET NULL,
  cotizacion_id INTEGER REFERENCES cotizaciones(id) ON DELETE SET NULL,
  usuario_aprobador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  tipo_validacion TEXT NOT NULL CHECK (tipo_validacion IN ('DESCUENTO_ESPECIAL','VENTA_CREDITO')),
  decision TEXT NOT NULL CHECK (decision IN ('APROBADO','RECHAZADO')),
  observacion TEXT,
  fecha_hora TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE notificaciones_almacen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  mensaje TEXT NOT NULL,
  leida INTEGER NOT NULL DEFAULT 0 CHECK (leida IN (0,1)),
  creada_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_usuarios_rol ON usuarios(rol_id);
CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX idx_clientes_estado_nit ON clientes(estado, nit_ci);
CREATE INDEX idx_productos_categoria ON productos_epp(categoria);
CREATE INDEX idx_productos_stock ON productos_epp(stock_real, stock_comprometido, stock_minimo);
CREATE INDEX idx_kardex_producto_fecha ON kardex_movimientos(producto_id, fecha DESC);
CREATE INDEX idx_kardex_fecha ON kardex_movimientos(fecha DESC);
CREATE INDEX idx_cotizaciones_cliente_fecha ON cotizaciones(cliente_id, fecha_emision DESC);
CREATE INDEX idx_cotizaciones_estado_venc ON cotizaciones(estado, fecha_vencimiento);
CREATE INDEX idx_cotizacion_detalles_producto ON cotizacion_detalles(producto_id);
CREATE INDEX idx_pedidos_estado_fecha ON pedidos(estado, creado_en DESC);
CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX idx_pedido_detalles_producto ON pedido_detalles(producto_id);
CREATE INDEX idx_auditoria_fecha ON auditoria_financiera(fecha_hora DESC);
CREATE INDEX idx_notificaciones_leida ON notificaciones_almacen(leida, creada_en DESC);

COMMIT;
