import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { tiendaApi, type Carrito } from '../api/tienda';
import { Card, EmptyState, ErrorBox, Loading, money } from '../components/ui';

export default function CarritoPage() {
  const navigate = useNavigate();
  const [carrito, setCarrito] = useState<Carrito | null>(null);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [condicionPago, setCondicionPago] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [observacion, setObservacion] = useState('');
  const [diasEntrega, setDiasEntrega] = useState(3);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  const cargar = async () => {
    setCargando(true);
    setError('');
    try {
      const datos = await tiendaApi.carrito();
      setCarrito(datos);
      setCantidades(Object.fromEntries(datos.items.map((item) => [item.productoId, item.cantidad])));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const actualizar = async (productoId: number) => {
    const cantidad = Number(cantidades[productoId]);
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      setError('La cantidad debe ser un entero positivo.');
      return;
    }
    setProcesando(true);
    setError('');
    try {
      setCarrito(await tiendaApi.actualizarCantidad(productoId, cantidad));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setProcesando(false);
    }
  };

  const eliminar = async (productoId: number) => {
    setProcesando(true);
    setError('');
    try {
      setCarrito(await tiendaApi.eliminarItem(productoId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setProcesando(false);
    }
  };

  const vaciar = async () => {
    setProcesando(true);
    setError('');
    try {
      setCarrito(await tiendaApi.vaciar());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setProcesando(false);
    }
  };

  const confirmar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!carrito || carrito.items.length === 0) {
      setError('Agrega productos al carrito antes de confirmar.');
      return;
    }
    const excedido = carrito.items.find(
      (item) => Number(cantidades[item.productoId]) > item.stockDisponible,
    );
    if (excedido) {
      setError(`Stock insuficiente para ${excedido.nombre}. Disponible: ${excedido.stockDisponible}.`);
      return;
    }
    setProcesando(true);
    setError('');
    try {
      await tiendaApi.checkout({
        condicionPago,
        observacion: observacion.trim() || undefined,
        diasEntrega,
      });
      navigate('/tienda/pedidos', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setProcesando(false);
    }
  };
  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Mi carrito</h1>
          <p>Revisa cantidades y confirma tu pedido.</p>
        </div>
        {carrito && carrito.items.length > 0 && (
          <button type="button" className="btn btn-sm" onClick={() => void vaciar()} disabled={procesando}>
            Vaciar carrito
          </button>
        )}
      </div>

      {error && <ErrorBox message={error} />}
      {cargando && <Loading label="Cargando carrito..." />}
      {!cargando && carrito && carrito.items.length === 0 && (
        <EmptyState message="Tu carrito está vacío. Agrega productos desde el catálogo." />
      )}

      {!cargando && carrito && carrito.items.length > 0 && (
        <div className="split">
          <Card>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Precio</th>
                    <th>Cantidad</th>
                    <th className="num">Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {carrito.items.map((item) => (
                    <tr key={item.productoId}>
                      <td>
                        <strong>{item.nombre}</strong>
                        <div className="muted">{item.codigo} · Disponible: {item.stockDisponible}</div>
                      </td>
                      <td>{money(item.precioUnitario)}</td>
                      <td>
                        <div className="inline">
                          <input
                            type="number"
                            min={1}
                            max={item.stockDisponible}
                            value={cantidades[item.productoId] ?? item.cantidad}
                            onChange={(event) =>
                              setCantidades((actual) => ({
                                ...actual,
                                [item.productoId]: Number(event.target.value),
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => void actualizar(item.productoId)}
                            disabled={procesando}
                          >
                            Actualizar
                          </button>
                        </div>
                      </td>
                      <td className="num">{money(item.subtotal)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => void eliminar(item.productoId)}
                          disabled={procesando}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2>Confirmar pedido</h2>
            <div className="item-line"><span>Productos</span><strong>{carrito.cantidadItems}</strong></div>
            <div className="item-line"><span>Subtotal</span><strong>{money(carrito.subtotal)}</strong></div>
            <div className="item-line"><span>IVA (16%)</span><strong>{money(carrito.impuestoMonto)}</strong></div>
            <div className="total-line"><span>Total</span><span>{money(carrito.total)}</span></div>
            <form onSubmit={confirmar} className="stack" style={{ marginTop: 18 }}>
              <label className="field">
                <span>Condición de pago</span>
                <select value={condicionPago} onChange={(event) => setCondicionPago(event.target.value as 'CONTADO' | 'CREDITO')}>
                  <option value="CONTADO">Contado</option>
                  <option value="CREDITO">Crédito (requiere aprobación)</option>
                </select>
              </label>
              <label className="field">
                <span>Días para entrega</span>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={diasEntrega}
                  onChange={(event) => setDiasEntrega(Number(event.target.value))}
                />
              </label>
              <label className="field">
                <span>Observación (opcional)</span>
                <textarea
                  maxLength={500}
                  value={observacion}
                  onChange={(event) => setObservacion(event.target.value)}
                  placeholder="Indicaciones para almacén"
                />
              </label>
              <button type="submit" className="btn btn-success" disabled={procesando}>
                {procesando ? 'Procesando...' : 'Confirmar pedido'}
              </button>
            </form>
            <div className="muted" style={{ marginTop: 12 }}>
              <Link to="/tienda">Seguir comprando</Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
