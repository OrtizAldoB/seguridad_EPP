import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, apiWithMeta, errorMessage, qs } from '../api/client';
import {
  Badge,
  Card,
  EmptyState,
  ErrorBox,
  EstadoBadge,
  Field,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  fmtDate,
  fmtDateTime,
  money,
  numberFormat,
} from '../components/ui';

type Decision = 'APROBADO' | 'RECHAZADO';

interface PendienteRow {
  id: number;
  codigo: string;
  cliente: string;
  total: number;
  descuento_porcentaje: number;
  condicion_pago: string;
  fecha: string;
  tipos: string[];
}

interface Pendientes {
  cotizaciones: PendienteRow[];
  pedidos: PendienteRow[];
}

interface Auditoria {
  id: number;
  pedido_id: number | null;
  cotizacion_id: number | null;
  usuario_aprobador_id: number;
  tipo_validacion: string;
  decision: string;
  observacion: string | null;
  fecha_hora: string;
  aprobador?: string;
  pedido_codigo?: string | null;
  cotizacion_codigo?: string | null;
}

interface Paginacion {
  page: number;
  totalPages: number;
  total: number;
}

interface DestinoDecision {
  tipo: 'cotizacion' | 'pedido';
  fila: PendienteRow;
  decision: Decision;
}

const metaNumero = (meta: Record<string, unknown>, clave: string): number => {
  const valor = meta[clave];
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') return Number(valor) || 0;
  return 0;
};

const etiquetaTipo = (tipo: string): string =>
  tipo === 'VENTA_CREDITO' ? 'Venta crédito' : tipo === 'DESCUENTO_ESPECIAL' ? 'Descuento especial' : tipo;

const tonoTipo = (tipo: string): 'amber' | 'purple' | 'gray' =>
  tipo === 'VENTA_CREDITO' ? 'purple' : tipo === 'DESCUENTO_ESPECIAL' ? 'amber' : 'gray';

export default function AprobacionesPage() {
  const [pendientes, setPendientes] = useState<Pendientes>({ cotizaciones: [], pedidos: [] });
  const [cargandoPendientes, setCargandoPendientes] = useState(true);
  const [errorPendientes, setErrorPendientes] = useState('');
  const [historial, setHistorial] = useState<Auditoria[]>([]);
  const [paginacion, setPaginacion] = useState<Paginacion>({ page: 1, totalPages: 1, total: 0 });
  const [filtroDecision, setFiltroDecision] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [page, setPage] = useState(1);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [errorHistorial, setErrorHistorial] = useState('');
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState<{ tipo: 'ok' | 'warn'; mensaje: string } | null>(null);
  const [destino, setDestino] = useState<DestinoDecision | null>(null);
  const [observacion, setObservacion] = useState('');
  const [formError, setFormError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const refrescar = useCallback(() => setVersion((valor) => valor + 1), []);

  useEffect(() => {
    let activo = true;
    setCargandoPendientes(true);
    setErrorPendientes('');
    api<Pendientes>('/aprobaciones/pendientes')
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
    let activo = true;
    setCargandoHistorial(true);
    setErrorHistorial('');
    const consulta = qs({
      decision: filtroDecision,
      tipo: filtroTipo,
      page,
      limit: 10,
    });
    apiWithMeta<Auditoria[]>(`/aprobaciones/historial${consulta}`)
      .then((respuesta) => {
        if (activo) {
          setHistorial(respuesta.data);
          setPaginacion({
            page: metaNumero(respuesta.meta, 'page') || page,
            totalPages: metaNumero(respuesta.meta, 'totalPages'),
            total: metaNumero(respuesta.meta, 'total'),
          });
        }
      })
      .catch((err) => {
        if (activo) setErrorHistorial(errorMessage(err));
      })
      .finally(() => {
        if (activo) setCargandoHistorial(false);
      });
    return () => {
      activo = false;
    };
  }, [filtroDecision, filtroTipo, page, version]);

  const abrirDecision = (nuevoDestino: DestinoDecision) => {
    setNotice(null);
    setDestino(nuevoDestino);
    setObservacion('');
    setFormError('');
  };

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!destino) return;
    const texto = observacion.trim();
    if (texto.length < 3) {
      setFormError('La observación debe tener al menos 3 caracteres.');
      return;
    }
    setGuardando(true);
    setFormError('');
    try {
      const ruta = destino.tipo === 'cotizacion' ? 'cotizaciones' : 'pedidos';
      await api(`/aprobaciones/${ruta}/${destino.fila.id}`, {
        method: 'POST',
        body: { decision: destino.decision, observacion: texto },
      });
      setDestino(null);
      setNotice({
        tipo: 'ok',
        mensaje: `${destino.tipo === 'cotizacion' ? 'Cotización' : 'Pedido'} ${destino.decision.toLowerCase()} correctamente.`,
      });
      refrescar();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setGuardando(false);
    }
  };

  const renderPendientes = (filas: PendienteRow[], tipo: 'cotizacion' | 'pedido') => {
    if (filas.length === 0) {
      return <EmptyState message={`No hay ${tipo === 'cotizacion' ? 'cotizaciones' : 'pedidos'} pendientes.`} />;
    }
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Cliente</th>
              <th>Motivos</th>
              <th>Condición</th>
              <th>Fecha</th>
              <th className="right">Descuento</th>
              <th className="right">Total</th>
              <th className="right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={`${tipo}-${fila.id}`}>
                <td className="strong nowrap">{fila.codigo}</td>
                <td>{fila.cliente}</td>
                <td>
                  <span className="inline">
                    {fila.tipos.map((tipoValidacion) => (
                      <Badge key={tipoValidacion} tone={tonoTipo(tipoValidacion)}>
                        {etiquetaTipo(tipoValidacion)}
                      </Badge>
                    ))}
                  </span>
                </td>
                <td>{fila.condicion_pago}</td>
                <td className="nowrap">{fmtDate(fila.fecha)}</td>
                <td className="num">{numberFormat(fila.descuento_porcentaje)}%</td>
                <td className="num strong">{money(fila.total)}</td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-success"
                      onClick={() => abrirDecision({ tipo, fila, decision: 'APROBADO' })}
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => abrirDecision({ tipo, fila, decision: 'RECHAZADO' })}
                    >
                      Rechazar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Aprobaciones financieras"
        subtitle="Revisa cotizaciones y pedidos que requieren autorización, y consulta el historial de decisiones."
      />

      {notice && (
        <div className={`notice ${notice.tipo === 'ok' ? 'notice-ok' : 'notice-warn'}`} role="status">
          {notice.mensaje}
        </div>
      )}

      {errorPendientes && <ErrorBox message={errorPendientes} onRetry={refrescar} />}

      {cargandoPendientes && <Loading label="Cargando..." />}
      {!errorPendientes && !cargandoPendientes && (
        <div className="grid grid-2">
          <Card>
            <div className="card-head">
              <h2>Cotizaciones</h2>
              <span className="muted">{numberFormat(pendientes.cotizaciones.length)} pendientes</span>
            </div>
            {!errorPendientes && renderPendientes(pendientes.cotizaciones, 'cotizacion')}
          </Card>
          <Card>
            <div className="card-head">
              <h2>Pedidos</h2>
              <span className="muted">{numberFormat(pendientes.pedidos.length)} pendientes</span>
            </div>
            {!errorPendientes && renderPendientes(pendientes.pedidos, 'pedido')}
          </Card>
        </div>
      )}

      <Card>
        <div className="card-head">
          <h2>Historial de aprobaciones</h2>
          <span className="muted">{numberFormat(paginacion.total)} registros</span>
        </div>

        <form
          className="filters"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
          }}
        >
          <Field label="Decisión">
            <select
              value={filtroDecision}
              onChange={(event) => {
                setFiltroDecision(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas</option>
              <option value="APROBADO">Aprobado</option>
              <option value="RECHAZADO">Rechazado</option>
            </select>
          </Field>
          <Field label="Tipo de validación">
            <select
              value={filtroTipo}
              onChange={(event) => {
                setFiltroTipo(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              <option value="DESCUENTO_ESPECIAL">Descuento especial</option>
              <option value="VENTA_CREDITO">Venta crédito</option>
            </select>
          </Field>
          <button type="submit" className="btn btn-primary">
            Filtrar
          </button>
        </form>

        {errorHistorial && <ErrorBox message={errorHistorial} onRetry={refrescar} />}

        {!errorHistorial && cargandoHistorial && <Loading label="Cargando..." />}
        {!errorHistorial && !cargandoHistorial && historial.length === 0 && (
          <EmptyState message="No hay decisiones registradas con los filtros seleccionados." />
        )}

        {!errorHistorial && !cargandoHistorial && historial.length > 0 && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Registro</th>
                    <th>Tipo</th>
                    <th>Decisión</th>
                    <th>Aprobador</th>
                    <th>Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((item) => (
                    <tr key={item.id}>
                      <td className="nowrap">{fmtDateTime(item.fecha_hora)}</td>
                      <td className="strong nowrap">
                        {item.pedido_codigo ?? item.cotizacion_codigo ?? `#${item.id}`}
                      </td>
                      <td>
                        <Badge tone={tonoTipo(item.tipo_validacion)}>
                          {etiquetaTipo(item.tipo_validacion)}
                        </Badge>
                      </td>
                      <td>
                        <EstadoBadge estado={item.decision} />
                      </td>
                      <td>{item.aprobador ?? `Usuario #${item.usuario_aprobador_id}`}</td>
                      <td>{item.observacion ?? '—'}</td>
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

      <Modal
        open={destino !== null}
        title={`${destino?.decision === 'APROBADO' ? 'Aprobar' : 'Rechazar'} ${
          destino?.tipo === 'cotizacion' ? 'cotización' : 'pedido'
        }`}
        onClose={() => setDestino(null)}
      >
        {destino && (
          <form onSubmit={guardar}>
            {formError && (
              <div className="notice notice-warn" role="alert">
                {formError}
              </div>
            )}
            <div className="notice">
              <div className="item-line">
                <span>Registro</span>
                <strong>{destino.fila.codigo}</strong>
              </div>
              <div className="item-line">
                <span>Cliente</span>
                <strong>{destino.fila.cliente}</strong>
              </div>
              <div className="total-line">
                <span>Total</span>
                <span>{money(destino.fila.total)}</span>
              </div>
            </div>
            <div className="form-grid" style={{ marginTop: 18 }}>
              <Field label="Observación" className="full" hint="Mínimo 3 caracteres">
                <textarea
                  value={observacion}
                  onChange={(event) => setObservacion(event.target.value)}
                  disabled={guardando}
                  autoFocus
                />
              </Field>
            </div>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setDestino(null)} disabled={guardando}>
                Cancelar
              </button>
              <button
                type="submit"
                className={`btn ${destino.decision === 'APROBADO' ? 'btn-success' : 'btn-danger'}`}
                disabled={guardando}
              >
                {guardando ? 'Procesando...' : destino.decision === 'APROBADO' ? 'Aprobar' : 'Rechazar'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
