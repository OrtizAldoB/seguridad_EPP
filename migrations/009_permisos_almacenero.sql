-- 009_permisos_almacenero.sql
BEGIN;

INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON p.codigo IN (
  'clientes.leer','productos.leer',
  'inventario.leer','inventario.movimiento',
  'pedidos.leer','pedidos.despachar',
  'notificaciones.leer','reportes.leer',
  'proveedores.leer','compras.leer','compras.actualizar',
  'solicitudes.leer','solicitudes.crear'
)
WHERE r.codigo = 'ALMACENERO';

DELETE FROM rol_permisos
WHERE rol_id = (SELECT id FROM roles WHERE codigo = 'ALMACENERO')
  AND permiso_id IN (
    SELECT id FROM permisos WHERE codigo IN (
      'usuarios.leer','usuarios.crear','usuarios.actualizar','usuarios.eliminar',
      'clientes.crear','clientes.actualizar','clientes.eliminar',
      'productos.crear','productos.actualizar','productos.eliminar',
      'cotizaciones.leer','cotizaciones.crear','cotizaciones.actualizar','cotizaciones.aprobar',
      'pedidos.crear',
      'aprobaciones.leer','aprobaciones.decidir',
      'proveedores.crear','proveedores.actualizar','proveedores.eliminar',
      'compras.crear',
      'solicitudes.decidir',
      'tienda.comprar','tienda.pedidos.propios'
    )
  );

COMMIT;
