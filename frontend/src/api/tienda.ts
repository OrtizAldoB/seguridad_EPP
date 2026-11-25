import { api } from './client';

export interface ProductoTienda {
  id: number;
  codigo: string;
  nombre: string;
  categoria: string;
  unidadMedida: string;
  descripcion: string | null;
  precioUnitario: number;
  stockDisponible: number;
  semaforo: string;
}

export interface Catalogo {
  items: ProductoTienda[];
  categorias: string[];
}

export interface CarritoItem {
  productoId: number;
  codigo: string;
  nombre: string;
  categoria: string;
  unidadMedida: string;
  precioUnitario: number;
  stockDisponible: number;
  cantidad: number;
  subtotal: number;
}

export interface Carrito {
  items: CarritoItem[];
  cantidadItems: number;
  subtotal: number;
  descuentoMonto: number;
  impuestoMonto: number;
  total: number;
}

export interface PedidoDetalle {
  id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  codigo: string;
  nombre: string;
  unidad_medida: string;
}

export interface PedidoPropio {
  pedido: {
    id: number;
    codigo: string;
    estado: string;
    condicionPago: string;
    total: number;
    fechaEstimadaEntrega?: string;
    fecha_estimada_entrega: string;
    creadoEn?: string;
    creado_en: string;
    observacion: string | null;
  };
  items: PedidoDetalle[];
}

export interface CheckoutPayload {
  condicionPago: 'CONTADO' | 'CREDITO';
  observacion?: string;
  diasEntrega: number;
}

export const tiendaApi = {
  catalogo: (q?: string, categoria?: string) =>
    api<Catalogo>(`/tienda/catalogo?q=${encodeURIComponent(q ?? '')}&categoria=${encodeURIComponent(categoria ?? '')}`),
  carrito: () => api<Carrito>('/tienda/carrito'),
  agregarItem: (productoId: number, cantidad: number) =>
    api<Carrito>('/tienda/carrito/items', { method: 'POST', body: { productoId, cantidad } }),
  actualizarCantidad: (productoId: number, cantidad: number) =>
    api<Carrito>(`/tienda/carrito/items/${productoId}`, { method: 'PATCH', body: { cantidad } }),
  eliminarItem: (productoId: number) => api<Carrito>(`/tienda/carrito/items/${productoId}`, { method: 'DELETE' }),
  vaciar: () => api<Carrito>('/tienda/carrito', { method: 'DELETE' }),
  checkout: (payload: CheckoutPayload) => api<PedidoPropio>('/tienda/checkout', { method: 'POST', body: payload }),
  misPedidos: () => api<PedidoPropio[]>('/tienda/mis-pedidos'),
  miPedido: (id: number) => api<PedidoPropio>(`/tienda/mis-pedidos/${id}`),
};
