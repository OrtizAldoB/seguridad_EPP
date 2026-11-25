import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, qs } from '../api/client';
import {
  Badge,
  BarList,
  Card,
  EmptyState,
  ErrorBox,
  Loading,
  PageHeader,
  StatCard,
  fmtDate,
  money,
  numberFormat,
  type Tone,
} from '../components/ui';

type Periodo = 'diario' | 'semanal' | 'mensual';

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

interface DatosDashboard {
  resumen: Resumen;
  productos: TopProducto[];
  clientes: TopCliente[];
}

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mensual');
  const [datos, setDatos] = useState<DatosDashboard | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  const reintentar = useCallback(() => setIntento((valor) => valor + 1), []);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError('');
    Promise.all([
      api<Resumen>(`/reportes/resumen${qs({ periodo })}`),
      api<TopProducto[]>(`/reportes/top-productos${qs({ periodo, limit: 5 })}`),
      api<TopCliente[]>(`/reportes/top-clientes${qs({ periodo, limit: 5 })}`),
    ])
      .then(([resumen, productos, clientes]) => {
        if (activo) setDatos({ resumen, productos, clientes });
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
  }, [periodo, intento]);

  const tonoAlertas: Tone = datos && datos.resumen.alertasStock > 0 ? 'red' : 'green';

  return (
    <>
      <PageHeader
        title="Panel general"
        subtitle="Resumen comercial, de clientes e inventario."
        action={
          <div className="inline">
            <label className="strong" htmlFor="periodo-panel">
              Periodo
            </label>
            <select
              id="periodo-panel"
              value={periodo}
              onChange={(event) => setPeriodo(event.target.value as Periodo)}
              style={{ width: 150 }}
            >
              <option value="diario">Diario</option>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
        }
      />

      {cargando && <Loading label="Cargando..." />}
      {!cargando && error && <ErrorBox message={error} onRetry={reintentar} />}

      {!cargando && !error && datos && (
        <div className="stack">
          <div className="notice">
            Rango consultado: del {fmtDate(datos.resumen.rango.desde)} al {fmtDate(datos.resumen.rango.hasta)} · Periodo{' '}
            {periodo}
          </div>

          <div className="grid grid-3">
            <StatCard
              label="Total vendido"
              value={money(datos.resumen.totalVendido)}
              hint="Ventas del periodo"
              tone="green"
            />
            <StatCard
              label="Cantidad de pedidos"
              value={numberFormat(datos.resumen.cantidadPedidos)}
              hint="Pedidos registrados"
              tone="blue"
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
              tone={tonoAlertas}
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
              <h2>Ventas por periodo</h2>
              <Badge tone="blue">Montos vendidos</Badge>
            </div>
            <BarList items={datos.resumen.serie.map((punto) => ({ label: punto.etiqueta, value: punto.monto }))} />
          </Card>

          <div className="split">
            <Card>
              <div className="card-head">
                <h2>Productos más vendidos</h2>
                <Badge tone="green">Top 5</Badge>
              </div>
              {datos.productos.length === 0 ? (
                <EmptyState message="No hay productos vendidos en el periodo." />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Producto</th>
                        <th>Categoría</th>
                        <th className="num">Cantidad</th>
                        <th className="num">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.productos.map((producto, indice) => (
                        <tr key={producto.productoId}>
                          <td className="strong">{indice + 1}</td>
                          <td>
                            <div className="strong">{producto.nombre}</div>
                            <small className="muted">
                              {producto.codigo} · {producto.unidadMedida}
                            </small>
                          </td>
                          <td>{producto.categoria}</td>
                          <td className="num">{numberFormat(producto.cantidadVendida)}</td>
                          <td className="num strong">{money(producto.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <div className="card-head">
                <h2>Clientes principales</h2>
                <Badge tone="purple">Top 5</Badge>
              </div>
              {datos.clientes.length === 0 ? (
                <EmptyState message="No hay clientes con compras en el periodo." />
              ) : (
                <div className="stack">
                  {datos.clientes.map((cliente, indice) => (
                    <div className="item-line" key={cliente.clienteId}>
                      <div>
                        <div className="strong">
                          {indice + 1}. {cliente.razonSocial}
                        </div>
                        <small className="muted">
                          {cliente.nitCi} · {numberFormat(cliente.cantidadPedidos)} pedidos
                        </small>
                      </div>
                      <span className="strong">{money(cliente.montoTotal)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
