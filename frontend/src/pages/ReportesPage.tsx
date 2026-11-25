import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, downloadFile, errorMessage, qs } from '../api/client';
import {
  Card,
  EmptyState,
  ErrorBox,
  EstadoBadge,
  Field,
  Loading,
  PageHeader,
  StatCard,
  fmtDate,
  fmtDateTime,
  money,
  numberFormat,
} from '../components/ui';

type Periodo = 'diario' | 'semanal' | 'mensual' | 'personalizado';
type Tab = 'ventas' | 'cotizaciones' | 'kardex' | 'top-productos' | 'top-clientes';
type TipoExportacion = 'ventas' | 'cotizaciones' | 'kardex';

interface Resumen {
  periodo: string;
  rango: { desde: string; hasta: string };
  totalVendido: number;
  cantidadPedidos: number;
  totalCotizaciones: number;
  totalClientesActivos: number;
  alertasStock: number;
  ticketPromedio: number;
  serie: { etiqueta: string; cantidad: number; monto: number }[];
}

interface VentaItem {
  pedidoId: number;
  pedidoCodigo: string;
  clienteRazonSocial: string;
  clienteNitCi: string;
  vendedorNombreCompleto: string;
  estado: string;
  pedidoTotal: number;
  creadoEn: string;
  productoNombre: string | null;
  cantidad: number | null;
  precioUnitario: number | null;
  subtotal: number | null;
}

interface CotizacionItem {
  id: number;
  codigo: string;
  clienteRazonSocial: string;
  clienteNitCi: string;
  vendedorNombreCompleto: string;
  total: number;
  estado: string;
  fechaEmision: string;
  fechaVencimiento: string;
}

interface KardexItem {
  id: number;
  productoCodigo: string;
  productoNombre: string;
  tipoMovimiento: string;
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
  usuarioNombreCompleto: string;
  referencia: string | null;
  fecha: string;
}

interface TopProducto {
  productoId: number;
  codigo: string;
  nombre: string;
  categoria: string;
  unidadMedida: string;
  cantidadVendida: number;
  monto: number;
}

interface TopCliente {
  clienteId: number;
  razonSocial: string;
  nitCi: string;
  cantidadPedidos: number;
  montoTotal: number;
}

interface DatosReportes {
  resumen: Resumen;
  ventas: VentaItem[];
  cotizaciones: CotizacionItem[];
  kardex: KardexItem[];
  topProductos: TopProducto[];
  topClientes: TopCliente[];
}

const TABS: { clave: Tab; etiqueta: string }[] = [
  { clave: 'ventas', etiqueta: 'Ventas' },
  { clave: 'cotizaciones', etiqueta: 'Cotizaciones' },
  { clave: 'kardex', etiqueta: 'Kardex' },
  { clave: 'top-productos', etiqueta: 'Top productos' },
  { clave: 'top-clientes', etiqueta: 'Top clientes' },
];

export default function ReportesPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mensual');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [tab, setTab] = useState<Tab>('ventas');
  const [datos, setDatos] = useState<DatosReportes | null>(null);
  const [version, setVersion] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [descargando, setDescargando] = useState<'xlsx' | 'pdf' | null>(null);
  const [errorDescarga, setErrorDescarga] = useState('');

  const refrescar = useCallback(() => setVersion((valor) => valor + 1), []);

  const rangoIncompleto = periodo === 'personalizado' && (!desde || !hasta || desde > hasta);
  const consulta = {
    periodo,
    desde: periodo === 'personalizado' ? desde : undefined,
    hasta: periodo === 'personalizado' ? hasta : undefined,
  };
  const consultaUrl = qs(consulta);
  const consultaTop = qs({ ...consulta, limit: 10 });
  const tipoExportacion: TipoExportacion =
    tab === 'cotizaciones' ? 'cotizaciones' : tab === 'kardex' ? 'kardex' : 'ventas';

  useEffect(() => {
    if (rangoIncompleto) {
      setDatos(null);
      setCargando(true);
      setError('');
      return;
    }
    let activo = true;
    setCargando(true);
    setError('');
    Promise.all([
      api<Resumen>(`/reportes/resumen${consultaUrl}`),
      api<VentaItem[]>(`/reportes/ventas${consultaUrl}`),
      api<CotizacionItem[]>(`/reportes/cotizaciones${consultaUrl}`),
      api<KardexItem[]>(`/reportes/kardex${consultaUrl}`),
      api<TopProducto[]>(`/reportes/top-productos${consultaTop}`),
      api<TopCliente[]>(`/reportes/top-clientes${consultaTop}`),
    ])
      .then(([resumen, ventas, cotizaciones, kardex, topProductos, topClientes]) => {
        if (activo) setDatos({ resumen, ventas, cotizaciones, kardex, topProductos, topClientes });
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
  }, [consultaUrl, consultaTop, rangoIncompleto, version]);

  const descargar = async (formato: 'xlsx' | 'pdf') => {
    setDescargando(formato);
    setErrorDescarga('');
    try {
      await downloadFile(
        `/reportes/exportar.${formato}${qs({ ...consulta, tipo: tipoExportacion })}`,
        `reporte-${tipoExportacion}.${formato}`,
      );
    } catch (err) {
      setErrorDescarga(errorMessage(err));
    } finally {
      setDescargando(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Reportes"
        subtitle="Consulta indicadores, detalle comercial y movimientos de inventario."
        action={
          <div className="inline">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void descargar('xlsx')}
              disabled={rangoIncompleto || descargando !== null}
            >
              {descargando === 'xlsx' ? 'Generando…' : 'Descargar XLSX'}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void descargar('pdf')}
              disabled={rangoIncompleto || descargando !== null}
            >
              {descargando === 'pdf' ? 'Generando…' : 'Descargar PDF'}
            </button>
          </div>
        }
      />

      <Card>
        <form
          className="filters"
          onSubmit={(event) => {
            event.preventDefault();
            refrescar();
          }}
        >
          <Field label="Periodo">
            <select
              value={periodo}
              onChange={(event) => setPeriodo(event.target.value as Periodo)}
              disabled={cargando}
            >
              <option value="diario">Diario</option>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </Field>
          {periodo === 'personalizado' && (
            <>
              <Field label="Desde">
                <input type="date" value={desde} onChange={(event) => setDesde(event.target.value)} disabled={cargando} />
              </Field>
              <Field label="Hasta">
                <input type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} disabled={cargando} />
              </Field>
            </>
          )}
          <button type="submit" className="btn btn-primary" disabled={rangoIncompleto || cargando}>
            Aplicar
          </button>
        </form>
        {rangoIncompleto && (
          <div className="notice notice-warn">
            Para el periodo personalizado selecciona desde y hasta, con desde menor o igual que hasta.
          </div>
        )}
        {errorDescarga && (
          <div className="notice notice-warn" role="alert">
            {errorDescarga}
          </div>
        )}
      </Card>

      {!rangoIncompleto && cargando && <Loading label="Cargando..." />}

      {!rangoIncompleto && !cargando && error && <ErrorBox message={error} onRetry={refrescar} />}

      {!rangoIncompleto && !cargando && !error && datos && (
        <div className="stack">
          <div className="notice">
            Rango consultado: del {fmtDate(datos.resumen.rango.desde)} al {fmtDate(datos.resumen.rango.hasta)} · Periodo{' '}
            {datos.resumen.periodo}
          </div>

          <div className="grid grid-3">
            <StatCard label="Total vendido" value={money(datos.resumen.totalVendido)} hint="Ventas del periodo" tone="green" />
            <StatCard
              label="Cantidad de pedidos"
              value={numberFormat(datos.resumen.cantidadPedidos)}
              hint="Pedidos registrados"
            />
            <StatCard
              label="Total cotizaciones"
              value={numberFormat(datos.resumen.totalCotizaciones)}
              hint="Cotizaciones emitidas"
              tone="purple"
            />
            <StatCard
              label="Ticket promedio"
              value={money(datos.resumen.ticketPromedio)}
              hint="Promedio por pedido"
              tone="blue"
            />
            <StatCard
              label="Alertas de stock"
              value={numberFormat(datos.resumen.alertasStock)}
              hint={datos.resumen.alertasStock > 0 ? 'Requieren revisión' : 'Sin alertas activas'}
              tone={datos.resumen.alertasStock > 0 ? 'red' : 'green'}
            />
            <StatCard
              label="Clientes activos"
              value={numberFormat(datos.resumen.totalClientesActivos)}
              hint="Clientes con actividad"
              tone="green"
            />
          </div>

          <Card>
            <div className="card-head">
              <h2>Serie del periodo</h2>
              <span className="muted">{numberFormat(datos.resumen.serie.length)} puntos</span>
            </div>
            {datos.resumen.serie.length === 0 ? (
              <EmptyState message="No hay datos para la serie del periodo." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Etiqueta</th>
                      <th className="right">Cantidad</th>
                      <th className="right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.resumen.serie.map((punto, indice) => (
                      <tr key={`${punto.etiqueta}-${indice}`}>
                        <td className="strong">{punto.etiqueta}</td>
                        <td className="num">{numberFormat(punto.cantidad)}</td>
                        <td className="num strong">{money(punto.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <div className="card-head">
              <h2>Detalle de reportes</h2>
              <div className="inline">
                {TABS.map((opcion) => (
                  <button
                    key={opcion.clave}
                    type="button"
                    className={`btn btn-sm ${tab === opcion.clave ? 'btn-primary' : ''}`}
                    onClick={() => setTab(opcion.clave)}
                  >
                    {opcion.etiqueta}
                  </button>
                ))}
              </div>
            </div>

            {tab === 'ventas' &&
              (datos.ventas.length === 0 ? (
                <EmptyState message="No hay ventas en el periodo seleccionado." />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Pedido</th>
                        <th>Cliente</th>
                        <th>Vendedor</th>
                        <th>Producto</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                        <th className="right">Cantidad</th>
                        <th className="right">Subtotal</th>
                        <th className="right">Total pedido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.ventas.map((venta, indice) => (
                        <tr key={`${venta.pedidoId}-${indice}`}>
                          <td className="strong nowrap">{venta.pedidoCodigo}</td>
                          <td>
                            <div className="strong">{venta.clienteRazonSocial}</div>
                            <div className="muted">{venta.clienteNitCi}</div>
                          </td>
                          <td>{venta.vendedorNombreCompleto}</td>
                          <td>{venta.productoNombre ?? '—'}</td>
                          <td>
                            <EstadoBadge estado={venta.estado} />
                          </td>
                          <td className="nowrap">{fmtDateTime(venta.creadoEn)}</td>
                          <td className="num">{numberFormat(venta.cantidad)}</td>
                          <td className="num">{money(venta.subtotal)}</td>
                          <td className="num strong">{money(venta.pedidoTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

            {tab === 'cotizaciones' &&
              (datos.cotizaciones.length === 0 ? (
                <EmptyState message="No hay cotizaciones en el periodo seleccionado." />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Cotización</th>
                        <th>Cliente</th>
                        <th>Vendedor</th>
                        <th>Estado</th>
                        <th>Emisión</th>
                        <th>Vencimiento</th>
                        <th className="right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.cotizaciones.map((cotizacion) => (
                        <tr key={cotizacion.id}>
                          <td className="strong nowrap">{cotizacion.codigo}</td>
                          <td>{cotizacion.clienteRazonSocial}</td>
                          <td>{cotizacion.vendedorNombreCompleto}</td>
                          <td>
                            <EstadoBadge estado={cotizacion.estado} />
                          </td>
                          <td className="nowrap">{fmtDate(cotizacion.fechaEmision)}</td>
                          <td className="nowrap">{fmtDate(cotizacion.fechaVencimiento)}</td>
                          <td className="num strong">{money(cotizacion.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

            {tab === 'kardex' &&
              (datos.kardex.length === 0 ? (
                <EmptyState message="No hay movimientos de inventario en el periodo seleccionado." />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Tipo</th>
                        <th>Usuario</th>
                        <th>Referencia</th>
                        <th>Fecha</th>
                        <th className="right">Cantidad</th>
                        <th className="right">Stock anterior</th>
                        <th className="right">Stock nuevo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.kardex.map((movimiento) => (
                        <tr key={movimiento.id}>
                          <td>
                            <div className="strong">{movimiento.productoNombre}</div>
                            <div className="muted">{movimiento.productoCodigo}</div>
                          </td>
                          <td>{movimiento.tipoMovimiento}</td>
                          <td>{movimiento.usuarioNombreCompleto}</td>
                          <td>{movimiento.referencia ?? '—'}</td>
                          <td className="nowrap">{fmtDateTime(movimiento.fecha)}</td>
                          <td className="num">{numberFormat(movimiento.cantidad)}</td>
                          <td className="num">{numberFormat(movimiento.stockAnterior)}</td>
                          <td className="num">{numberFormat(movimiento.stockNuevo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

            {tab === 'top-productos' &&
              (datos.topProductos.length === 0 ? (
                <EmptyState message="No hay productos vendidos en el periodo seleccionado." />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th className="right">#</th>
                        <th>Producto</th>
                        <th>Categoría</th>
                        <th className="right">Cantidad</th>
                        <th className="right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.topProductos.map((producto, indice) => (
                        <tr key={producto.productoId}>
                          <td className="num strong">{indice + 1}</td>
                          <td>
                            <div className="strong">{producto.nombre}</div>
                            <div className="muted">
                              {producto.codigo} · {producto.unidadMedida}
                            </div>
                          </td>
                          <td>{producto.categoria}</td>
                          <td className="num">{numberFormat(producto.cantidadVendida)}</td>
                          <td className="num strong">{money(producto.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

            {tab === 'top-clientes' &&
              (datos.topClientes.length === 0 ? (
                <EmptyState message="No hay clientes con compras en el periodo seleccionado." />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th className="right">#</th>
                        <th>Cliente</th>
                        <th>NIT / CI</th>
                        <th className="right">Pedidos</th>
                        <th className="right">Monto total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.topClientes.map((cliente, indice) => (
                        <tr key={cliente.clienteId}>
                          <td className="num strong">{indice + 1}</td>
                          <td className="strong">{cliente.razonSocial}</td>
                          <td>{cliente.nitCi}</td>
                          <td className="num">{numberFormat(cliente.cantidadPedidos)}</td>
                          <td className="num strong">{money(cliente.montoTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

            {(tab === 'top-productos' || tab === 'top-clientes') && (
              <div className="notice" style={{ marginTop: 14 }}>
                La exportación de estas pestañas se genera con el reporte de ventas correspondiente.
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
