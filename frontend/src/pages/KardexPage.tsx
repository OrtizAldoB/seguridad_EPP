import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, apiWithMeta, errorMessage, qs } from '../api/client';
import {
  Badge,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Loading,
  PageHeader,
  Pagination,
  StatCard,
  StockBadge,
  fmtDateTime,
  money,
  numberFormat,
} from '../components/ui';

type Semaforo = 'VERDE' | 'AMARILLO' | 'ROJO';
type TipoMovimiento = 'ENTRADA_COMPRA' | 'SALIDA_VENTA' | 'AJUSTE_MANUAL';

interface ProductoDisponibilidad {
  id: number;
  codigo: string;
  nombre: string;
  categoria: string;
  unidadMedida: string;
  stockReal: number;
  stockComprometido: number;
  stockDisponible: number;
  stockMinimo: number;
  semaforo: Semaforo;
}

interface Movimiento {
  id: number;
  productoId: number;
  productoCodigo: string;
  productoNombre: string;
  tipoMovimiento: TipoMovimiento;
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
  costoUnitario: number;
  valorTotal: number;
  verificadoPor: string | null;
  verificadoEn: string | null;
  referencia: string | null;
  observacion: string | null;
  usuarioNombreCompleto: string;
  fecha: string;
}

interface ResumenKardexItem {
  productoId: number;
  codigo: string;
  nombre: string;
  entradas: number;
  salidas: number;
  saldo: number;
  valorInvertido: number;
  verificadoPor: string | null;
  verificadoEn: string | null;
}

interface FiltrosKardex {
  productoId: string;
  tipoMovimiento: string;
  fechaDesde: string;
  fechaHasta: string;
}

interface FormularioMovimiento {
  productoId: string;
  tipoMovimiento: TipoMovimiento;
  cantidad: string;
  costoUnitario: string;
  referencia: string;
  observacion: string;
}

interface Paginacion {
  page: number;
  totalPages: number;
  total: number;
}

const FILTROS_VACIOS: FiltrosKardex = {
  productoId: '',
  tipoMovimiento: '',
  fechaDesde: '',
  fechaHasta: '',
};

const FORMULARIO_VACIO: FormularioMovimiento = {
  productoId: '',
  tipoMovimiento: 'ENTRADA_COMPRA',
  cantidad: '',
  costoUnitario: '',
  referencia: '',
  observacion: '',
};

const metaNumero = (meta: Record<string, unknown>, clave: string): number => {
  const valor = meta[clave];
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') return Number(valor) || 0;
  return 0;
};

const tonoMovimiento = (tipo: TipoMovimiento): 'green' | 'blue' | 'amber' =>
  tipo === 'ENTRADA_COMPRA' ? 'green' : tipo === 'SALIDA_VENTA' ? 'blue' : 'amber';

export default function KardexPage() {
  const [pestana, setPestana] = useState<'disponibilidad' | 'movimientos' | 'resumen'>('disponibilidad');
  const [disponibilidad, setDisponibilidad] = useState<ProductoDisponibilidad[]>([]);
  const [alertas, setAlertas] = useState<ProductoDisponibilidad[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [resumen, setResumen] = useState<ResumenKardexItem[]>([]);
  const [paginacion, setPaginacion] = useState<Paginacion>({ page: 1, totalPages: 1, total: 0 });
  const [filtros, setFiltros] = useState<FiltrosKardex>(FILTROS_VACIOS);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [cargandoDisponibilidad, setCargandoDisponibilidad] = useState(true);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(true);
  const [cargandoResumen, setCargandoResumen] = useState(true);
  const [errorDisponibilidad, setErrorDisponibilidad] = useState('');
  const [errorMovimientos, setErrorMovimientos] = useState('');
  const [errorResumen, setErrorResumen] = useState('');
  const [form, setForm] = useState<FormularioMovimiento>(FORMULARIO_VACIO);
  const [formError, setFormError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [notice, setNotice] = useState<{ tipo: 'ok' | 'error'; mensaje: string } | null>(null);

  const refrescar = useCallback(() => setVersion((valor) => valor + 1), []);

  useEffect(() => {
    let activo = true;
    setCargandoDisponibilidad(true); setCargandoMovimientos(true);
    setErrorDisponibilidad('');
    Promise.all([
      api<ProductoDisponibilidad[]>('/inventario/disponibilidad'),
      api<ProductoDisponibilidad[]>('/inventario/alertas'),
    ])
      .then(([disponibilidadResp, alertasResp]) => {
        if (activo) {
          setDisponibilidad(disponibilidadResp);
          setAlertas(alertasResp);
        }
      })
      .catch((err) => {
        if (activo) setErrorDisponibilidad(errorMessage(err));
      })
      .finally(() => {
        if (activo) setCargandoDisponibilidad(false);
      });
    return () => {
      activo = false;
    };
  }, [version]);

  useEffect(() => {
    let activo = true;
    setCargandoResumen(true);
    setErrorResumen('');
    api<ResumenKardexItem[]>('/inventario/kardex/resumen')
      .then((respuesta) => {
        if (activo) setResumen(respuesta);
      })
      .catch((err) => {
        if (activo) setErrorResumen(errorMessage(err));
      })
      .finally(() => {
        if (activo) setCargandoResumen(false);
      });
    return () => {
      activo = false;
    };
  }, [version]);

  useEffect(() => {
    let activo = true;
    setCargandoDisponibilidad(true); setCargandoMovimientos(true);
    setErrorMovimientos('');
    const consulta = qs({
      producto_id: filtros.productoId ? Number(filtros.productoId) : undefined,
      tipo_movimiento: filtros.tipoMovimiento || undefined,
      fechaDesde: filtros.fechaDesde || undefined,
      fechaHasta: filtros.fechaHasta || undefined,
      page,
      limit: 10,
    });
    apiWithMeta<Movimiento[]>(`/inventario/kardex${consulta}`)
      .then((respuesta) => {
        if (activo) {
          setMovimientos(respuesta.data);
          setPaginacion({
            page: metaNumero(respuesta.meta, 'page') || page,
            totalPages: metaNumero(respuesta.meta, 'totalPages'),
            total: metaNumero(respuesta.meta, 'total'),
          });
        }
      })
      .catch((err) => {
        if (activo) setErrorMovimientos(errorMessage(err));
      })
      .finally(() => {
        if (activo) setCargandoMovimientos(false);
      });
    return () => {
      activo = false;
    };
  }, [filtros, page, version]);

  const actualizarFiltro = (campo: keyof FiltrosKardex, valor: string) => {
    setFiltros((anterior) => ({ ...anterior, [campo]: valor }));
    setPage(1);
  };

  const actualizarForm = (campo: keyof FormularioMovimiento, valor: string) => {
    setForm((anterior) => ({ ...anterior, [campo]: valor }) as FormularioMovimiento);
  };

  const registrarMovimiento = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    const producto = disponibilidad.find((item) => item.id === Number(form.productoId));
    const cantidad = Number(form.cantidad);

    if (!producto) {
      setFormError('Selecciona un producto.');
      return;
    }
    if (!Number.isInteger(cantidad)) {
      setFormError('La cantidad debe ser un número entero.');
      return;
    }
    if (form.tipoMovimiento === 'AJUSTE_MANUAL' && cantidad === 0) {
      setFormError('El ajuste manual no puede ser cero.');
      return;
    }
    if (form.tipoMovimiento !== 'AJUSTE_MANUAL' && cantidad <= 0) {
      setFormError('La cantidad debe ser mayor a cero.');
      return;
    }
    if (form.tipoMovimiento === 'SALIDA_VENTA' && cantidad > producto.stockDisponible) {
      setFormError(`Stock disponible insuficiente. Disponible: ${numberFormat(producto.stockDisponible)}.`);
      return;
    }
    const costoUnitario = Number(form.costoUnitario);
    if (form.costoUnitario && (!Number.isFinite(costoUnitario) || costoUnitario < 0)) {
      setFormError('El costo unitario debe ser un número mayor o igual a cero.');
      return;
    }

    setGuardando(true);
    setFormError('');
    try {
      await api('/inventario/movimientos', {
        method: 'POST',
        body: {
          producto_id: producto.id,
          tipo_movimiento: form.tipoMovimiento,
          cantidad,
          costo_unitario: form.costoUnitario ? costoUnitario : undefined,
          referencia: form.referencia.trim() || undefined,
          observacion: form.observacion.trim() || undefined,
        },
      });
      setNotice({ tipo: 'ok', mensaje: 'Movimiento registrado correctamente.' });
      setForm({ ...FORMULARIO_VACIO, productoId: form.productoId });
      setPage(1);
      refrescar();
    } catch (err) {
      setNotice({ tipo: 'error', mensaje: errorMessage(err) });
    } finally {
      setGuardando(false);
    }
  };

  const productoSeleccionado = disponibilidad.find((item) => item.id === Number(form.productoId));

  return (
    <>
      <PageHeader title="Kardex" subtitle="Controla la disponibilidad y los movimientos de inventario." />

      <div className="inline" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`btn ${pestana === 'disponibilidad' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setPestana('disponibilidad')}
        >
          Disponibilidad
        </button>
        <button
          type="button"
          className={`btn ${pestana === 'movimientos' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setPestana('movimientos')}
        >
          Movimientos
        </button>
        <button
          type="button"
          className={`btn ${pestana === 'resumen' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setPestana('resumen')}
        >
          Kardex por producto
        </button>
      </div>

      {notice && (
        <div className={`notice ${notice.tipo === 'ok' ? 'notice-ok' : 'notice-warn'}`} role="status">
          {notice.mensaje}
        </div>
      )}

      {pestana === 'disponibilidad' && (
        <>
          <div className="grid grid-2">
            <StatCard
              label="Productos con stock"
              value={numberFormat(disponibilidad.length)}
              hint="Catálogo activo"
            />
            <StatCard label="Alertas" value={numberFormat(alertas.length)} hint="Ámbar y rojo" tone="amber" />
          </div>

          <Card>
            <div className="card-head">
              <h2>Disponibilidad de productos</h2>
              <span className="muted">Real, comprometido y disponible</span>
            </div>

            {errorDisponibilidad && <ErrorBox message={errorDisponibilidad} onRetry={refrescar} />}

            {!errorDisponibilidad && cargandoDisponibilidad && <Loading label="Cargando..." />}
            {!errorDisponibilidad && !cargandoDisponibilidad && disponibilidad.length === 0 && (
              <EmptyState message="No hay productos activos para mostrar." />
            )}

            {!errorDisponibilidad && !cargandoDisponibilidad && disponibilidad.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Categoría</th>
                      <th className="right">Real</th>
                      <th className="right">Comprometido</th>
                      <th className="right">Disponible</th>
                      <th className="right">Mínimo</th>
                      <th>Semáforo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disponibilidad.map((producto) => (
                      <tr key={producto.id}>
                        <td>
                          <div className="strong">{producto.nombre}</div>
                          <div className="muted">
                            {producto.codigo} · {producto.unidadMedida}
                          </div>
                        </td>
                        <td>{producto.categoria}</td>
                        <td className="num">{numberFormat(producto.stockReal)}</td>
                        <td className="num">{numberFormat(producto.stockComprometido)}</td>
                        <td className="num strong">{numberFormat(producto.stockDisponible)}</td>
                        <td className="num">{numberFormat(producto.stockMinimo)}</td>
                        <td>
                          <StockBadge semaforo={producto.semaforo} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <div className="card-head">
              <h2>Alertas de stock</h2>
              <span className="muted">{numberFormat(alertas.length)} productos</span>
            </div>
            {alertas.length === 0 ? (
              <EmptyState message="No hay alertas de stock pendientes." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="right">Disponible</th>
                      <th className="right">Mínimo</th>
                      <th>Semáforo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertas.map((producto) => (
                      <tr key={producto.id}>
                        <td className="strong">
                          {producto.codigo} · {producto.nombre}
                        </td>
                        <td className="num">{numberFormat(producto.stockDisponible)}</td>
                        <td className="num">{numberFormat(producto.stockMinimo)}</td>
                        <td>
                          <StockBadge semaforo={producto.semaforo} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {pestana === 'movimientos' && (
        <div className="split">
          <Card>
            <div className="card-head">
              <h2>Registrar movimiento</h2>
            </div>
            <form onSubmit={registrarMovimiento}>
              {formError && (
                <div className="notice notice-warn" role="alert">
                  {formError}
                </div>
              )}
              <div className="form-grid">
                <Field label="Producto" className="full">
                  <select
                    value={form.productoId}
                    onChange={(event) => actualizarForm('productoId', event.target.value)}
                    disabled={guardando}
                  >
                    <option value="">Selecciona un producto</option>
                    {disponibilidad.map((producto) => (
                      <option key={producto.id} value={producto.id}>
                        {producto.codigo} · {producto.nombre}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tipo de movimiento" className="full">
                  <select
                    value={form.tipoMovimiento}
                    onChange={(event) =>
                      actualizarForm('tipoMovimiento', event.target.value as TipoMovimiento)
                    }
                    disabled={guardando}
                  >
                    <option value="ENTRADA_COMPRA">Entrada por compra</option>
                    <option value="SALIDA_VENTA">Salida por venta</option>
                    <option value="AJUSTE_MANUAL">Ajuste manual</option>
                  </select>
                </Field>
                <Field
                  label="Cantidad"
                  hint={form.tipoMovimiento === 'AJUSTE_MANUAL' ? 'Permite valores negativos.' : 'Debe ser mayor a cero.'}
                >
                  <input
                    type="number"
                    step="1"
                    value={form.cantidad}
                    onChange={(event) => actualizarForm('cantidad', event.target.value)}
                    disabled={guardando}
                  />
                </Field>
                <Field
                  label="Costo unitario"
                  hint="Opcional; se usa para calcular la inversión."
                >
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.costoUnitario}
                    onChange={(event) => actualizarForm('costoUnitario', event.target.value)}
                    disabled={guardando}
                  />
                </Field>
                <Field
                  label="Disponible"
                  hint={productoSeleccionado ? `Stock real: ${numberFormat(productoSeleccionado.stockReal)}` : undefined}
                >
                  <input
                    value={productoSeleccionado ? numberFormat(productoSeleccionado.stockDisponible) : '—'}
                    readOnly
                    disabled={guardando}
                  />
                </Field>
                <Field label="Referencia" className="full">
                  <input
                    value={form.referencia}
                    onChange={(event) => actualizarForm('referencia', event.target.value)}
                    placeholder="Ej. FAC-001, ORDEN-15"
                    disabled={guardando}
                  />
                </Field>
                <Field label="Observación" className="full">
                  <textarea
                    value={form.observacion}
                    onChange={(event) => actualizarForm('observacion', event.target.value)}
                    disabled={guardando}
                  />
                </Field>
              </div>
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={guardando || disponibilidad.length === 0}
                >
                  {guardando ? 'Registrando…' : 'Registrar movimiento'}
                </button>
              </div>
            </form>
          </Card>

          <Card>
            <div className="card-head">
              <h2>Historial de movimientos</h2>
              <span className="muted">{numberFormat(paginacion.total)} registros</span>
            </div>

            <form
              className="filters"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
              }}
            >
              <Field label="Producto" className="full">
                <select
                  value={filtros.productoId}
                  onChange={(event) => actualizarFiltro('productoId', event.target.value)}
                >
                  <option value="">Todos</option>
                  {disponibilidad.map((producto) => (
                    <option key={producto.id} value={producto.id}>
                      {producto.codigo} · {producto.nombre}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tipo">
                <select
                  value={filtros.tipoMovimiento}
                  onChange={(event) => actualizarFiltro('tipoMovimiento', event.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="ENTRADA_COMPRA">Entrada</option>
                  <option value="SALIDA_VENTA">Salida</option>
                  <option value="AJUSTE_MANUAL">Ajuste</option>
                </select>
              </Field>
              <Field label="Desde">
                <input
                  type="date"
                  value={filtros.fechaDesde}
                  onChange={(event) => actualizarFiltro('fechaDesde', event.target.value)}
                />
              </Field>
              <Field label="Hasta">
                <input
                  type="date"
                  value={filtros.fechaHasta}
                  onChange={(event) => actualizarFiltro('fechaHasta', event.target.value)}
                />
              </Field>
            </form>

            {errorMovimientos && <ErrorBox message={errorMovimientos} onRetry={refrescar} />}

            {!errorMovimientos && cargandoMovimientos && <Loading label="Cargando..." />}
            {!errorMovimientos && !cargandoMovimientos && movimientos.length === 0 && (
              <EmptyState message="No hay movimientos con los filtros seleccionados." />
            )}

            {!errorMovimientos && !cargandoMovimientos && movimientos.length > 0 && (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Producto</th>
                        <th>Tipo</th>
                        <th className="right">Cantidad</th>
                        <th className="right">Anterior</th>
                        <th className="right">Nuevo</th>
                        <th className="right">Inversión</th>
                        <th>Referencia</th>
                        <th>Observación</th>
                        <th>Usuario</th>
                        <th>Verificado por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.map((movimiento) => (
                        <tr key={movimiento.id}>
                          <td className="nowrap">{fmtDateTime(movimiento.fecha)}</td>
                          <td>
                            <div className="strong">{movimiento.productoNombre}</div>
                            <div className="muted">{movimiento.productoCodigo}</div>
                          </td>
                          <td>
                            <Badge tone={tonoMovimiento(movimiento.tipoMovimiento)}>
                              {movimiento.tipoMovimiento.replaceAll('_', ' ')}
                            </Badge>
                          </td>
                          <td className="num strong">
                            {movimiento.tipoMovimiento === 'SALIDA_VENTA' && movimiento.cantidad > 0 ? '-' : ''}
                            {numberFormat(movimiento.cantidad)}
                          </td>
                          <td className="num">{numberFormat(movimiento.stockAnterior)}</td>
                          <td className="num">{numberFormat(movimiento.stockNuevo)}</td>
                          <td className="num strong">{money(movimiento.valorTotal)}</td>
                          <td>{movimiento.referencia ?? '—'}</td>
                          <td>{movimiento.observacion ?? '—'}</td>
                          <td className="nowrap">{movimiento.usuarioNombreCompleto}</td>
                          <td className="nowrap">
                            {movimiento.verificadoPor ?? '—'}
                            {movimiento.verificadoEn ? (
                              <div className="muted">{fmtDateTime(movimiento.verificadoEn)}</div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={paginacion.page}
                  totalPages={paginacion.totalPages}
                  total={paginacion.total}
                  onChange={setPage}
                />
              </>
            )}
          </Card>
        </div>
      )}

      {pestana === 'resumen' && (
        <Card>
          <div className="card-head">
            <h2>Kardex individual por producto</h2>
            <span className="muted">Entradas, salidas, saldo e inversión</span>
          </div>

          {errorResumen && <ErrorBox message={errorResumen} onRetry={refrescar} />}
          {!errorResumen && cargandoResumen && <Loading label="Cargando..." />}
          {!errorResumen && !cargandoResumen && resumen.length === 0 && (
            <EmptyState message="No hay movimientos registrados." />
          )}
          {!errorResumen && !cargandoResumen && resumen.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="right">Entradas</th>
                    <th className="right">Salidas</th>
                    <th className="right">Saldo</th>
                    <th className="right">Inversión</th>
                    <th>Verificado por</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.map((item) => (
                    <tr key={item.productoId}>
                      <td>
                        <div className="strong">{item.nombre}</div>
                        <div className="muted">{item.codigo}</div>
                      </td>
                      <td className="num">{numberFormat(item.entradas)}</td>
                      <td className="num">{numberFormat(item.salidas)}</td>
                      <td className="num strong">{numberFormat(item.saldo)}</td>
                      <td className="num strong">{money(item.valorInvertido)}</td>
                      <td className="nowrap">
                        {item.verificadoPor ?? '—'}
                        {item.verificadoEn ? (
                          <div className="muted">{fmtDateTime(item.verificadoEn)}</div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
