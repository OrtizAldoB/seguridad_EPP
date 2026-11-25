import { db } from '../../config/database';
import { CATEGORIAS_EPP } from '../../shared/constants';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors';
import * as repo from './productos.repository';
import type { ListProductosFilters, Producto, UpdateProductoData } from './productos.repository';

export interface CreateProductoInput {
  codigo: string;
  nombre: string;
  categoria: string;
  unidadMedida?: string;
  descripcion?: string;
  precioUnitario: number;
  stockReal: number;
  stockComprometido?: number;
  stockMinimo?: number;
  proveedorId?: number | null;
  descuentoPorcentaje?: number;
  activo: boolean;
}

export type UpdateProductoInput = UpdateProductoData;

function validarProveedor(proveedorId?: number | null): void {
  if (proveedorId === undefined || proveedorId === null) return;
  const proveedor = db.prepare('SELECT id FROM proveedores WHERE id = ?').get(proveedorId);
  if (!proveedor) throw new BadRequestError('Proveedor no encontrado');
}

export function list(filters: ListProductosFilters): { items: Producto[]; total: number } {
  return repo.listProductos(filters);
}

export function getById(id: number): Producto {
  const row = repo.findProductoById(id);
  if (!row) throw new NotFoundError('Producto no encontrado');
  return repo.toProducto(row);
}

export function categorias(): string[] {
  return Array.from(new Set<string>([...CATEGORIAS_EPP, ...repo.listCategorias()]));
}

export function alertas(): Producto[] {
  return repo
    .listProductosActivos()
    .map(repo.toProducto)
    .filter((producto) => producto.semaforo === 'ROJO' || producto.semaforo === 'AMARILLO');
}

export function create(data: CreateProductoInput): Producto {
  if (repo.findProductoByCodigo(data.codigo)) throw new ConflictError('El codigo del producto ya esta registrado');
  if ((data.stockComprometido ?? 0) > data.stockReal) {
    throw new BadRequestError('stock_comprometido no puede superar stock_real');
  }
  validarProveedor(data.proveedorId);
  return repo.toProducto(repo.createProducto(data));
}

export function update(id: number, data: UpdateProductoInput): Producto {
  const row = repo.findProductoById(id);
  if (!row) throw new NotFoundError('Producto no encontrado');

  if (data.codigo !== undefined) {
    const other = repo.findProductoByCodigo(data.codigo);
    if (other && other.id !== id) throw new ConflictError('El codigo del producto ya esta registrado');
  }

  const stockReal = data.stockReal ?? row.stock_real;
  const stockComprometido = data.stockComprometido ?? row.stock_comprometido;
  if (stockComprometido > stockReal) {
    throw new BadRequestError('stock_comprometido no puede superar stock_real');
  }
  validarProveedor(data.proveedorId);

  repo.updateProducto(id, data);
  return getById(id);
}

export function remove(id: number): Producto {
  if (!repo.findProductoById(id)) throw new NotFoundError('Producto no encontrado');
  repo.deactivateProducto(id);
  return getById(id);
}
