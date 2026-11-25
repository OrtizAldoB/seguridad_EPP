-- 002_seed_data.sql
-- Roles, permisos y matriz RBAC. Los usuarios/clientes/productos de prueba
-- se cargan en src/config/seed.ts (npm run seed) para hashear claves con bcrypt.

BEGIN;

INSERT OR IGNORE INTO roles (codigo, nombre, descripcion) VALUES
  ('ADMINISTRADOR', 'Administrador / Gerente', 'Aprobaciones, usuarios y reportes'),
  ('VENDEDOR', 'Vendedor', 'Clientes, catalogo, cotizaciones y pedidos'),
  ('ALMACENERO', 'Almacenero', 'Kardex, despacho y pick list');

INSERT OR IGNORE INTO permisos (modulo, accion, codigo, descripcion) VALUES
  ('usuarios','leer','usuarios.leer','Listar usuarios'),
  ('usuarios','crear','usuarios.crear','Crear usuarios'),
  ('usuarios','actualizar','usuarios.actualizar','Editar usuarios'),
  ('usuarios','eliminar','usuarios.eliminar','Dar de baja usuarios'),
  ('clientes','leer','clientes.leer','Consultar clientes'),
  ('clientes','crear','clientes.crear','Registrar clientes'),
  ('clientes','actualizar','clientes.actualizar','Editar clientes'),
  ('clientes','eliminar','clientes.eliminar','Dar de baja clientes'),
  ('productos','leer','productos.leer','Consultar catalogo EPP'),
  ('productos','crear','productos.crear','Registrar productos'),
  ('productos','actualizar','productos.actualizar','Editar productos'),
  ('productos','eliminar','productos.eliminar','Dar de baja productos'),
  ('inventario','leer','inventario.leer','Consultar stock y kardex'),
  ('inventario','movimiento','inventario.movimiento','Registrar movimientos'),
  ('cotizaciones','leer','cotizaciones.leer','Consultar cotizaciones'),
  ('cotizaciones','crear','cotizaciones.crear','Registrar cotizaciones'),
  ('cotizaciones','actualizar','cotizaciones.actualizar','Editar cotizaciones'),
  ('pedidos','leer','pedidos.leer','Consultar pedidos'),
  ('pedidos','crear','pedidos.crear','Registrar pedidos'),
  ('pedidos','despachar','pedidos.despachar','Confirmar despacho'),
  ('aprobaciones','leer','aprobaciones.leer','Bandeja de aprobacion'),
  ('aprobaciones','decidir','aprobaciones.decidir','Aprobar o rechazar'),
  ('notificaciones','leer','notificaciones.leer','Ver notificaciones de almacen'),
  ('reportes','leer','reportes.leer','Consultar reportes'),
  ('reportes','exportar','reportes.exportar','Exportar PDF y Excel');

INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p WHERE r.codigo = 'ADMINISTRADOR';

INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r JOIN permisos p ON p.codigo IN (
  'clientes.leer','clientes.crear','clientes.actualizar','clientes.eliminar',
  'productos.leer','inventario.leer','cotizaciones.leer','cotizaciones.crear',
  'cotizaciones.actualizar','pedidos.leer','pedidos.crear','reportes.leer'
) WHERE r.codigo = 'VENDEDOR';

INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r JOIN permisos p ON p.codigo IN (
  'productos.leer','inventario.leer','inventario.movimiento','cotizaciones.leer',
  'pedidos.leer','pedidos.despachar','notificaciones.leer','reportes.leer'
) WHERE r.codigo = 'ALMACENERO';

COMMIT;
