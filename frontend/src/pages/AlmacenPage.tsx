import { useCallback, useEffect, useState } from 'react';
import { api, apiWithMeta, errorMessage, qs } from '../api/client';
import {
  Badge,
  Card,
  EmptyState,
  ErrorBox,
  EstadoBadge,
  Field,
  Loading,
  PageHeader,
  Pagination,
  fmtDate,
  fmtDateTime,
  money,
  numberFormat,
} from '../components/ui';

interface Notificacion {
  id: number;
  tipo?: string;
  titulo?: string;
  mensaje?: string;
  leida: number | boolean;
  creada_en?: string;
  creadaEn?: string;
  pedido_id?: number;
  pedido_codigo?: string;
}

interface PedidoPendiente {
  id: number;
  codigo: string;
  clienteId: number;
  razonSocial: string;
  nitCi: string;
  estado: string;
  total: number;
  fechaEstimadaEntrega: string;
  creadoEn: string;
}

interface PickPedido {
  id: number;
  codigo: string;
  razonSocial: string;
  nitCi: string;
  direccion?: string | null;
  estado: string;
  total: number;
  fechaEstimadaEntrega: string;
  creadoEn?: string;
  condicionPago?: string;
  descuentoPorcentaje?: number;
  observacion?: string | null;
  vendedorNombreCompleto?: string;
  despachadoPorNombreCompleto?: string;
}

interface PickItem {
  id: number;
  productoId: number;
  codigo: string;
  nombre: string;
  unidadMedida: string;
  categoria: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  orden: number;
}

interface PickList {
  pedido: PickPedido;
  items: PickItem[];
  totales: {
    items: number;
    unidades: number;
    subtotal: number;
    descuentoPorcentaje: number;
    descuentoMonto: number;
    total: number;
  };
  ordenSugerido: { posicion: number; codigo: string; nombre: string; cantidad: number }[];
}

interface MovimientoDespacho {
  id: number;
  codigo: string;
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
}

interface ResumenDespacho {
  itemsProcesados: number;
  unidadesDespachadas: number;
  notificacionesMarcadas: number;
  movimientos: MovimientoDespacho[];
}

interface ConfirmarDespachoResult {
  pedido: PickPedido;
  resumen: ResumenDespacho;
}

interface Paginacion {
  page: number;
  totalPages: number;
  total: number;
}

const metaNumero = (meta: Record<string, unknown>, clave: string): number => {
  const valor = meta[clave];
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') return Number(valor) || 0;
  return 0;
};

export default function AlmacenPage() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [paginacion, setPaginacion] = useState<Paginacion>({ page: 1, totalPages: 1, total: 0 });
  const [notiPage, setNotiPage] = useState(1);
  const [pendientes, setPendientes] = useState<PedidoPendiente[]>([]);
  const [cargandoNotificaciones, setCargandoNotificaciones] = useState(true);
  const [cargandoPendientes, setCargandoPendientes] = useState(true);
  const [errorNotificaciones, setErrorNotificaciones] = useState('');
  const [errorPendientes, setErrorPendientes] = useState('');
  const [version, setVersion] = useState(0);
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null);
  const [pick, setPick] = useState<PickList | null>(null);
  const [pickCargando, setPickCargando] = useState(false);
  const [pickError, setPickError] = useState('');
  const [pickVersion, setPickVersion] = useState(0);
  const [confirmando, setConfirmando] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [marcandoId, setMarcandoId] = useState<number | null>(null);
  const [resumen, setResumen] = useState<ResumenDespacho | null>(null);
  const [despachadoPor, setDespachadoPor] = useState('');
  const [notice, setNotice] = useState<{ tipo: 'ok' | 'warn'; mensaje: string } | null>(null);

  const refrescar = useCallback(() => setVersion((valor) => valor + 1), []);

  useEffect(() => {
    let activo = true;
    setCargandoNotificaciones(true);
    setErrorNotificaciones('');
    apiWithMeta<Notificacion[]>(`/notificaciones${qs({ leida: false, page: notiPage, limit: 10 })}`)
      .then((respuesta) => {
        if (activo) {
          setNotificaciones(respuesta.data);
          setPaginacion({
            page: metaNumero(respuesta.meta, 'page') || notiPage,
            totalPages: metaNumero(respuesta.meta, 'totalPages'),
            total: metaNumero(respuesta.meta, 'total'),
          });
        }
      })
      .catch((err) => {
        if (activo) setErrorNotificaciones(errorMessage(err));
      })
      .finally(() => {
        if (activo) setCargandoNotificaciones(false);
      });
    return () => {
      activo = false;
    };
  }, [version, notiPage]);

  useEffect(() => {
    let activo = true;
    setCargandoPendientes(true);
    setErrorPendientes('');
    api<PedidoPendiente[]>('/despacho/pendientes')
      .then((respuesta) => {
        if (activo) setPendientes(respuesta);
      })
      .catch((err) => {
        if (activo) setErrorPendientes(errorMessage(err));
      })
      .finally(() => {
        if (activo) setCargandoPendientes(false);
      });
    return () => {
      activo = false;
    };
  }, [version]);

  useEffect(() => {
    if (seleccionadoId === null) {
      setPick(null);
      return;
    }
    let activo = true;
    setPickCargando(true);
    setPickError('');
    setPick(null);
    api<PickList>(`/despacho/pick-list/${seleccionadoId}`)
      .then((respuesta) => {
        if (activo) setPick(respuesta);
      })
      .catch((err) => {
        if (activo) setPickError(errorMessage(err));
      })
      .finally(() => {
        if (activo) setPickCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [seleccionadoId, pickVersion]);

  const marcarTodas = async () => {
    setMarcando(true);
    setNotice(null);
    try {
      await api('/notificaciones/leer-todas', { method: 'PATCH' });
      setNotice({ tipo: 'ok', mensaje: 'Notificaciones marcadas como leídas.' });
      refrescar();
    } catch (err) {
      setNotice({ tipo: 'warn', mensaje: errorMessage(err) });
    } finally {
      setMarcando(false);
    }
  };

  const marcarUna = async (id: number) => {
    setMarcandoId(id);
    setNotice(null);
    try {
      await api(`/notificaciones/${id}/leida`, { method: 'PATCH' });
      setNotice({ tipo: 'ok', mensaje: 'Notificación marcada como leída.' });
      refrescar();
    } catch (err) {
      setNotice({ tipo: 'warn', mensaje: errorMessage(err) });
    } finally {
      setMarcandoId(null);
    }
  };

  const confirmarDespacho = async () => {
    if (!pick) return;
    if (!window.confirm(`¿Confirmar el despacho del pedido ${pick!.pedido.codigo}?`)) return;
    setConfirmando(true);
    setNotice(null);
    try {
      const respuesta = await api<ConfirmarDespachoResult>(`/despacho/confirmar/${pick!.pedido.id}`, { method: 'POST' });
      setResumen(respuesta.resumen);
      setDespachadoPor(respuesta.pedido.despachadoPorNombreCompleto ?? '');
      setSeleccionadoId(null);
      setNotice({
        tipo: 'ok',
        mensaje: `Despacho confirmado: ${numberFormat(respuesta.resumen.itemsProcesados)} items y ${numberFormat(
          respuesta.resumen.unidadesDespachadas,
        )} unidades.`,
      });
      refrescar();
    } catch (err) {
      setNotice({ tipo: 'warn', mensaje: errorMessage(err) });
    } finally {
      setConfirmando(false);
    }
  };

  const ordenPorCodigo = new Map(pick?.ordenSugerido.map((item) => [item.codigo, item.posicion]) ?? []);

  return (
    <>
      <PageHeader
        title="Almacén y despachos"
        subtitle="Revisa notificaciones, prepara pedidos y confirma despachos con su pick list."
      />

      {notice && (
        <div className={`notice ${notice.tipo === 'ok' ? 'notice-ok' : 'notice-warn'}`} role="status">
          {notice.mensaje}
        </div>
      )}

      {resumen && (
        <Card>
          <div className="notice notice-ok">
            <div className="item-line">
              <span>Items procesados</span>
              <strong>{numberFormat(resumen.itemsProcesados)}</strong>
            </div>
            <div className="item-line">
              <span>Unidades despachadas</span>
              <strong>{numberFormat(resumen.unidadesDespachadas)}</strong>
            </div>
            <div className="item-line">
              <span>Notificaciones marcadas</span>
              <strong>{numberFormat(resumen.notificacionesMarcadas)}</strong>
            </div>
            <div className="item-line">
              <span>Movimientos de inventario</span>
              <strong>{numberFormat(resumen.movimientos.length)}</strong>
            </div>
            <div className="item-line">
              <span>Confirmado por</span>
              <strong>{despachadoPor || '—'}</strong>
            </div>
          </div>
          {resumen.movimientos.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="right">Cantidad</th>
                    <th className="right">Stock anterior</th>
                    <th className="right">Stock nuevo</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.movimientos.map((movimiento) => (
                    <tr key={movimiento.id}>
                      <td className="strong">{movimiento.codigo}</td>
                      <td className="num">{numberFormat(movimiento.cantidad)}</td>
                      <td className="num">{numberFormat(movimiento.stockAnterior)}</td>
                      <td className="num">{numberFormat(movimiento.stockNuevo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <div className="split">
        <Card>
          <div className="card-head">
            <h2>Pedidos pendientes de despacho</h2>
            <span className="muted">{numberFormat(pendientes.length)} pedidos</span>
          </div>

          {errorPendientes && <ErrorBox message={errorPendientes} onRetry={refrescar} />}

          {!errorPendientes && cargandoPendientes && <Loading label="Cargando..." />}
          {!errorPendientes && !cargandoPendientes && pendientes.length === 0 && (
            <EmptyState message="No hay pedidos pendientes de despacho." />
          )}

          {!errorPendientes && !cargandoPendientes && pendientes.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cliente</th>
                    <th>Estado</th>
                    <th>Entrega estimada</th>
                    <th className="right">Total</th>
                    <th className="right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((pedido) => (
                    <tr key={pedido.id}>
                      <td className="strong nowrap">{pedido.codigo}</td>
                      <td>
                        <div className="strong">{pedido.razonSocial}</div>
                        <div className="muted">{pedido.nitCi}</div>
                      </td>
                      <td>
                        <EstadoBadge estado={pedido.estado} />
                      </td>
                      <td className="nowrap">{fmtDate(pedido.fechaEstimadaEntrega)}</td>
                      <td className="num strong">{money(pedido.total)}</td>
                      <td>
                        <button
                          type="button"
                          className={`btn btn-sm ${seleccionadoId === pedido.id ? 'btn-primary' : ''}`}
                          onClick={() => {
                            setResumen(null);
                            setNotice(null);
                            setSeleccionadoId(pedido.id);
                          }}
                        >
                          Ver pick list
                        </button>
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
            <h2>Notificaciones recientes</h2>
            <button type="button" className="btn btn-sm btn-success" onClick={() => void marcarTodas()} disabled={marcando}>
              {marcando ? 'Procesando...' : 'Marcar todas'}
            </button>
          </div>

          {errorNotificaciones && <ErrorBox message={errorNotificaciones} onRetry={refrescar} />}

          {!errorNotificaciones && cargandoNotificaciones && <Loading label="Cargando..." />}
          {!errorNotificaciones && !cargandoNotificaciones && notificaciones.length === 0 && (
            <EmptyState message="No hay notificaciones sin leer." />
          )}

          {!errorNotificaciones && !cargandoNotificaciones && notificaciones.length > 0 && (
            <>
              <div className="stack">
                {notificaciones.map((notificacion) => (
                  <div className="item-line" key={notificacion.id}>
                    <div>
                      <div className="strong">{notificacion.titulo ?? 'Notificación de pedido'}</div>
                      <div className="muted">
                        {notificacion.tipo ? `${notificacion.tipo} · ` : ''}
                        {notificacion.mensaje ?? ''}
                      </div>
                      <div className="muted">
                        {fmtDateTime(notificacion.creada_en ?? notificacion.creadaEn)}
                        {notificacion.pedido_codigo ? ` · ${notificacion.pedido_codigo}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => void marcarUna(notificacion.id)}
                      disabled={marcandoId === notificacion.id}
                    >
                      {marcandoId === notificacion.id ? 'Procesando...' : 'Marcar leída'}
                    </button>
                  </div>
                ))}
              </div>
              <Pagination
                page={paginacion.page}
                totalPages={paginacion.totalPages}
                total={paginacion.total}
                onChange={setNotiPage}
              />
            </>
          )}
        </Card>
      </div>

      {seleccionadoId !== null && (
        <Card>
          <div className="card-head">
            <h2>Pick list</h2>
            <div className="no-print inline">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => window.print()}
                disabled={!pick || confirmando}
              >
                Imprimir pick list
              </button>
              <button
                type="button"
                className="btn btn-sm btn-success"
                onClick={() => void confirmarDespacho()}
                disabled={!pick || confirmando}
              >
                {confirmando ? 'Confirmando…' : 'Confirmar despacho'}
              </button>
            </div>
          </div>

          {pickCargando && <Loading label="Cargando pick list..." />}
          {!pickCargando && pickError && (
            <ErrorBox message={pickError} onRetry={() => setPickVersion((valor) => valor + 1)} />
          )}
          {!pickCargando && !pickError && !pick && <EmptyState message="Selecciona un pedido pendiente." />}
          {!pickCargando && !pickError && pick && (
            <div className="stack">
              <div className="form-grid">
                <Field label="Pedido">
                  <input value={pick!.pedido.codigo} readOnly />
                </Field>
                <Field label="Estado">
                  <input value={pick!.pedido.estado.replaceAll('_', ' ')} readOnly />
                </Field>
                <Field label="Cliente">
                  <input value={pick!.pedido.razonSocial} readOnly />
                </Field>
                <Field label="NIT / CI">
                  <input value={pick!.pedido.nitCi} readOnly />
                </Field>
                <Field label="Dirección">
                  <input value={pick!.pedido.direccion ?? '—'} readOnly />
                </Field>
                <Field label="Entrega estimada">
                  <input value={fmtDate(pick!.pedido.fechaEstimadaEntrega)} readOnly />
                </Field>
                <Field label="Condición de pago">
                  <input value={pick!.pedido.condicionPago ?? '—'} readOnly />
                </Field>
                <Field label="Vendedor">
                  <input value={pick!.pedido.vendedorNombreCompleto ?? '—'} readOnly />
                </Field>
                {pick!.pedido.observacion && (
                  <Field label="Observación" className="full">
                    <textarea value={pick!.pedido.observacion} readOnly />
                  </Field>
                )}
              </div>

              {pick!.items.length === 0 ? (
                <EmptyState message="El pedido no tiene items para preparar." />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th className="right">Orden</th>
                        <th>Código</th>
                        <th>Producto</th>
                        <th>Categoría</th>
                        <th className="right">Cantidad</th>
                        <th>Unidad</th>
                        <th className="right">Precio unitario</th>
                        <th className="right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pick!.items.map((item) => (
                        <tr key={item.id}>
                          <td className="num strong">{ordenPorCodigo.get(item.codigo) ?? item.orden}</td>
                          <td className="nowrap">{item.codigo}</td>
                          <td className="strong">{item.nombre}</td>
                          <td>{item.categoria}</td>
                          <td className="num">{numberFormat(item.cantidad)}</td>
                          <td>{item.unidadMedida}</td>
                          <td className="num">{money(item.precioUnitario)}</td>
                          <td className="num strong">{money(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {pick!.ordenSugerido.length > 0 && (
                <Card>
                  <div className="card-head">
                    <h2>Orden sugerido de preparación</h2>
                    <Badge tone="blue">{numberFormat(pick!.ordenSugerido.length)} posiciones</Badge>
                  </div>
                  <div className="stack">
                    {pick!.ordenSugerido.map((item) => (
                      <div className="item-line" key={item.posicion}>
                        <span>
                          <strong>{item.posicion}.</strong> {item.nombre} · {item.codigo}
                        </span>
                        <strong>{numberFormat(item.cantidad)}</strong>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <div className="notice">
                <div className="item-line">
                  <span>Items</span>
                  <strong>{numberFormat(pick!.totales.items)}</strong>
                </div>
                <div className="item-line">
                  <span>Unidades</span>
                  <strong>{numberFormat(pick!.totales.unidades)}</strong>
                </div>
                <div className="item-line">
                  <span>Subtotal</span>
                  <strong>{money(pick!.totales.subtotal)}</strong>
                </div>
                <div className="item-line">
                  <span>Descuento ({numberFormat(pick!.totales.descuentoPorcentaje)}%)</span>
                  <strong>-{money(pick!.totales.descuentoMonto)}</strong>
                </div>
                <div className="total-line">
                  <span>Total</span>
                  <span>{money(pick!.totales.total)}</span>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
