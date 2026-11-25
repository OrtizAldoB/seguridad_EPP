import { withImmediateTx } from '../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors';
import * as productosRepo from '../productos/productos.repository';
import * as repo from './proveedores.repository';
import type {
  CreateProveedorData,
  CreateProveedorProductoData,
  ListProveedoresFilters,
  Proveedor,
  ProveedorProducto,
  UpdateProveedorData,
} from './proveedores.repository';

export interface CreateProveedorInput extends CreateProveedorData {
  productos?: CreateProveedorProductoData[];
}
export interface UpdateProveedorInput extends UpdateProveedorData {
  productos?: CreateProveedorProductoData[];
}

function validarTelefonos(datos: { telefono?: string; contacto?: string }): void {
  if (!datos.telefono?.trim() && !datos.contacto?.trim()) {
    throw new BadRequestError('Debe registrar un celular, un teléfono o ambos');
  }
}

function validarOfertas(productos: CreateProveedorProductoData[]): void {
  const vistos = new Set<number>();
  const codigos = new Set<string>();
  for (const producto of productos) {
    if (producto.productoId) {
      if (vistos.has(producto.productoId)) {
        throw new BadRequestError(`El producto ${producto.productoId} está repetido en el proveedor`);
      }
      vistos.add(producto.productoId);
      if (!repo.findProductoBase(producto.productoId)) {
        throw new NotFoundError(`Producto ${producto.productoId} no encontrado`);
      }
      continue;
    }

    const productoNuevo = producto.productoNuevo;
    if (!productoNuevo) throw new BadRequestError('Selecciona un producto existente o registra uno nuevo');
    const codigo = productoNuevo.codigo.trim();
    const codigoNormalizado = codigo.toUpperCase();
    if (codigos.has(codigoNormalizado)) {
      throw new BadRequestError(`El código ${codigo} está repetido en las ofertas`);
    }
    codigos.add(codigoNormalizado);
    if (productosRepo.findProductoByCodigo(codigo)) {
      throw new ConflictError(`El codigo del producto ${codigo} ya esta registrado`);
    }
  }
}

function resolverOfertas(productos: CreateProveedorProductoData[]): CreateProveedorProductoData[] {
  return productos.map((producto) => {
    if (producto.productoId || !producto.productoNuevo) return producto;
    const creado = productosRepo.createProducto({
      codigo: producto.productoNuevo.codigo.trim(),
      nombre: producto.productoNuevo.nombre.trim(),
      categoria: producto.productoNuevo.categoria,
      unidadMedida: producto.productoNuevo.unidadMedida ?? 'UND',
      descripcion: producto.productoNuevo.descripcion,
      precioUnitario: producto.precioUnitario,
      stockReal: 0,
      descuentoPorcentaje: 0,
      activo: true,
    });
    return { ...producto, productoId: creado.id };
  });
}

export function list(f: ListProveedoresFilters): { items: Proveedor[]; total: number } {
  return repo.listProveedores(f);
}

export function getById(id: number): Proveedor {
  const row = repo.findProveedorById(id);
  if (!row) throw new NotFoundError('Proveedor no encontrado');
  return repo.toProveedor(row);
}

export function productosByProveedor(id: number): ProveedorProducto[] {
  if (!repo.findProveedorById(id)) throw new NotFoundError('Proveedor no encontrado');
  return repo.listOfertasByProveedorId(id);
}

export function create(d: CreateProveedorInput): Proveedor {
  return withImmediateTx(() => {
    validarTelefonos(d);
    if (repo.findProveedorByNitCi(d.nitCi)) throw new ConflictError('El NIT/CI del proveedor ya esta registrado');
    const productos = d.productos ?? [];
    validarOfertas(productos);
    const proveedor = repo.createProveedor(d);
    const ofertas = resolverOfertas(productos);
    if (ofertas.length) repo.replaceOfertas(proveedor.id, ofertas);
    return repo.toProveedor(proveedor);
  });
}

export function update(id: number, d: UpdateProveedorInput): Proveedor {
  return withImmediateTx(() => {
    const row = repo.findProveedorById(id);
    if (!row) throw new NotFoundError('Proveedor no encontrado');
    if (d.telefono !== undefined || d.contacto !== undefined) {
      validarTelefonos({ telefono: d.telefono ?? row.telefono ?? undefined, contacto: d.contacto ?? row.contacto ?? undefined });
    }
    if (d.nitCi !== undefined) {
      const other = repo.findProveedorByNitCi(d.nitCi);
      if (other && other.id !== id) throw new ConflictError('El NIT/CI del proveedor ya esta registrado');
    }
    if (d.productos !== undefined) {
      validarOfertas(d.productos);
      repo.replaceOfertas(id, resolverOfertas(d.productos));
    }
    repo.updateProveedor(id, d);
    return getById(id);
  });
}

export function remove(id: number): Proveedor {
  if (!repo.findProveedorById(id)) throw new NotFoundError('Proveedor no encontrado');
  repo.deactivateProveedor(id);
  return getById(id);
}
