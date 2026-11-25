export const ROLES = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  VENDEDOR: 'VENDEDOR',
  ALMACENERO: 'ALMACENERO',
  COMPRADOR: 'COMPRADOR',
} as const;

export type RolCodigo = (typeof ROLES)[keyof typeof ROLES];

export const PERMISOS = {
  USUARIOS_LEER: 'usuarios.leer',
  USUARIOS_CREAR: 'usuarios.crear',
  USUARIOS_ACTUALIZAR: 'usuarios.actualizar',
  USUARIOS_ELIMINAR: 'usuarios.eliminar',
  CLIENTES_LEER: 'clientes.leer',
  CLIENTES_CREAR: 'clientes.crear',
  CLIENTES_ACTUALIZAR: 'clientes.actualizar',
  CLIENTES_ELIMINAR: 'clientes.eliminar',
  PRODUCTOS_LEER: 'productos.leer',
  PRODUCTOS_CREAR: 'productos.crear',
  PRODUCTOS_ACTUALIZAR: 'productos.actualizar',
  PRODUCTOS_ELIMINAR: 'productos.eliminar',
  INVENTARIO_LEER: 'inventario.leer',
  INVENTARIO_MOVIMIENTO: 'inventario.movimiento',
  COTIZACIONES_LEER: 'cotizaciones.leer',
  COTIZACIONES_CREAR: 'cotizaciones.crear',
  COTIZACIONES_ACTUALIZAR: 'cotizaciones.actualizar',
  COTIZACIONES_APROBAR: 'cotizaciones.aprobar',
  PEDIDOS_LEER: 'pedidos.leer',
  PEDIDOS_CREAR: 'pedidos.crear',
  PEDIDOS_DESPACHAR: 'pedidos.despachar',
  APROBACIONES_LEER: 'aprobaciones.leer',
  APROBACIONES_DECIDIR: 'aprobaciones.decidir',
  NOTIFICACIONES_LEER: 'notificaciones.leer',
  REPORTES_LEER: 'reportes.leer',
  REPORTES_EXPORTAR: 'reportes.exportar',
  PROVEEDORES_LEER: 'proveedores.leer',
  PROVEEDORES_CREAR: 'proveedores.crear',
  PROVEEDORES_ACTUALIZAR: 'proveedores.actualizar',
  PROVEEDORES_ELIMINAR: 'proveedores.eliminar',
  COMPRAS_LEER: 'compras.leer',
  COMPRAS_CREAR: 'compras.crear',
  COMPRAS_ACTUALIZAR: 'compras.actualizar',
  SOLICITUDES_LEER: 'solicitudes.leer',
  SOLICITUDES_CREAR: 'solicitudes.crear',
  SOLICITUDES_DECIDIR: 'solicitudes.decidir',
  TIENDA_COMPRAR: 'tienda.comprar',
  TIENDA_PEDIDOS_PROPIOS: 'tienda.pedidos.propios',
} as const;

export const CATEGORIAS_EPP = [
  'Cabeza',
  'Cara',
  'Ojos',
  'Oidos',
  'Vias respiratorias',
  'Cuello',
  'Pecho',
  'Cuerpo',
  'Manos',
  'Pies',
  'Botas',
  'Proteccion contra caidas',
] as const;

export const DIAS_VIGENCIA_COTIZACION = 15;
export const DESCUENTO_MAXIMO_SIN_APROBACION = 10;
export const IVA_PORCENTAJE = 16;
export const TASA_INTERES_MENSUAL = 3;
export const DIAS_POR_MES = 30;

export const ESTADOS_COTIZACION = [
  'BORRADOR', 'ENVIADA', 'ACEPTADA', 'VENCIDA', 'CONVERTIDA', 'RECHAZADA',
] as const;
export const ESTADOS_PEDIDO = [
  'PENDIENTE_APROBACION', 'REGISTRADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO', 'CANCELADO',
] as const;
export const TIPOS_MOVIMIENTO = ['ENTRADA_COMPRA', 'SALIDA_VENTA', 'AJUSTE_MANUAL'] as const;
