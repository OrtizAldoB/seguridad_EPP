import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage, qs } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  Card,
  EmptyState,
  ErrorBox,
  EstadoBadge,
  Field,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  StatCard,
  StockBadge,
  fmtDateTime,
  money,
  numberFormat,
} from '../components/ui';

interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  categoria: string;
  unidadMedida: string;
  descripcion: string | null;
  precioUnitario: number;
  stockReal: number;
  stockComprometido: number;
  stockMinimo: number;
  stockDisponible: number;
  semaforo: 'VERDE' | 'AMARILLO' | 'ROJO';
  proveedorId: number | null;
  descuentoPorcentaje: number;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

interface ListaProductos {
  items: Producto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface FormularioProducto {
  codigo: string;
  nombre: string;
  categoria: string;
  unidadMedida: string;
  descripcion: string;
  precioUnitario: string;
  stockReal: string;
  stockComprometido: string;
  stockMinimo: string;
  proveedorId: string;
  descuentoPorcentaje: string;
  activo: boolean;
}

const FORMULARIO_VACIO: FormularioProducto = {
  codigo: '',
  nombre: '',
  categoria: '',
  unidadMedida: 'UND',
  descripcion: '',
  precioUnitario: '',
  stockReal: '0',
  stockComprometido: '0',
  stockMinimo: '0',
  proveedorId: '',
  descuentoPorcentaje: '0',
  activo: true,
};

export default function ProductosPage() {
  const { hasPermiso } = useAuth();
  const puedeCrear = hasPermiso('productos.crear');
  const puedeActualizar = hasPermiso('productos.actualizar');
  const puedeEliminar = hasPermiso('productos.eliminar');
  const [lista, setLista] = useState<ListaProductos | null>(null);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [proveedores, setProveedores] = useState<{ id: number; razonSocial: string }[]>([]);
  const [alertas, setAlertas] = useState<Producto[]>([]);
  const [buscar, setBuscar] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroActivo, setFiltroActivo] = useState<'' | 'true' | 'false'>('');
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [errorCatalogos, setErrorCatalogos] = useState('');
  const [modalAbierta, setModalAbierta] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [form, setForm] = useState<FormularioProducto>(FORMULARIO_VACIO);
  const [formError, setFormError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState<number | null>(null);

  const recargar = useCallback(() => setVersion((valor) => valor + 1), []);

  const cargarCatalogos = useCallback(async () => {
    setErrorCatalogos('');
    try {
      const [categoriasResp, alertasResp, proveedoresResp] = await Promise.all([
        api<string[]>('/productos/categorias'),
        api<Producto[]>('/productos/alertas'),
        api<{ items: { id: number; razonSocial: string }[] }>('/proveedores?estado=ACTIVO&limit=100'),
      ]);
      setCategorias(categoriasResp);
      setAlertas(alertasResp);
      setProveedores(proveedoresResp.items ?? []);
    } catch (err) {
      setErrorCatalogos(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void cargarCatalogos();
  }, [cargarCatalogos, version]);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError('');
    const consulta = qs({
      q: buscar,
      categoria: filtroCategoria,
      activo: filtroActivo === '' ? undefined : filtroActivo === 'true',
      page,
      limit: 10,
    });
    api<ListaProductos>(`/productos${consulta}`)
      .then((respuesta) => {
        if (activo) setLista(respuesta);
      })
      .catch((err) => {
        if (activo) setError(errorMessage(err));
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [buscar, filtroCategoria, filtroActivo, page, version]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ ...FORMULARIO_VACIO, categoria: categorias[0] ?? '' });
    setFormError('');
    setModalAbierta(true);
  };

  const abrirEditar = (producto: Producto) => {
    setEditando(producto);
    setForm({
      codigo: producto.codigo,
      nombre: producto.nombre,
      categoria: producto.categoria,
      unidadMedida: producto.unidadMedida,
      descripcion: producto.descripcion ?? '',
      precioUnitario: String(producto.precioUnitario),
      stockReal: String(producto.stockReal),
      stockComprometido: String(producto.stockComprometido),
      stockMinimo: String(producto.stockMinimo),
      proveedorId: producto.proveedorId ? String(producto.proveedorId) : '',
      descuentoPorcentaje: String(producto.descuentoPorcentaje ?? 0),
      activo: producto.activo,
    });
    setFormError('');
    setModalAbierta(true);
  };

  const validar = (): string => {
    if (!form.codigo.trim()) return 'Ingresa el código del producto.';
    if (form.nombre.trim().length < 2) return 'Ingresa un nombre de al menos 2 caracteres.';
    if (!form.categoria.trim()) return 'Ingresa la categoría.';
    const precio = Number(form.precioUnitario);
    if (!Number.isFinite(precio) || precio < 0) return 'El precio unitario debe ser un número mayor o igual a cero.';
    const stockReal = Number(form.stockReal);
    if (!Number.isInteger(stockReal) || stockReal < 0) return 'El stock real debe ser un entero mayor o igual a cero.';
    const stockComprometido = Number(form.stockComprometido || 0);
    if (!Number.isInteger(stockComprometido) || stockComprometido < 0) {
      return 'El stock comprometido debe ser un entero mayor o igual a cero.';
    }
    if (stockComprometido > stockReal) return 'El stock comprometido no puede superar el stock real.';
    const stockMinimo = Number(form.stockMinimo || 0);
    if (!Number.isInteger(stockMinimo) || stockMinimo < 0) {
      return 'El stock mínimo debe ser un entero mayor o igual a cero.';
    }
    const descuento = Number(form.descuentoPorcentaje || 0);
    if (!Number.isFinite(descuento) || descuento < 0 || descuento > 100) {
      return 'El descuento debe estar entre 0 y 100.';
    }
    return '';
  };

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problema = validar();
    if (problema) {
      setFormError(problema);
      return;
    }

    setGuardando(true);
    setFormError('');
    const cuerpo = {
      codigo: form.codigo.trim(),
      nombre: form.nombre.trim(),
      categoria: form.categoria.trim(),
      unidadMedida: form.unidadMedida.trim() || 'UND',
      descripcion: form.descripcion.trim(),
      precioUnitario: Number(form.precioUnitario),
      stockReal: Number(form.stockReal),
      stockComprometido: Number(form.stockComprometido || 0),
      stockMinimo: Number(form.stockMinimo || 0),
      proveedorId: form.proveedorId ? Number(form.proveedorId) : null,
      descuentoPorcentaje: Number(form.descuentoPorcentaje || 0),
      activo: form.activo,
    };
    try {
      if (editando) {
        await api(`/productos/${editando.id}`, { method: 'PATCH', body: cuerpo });
      } else {
        await api('/productos', { method: 'POST', body: cuerpo });
      }
      setModalAbierta(false);
      recargar();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setGuardando(false);
    }
  };

  const darDeBaja = async (producto: Producto) => {
    if (!window.confirm(`¿Dar de baja a ${producto.nombre}? El producto quedará inactivo.`)) return;
    setEliminando(producto.id);
    setError('');
    try {
      await api(`/productos/${producto.id}`, { method: 'DELETE' });
      recargar();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setEliminando(null);
    }
  };

  const productosVisibles = (lista?.items ?? []).filter(
    (producto) => !soloAlertas || producto.semaforo === 'ROJO' || producto.semaforo === 'AMARILLO',
  );

  return (
    <>
      <PageHeader
        title="Productos"
        subtitle={
          puedeCrear || puedeActualizar || puedeEliminar
            ? 'Gestiona el catálogo de EPP, precios y niveles de stock.'
            : 'Consulta el catálogo de EPP, precios y niveles de stock.'
        }
        action={
          puedeCrear && (
            <button type="button" className="btn btn-primary" onClick={abrirNuevo}>
              Nuevo producto
            </button>
          )
        }
      />

      <div className="grid grid-2">
        <StatCard label="Total productos" value={numberFormat(lista?.total ?? 0)} hint="Registros según los filtros" />
        <StatCard
          label="Alertas de stock"
          value={numberFormat(alertas.length)}
          hint="Alertas ámbar y rojo"
          tone="amber"
        />
      </div>

      {errorCatalogos && <ErrorBox message={errorCatalogos} onRetry={() => void cargarCatalogos()} />}

      <Card>
        <div className="filters">
          <Field label="Buscar">
            <input
              type="search"
              value={buscar}
              onChange={(event) => {
                setBuscar(event.target.value);
                setPage(1);
              }}
              placeholder="Código, nombre o categoría"
            />
          </Field>
          <Field label="Categoría">
            <select
              value={filtroCategoria}
              onChange={(event) => {
                setFiltroCategoria(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas</option>
              {categorias.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select
              value={filtroActivo}
              onChange={(event) => {
                setFiltroActivo(event.target.value as '' | 'true' | 'false');
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </Field>
          <button
            type="button"
            className={`btn ${soloAlertas ? 'btn-danger' : ''}`}
            onClick={() => {
              setSoloAlertas((valor) => !valor);
              setPage(1);
            }}
          >
            {soloAlertas ? 'Mostrar todos' : 'Solo alertas'}
          </button>
        </div>
      </Card>

      <Card>
        <div className="card-head">
          <h2>Listado de productos</h2>
          {lista && <span className="muted">{numberFormat(lista.total)} registros</span>}
        </div>

        {error && <ErrorBox message={error} onRetry={recargar} />}

        {!error && cargando && <Loading label="Cargando..." />}

        {!error && !cargando && productosVisibles.length === 0 && (
          <EmptyState message="No se encontraron productos con los filtros seleccionados." />
        )}

        {!error && !cargando && productosVisibles.length > 0 && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Marca / proveedor</th>
                    <th>Precio</th>
                    <th>Descuento</th>
                    <th className="right">Real</th>
                    <th className="right">Comprometido</th>
                    <th className="right">Disponible</th>
                    <th>Semáforo</th>
                    <th>Estado</th>
                    <th>Actualizado</th>
                    {(puedeActualizar || puedeEliminar) && <th className="right">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {productosVisibles.map((producto) => (
                    <tr key={producto.id}>
                      <td>
                        <div className="strong">{producto.nombre}</div>
                        <div className="muted">{producto.codigo}</div>
                      </td>
                      <td>{producto.categoria}</td>
                      <td>{proveedores.find((proveedor) => proveedor.id === producto.proveedorId)?.razonSocial ?? '—'}</td>
                      <td className="nowrap">{money(producto.precioUnitario)}</td>
                      <td className="num">{numberFormat(producto.descuentoPorcentaje ?? 0)}%</td>
                      <td className="num">{numberFormat(producto.stockReal)}</td>
                      <td className="num">{numberFormat(producto.stockComprometido)}</td>
                      <td className="num">{numberFormat(producto.stockDisponible)}</td>
                      <td>
                        <StockBadge semaforo={producto.semaforo} />
                      </td>
                      <td>
                        <EstadoBadge estado={producto.activo ? 'ACTIVO' : 'INACTIVO'} />
                      </td>
                      <td className="nowrap">{fmtDateTime(producto.actualizadoEn)}</td>
                      {(puedeActualizar || puedeEliminar) && (
                        <td>
                          <div className="row-actions">
                            {puedeActualizar && (
                              <button type="button" className="btn btn-sm" onClick={() => abrirEditar(producto)}>
                                Editar
                              </button>
                            )}
                            {puedeEliminar && (
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                onClick={() => void darDeBaja(producto)}
                                disabled={eliminando === producto.id || !producto.activo}
                              >
                                {eliminando === producto.id ? 'Procesando...' : 'Inactivar'}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={lista?.totalPages ?? 1}
              total={lista?.total}
              onChange={setPage}
            />
          </>
        )}
      </Card>

      <Modal
        open={modalAbierta}
        title={editando ? 'Editar producto' : 'Nuevo producto'}
        onClose={() => setModalAbierta(false)}
      >
        <form onSubmit={guardar}>
          {formError && (
            <div className="notice notice-warn" role="alert">
              {formError}
            </div>
          )}
          <div className="form-grid">
            <Field label="Código">
              <input
                value={form.codigo}
                onChange={(event) => setForm({ ...form, codigo: event.target.value })}
                disabled={guardando}
              />
            </Field>
            <Field label="Nombre">
              <input
                value={form.nombre}
                onChange={(event) => setForm({ ...form, nombre: event.target.value })}
                disabled={guardando}
              />
            </Field>
            <Field label="Categoría">
              <select
                value={form.categoria}
                onChange={(event) => setForm({ ...form, categoria: event.target.value })}
                disabled={guardando}
              >
                <option value="">Selecciona una categoría</option>
                {categorias.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Marca / proveedor">
              <select
                value={form.proveedorId}
                onChange={(event) => setForm({ ...form, proveedorId: event.target.value })}
                disabled={guardando}
              >
                <option value="">Sin proveedor</option>
                {proveedores.map((proveedor) => (
                  <option key={proveedor.id} value={proveedor.id}>
                    {proveedor.razonSocial}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Descuento %">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.descuentoPorcentaje}
                onChange={(event) => setForm({ ...form, descuentoPorcentaje: event.target.value })}
                disabled={guardando}
              />
            </Field>
            <Field label="Unidad de medida">
              <input
                value={form.unidadMedida}
                onChange={(event) => setForm({ ...form, unidadMedida: event.target.value })}
                disabled={guardando}
              />
            </Field>
            <Field label="Precio unitario">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.precioUnitario}
                onChange={(event) => setForm({ ...form, precioUnitario: event.target.value })}
                disabled={guardando}
              />
            </Field>
            <Field label="Stock real">
              <input
                type="number"
                min="0"
                step="1"
                value={form.stockReal}
                onChange={(event) => setForm({ ...form, stockReal: event.target.value })}
                disabled={guardando}
              />
            </Field>
            <Field label="Stock comprometido">
              <input
                type="number"
                min="0"
                step="1"
                value={form.stockComprometido}
                onChange={(event) => setForm({ ...form, stockComprometido: event.target.value })}
                disabled={guardando}
              />
            </Field>
            <Field label="Stock mínimo">
              <input
                type="number"
                min="0"
                step="1"
                value={form.stockMinimo}
                onChange={(event) => setForm({ ...form, stockMinimo: event.target.value })}
                disabled={guardando}
              />
            </Field>
            <Field label="Descripción" className="full">
              <textarea
                value={form.descripcion}
                onChange={(event) => setForm({ ...form, descripcion: event.target.value })}
                disabled={guardando}
              />
            </Field>
            <Field label="Estado" className="full">
              <span className="inline">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(event) => setForm({ ...form, activo: event.target.checked })}
                  disabled={guardando}
                />
                Producto activo
              </span>
            </Field>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
