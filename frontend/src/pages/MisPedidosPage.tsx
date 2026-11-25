import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import { tiendaApi, type PedidoPropio } from '../api/tienda';
import { Card, EmptyState, ErrorBox, EstadoBadge, fmtDate, Loading, money } from '../components/ui';

export default function MisPedidosPage() {
  const [pedidos, setPedidos] = useState<PedidoPropio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    tiendaApi
      .misPedidos()
      .then((datos) => {
        if (activo) setPedidos(datos);
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
  }, []);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Mis pedidos</h1>
          <p>Consulta el estado y los productos de tus compras.</p>
        </div>
      </div>

      {error && <ErrorBox message={error} />}
      {cargando && <Loading label="Cargando pedidos..." />}
      {!cargando && pedidos.length === 0 && <EmptyState message="Todavía no tienes pedidos." />}

      {!cargando && pedidos.map(({ pedido, items }) => (
        <Card key={pedido.id}>
          <div className="card-head">
            <div>
              <h2>{pedido.codigo}</h2>
              <small className="muted">Creado: {fmtDate(pedido.creado_en)} · Entrega estimada: {fmtDate(pedido.fecha_estimada_entrega)}</small>
            </div>
            <div className="inline">
              <EstadoBadge estado={pedido.estado} />
              <strong>{money(pedido.total)}</strong>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Cantidad</th>
                  <th className="num">Precio unitario</th>
                  <th className="num">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nombre} <small className="muted">({item.codigo})</small></td>
                    <td className="num">{item.cantidad} {item.unidad_medida}</td>
                    <td className="num">{money(item.precio_unitario)}</td>
                    <td className="num">{money(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pedido.observacion && <p className="muted" style={{ marginTop: 12 }}>Observación: {pedido.observacion}</p>}
        </Card>
      ))}
    </div>
  );
}
