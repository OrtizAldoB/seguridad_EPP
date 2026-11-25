import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { tiendaApi, type Catalogo } from '../api/tienda';
import { Badge, Card, EmptyState, ErrorBox, Loading, money, StockBadge } from '../components/ui';

export default function TiendaPage() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState('');
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [cargando, setCargando] = useState(true);
  const [guardandoId, setGuardandoId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = async (busqueda = q, cat = categoria) => {
    setCargando(true);
    setError('');
    try {
      setCatalogo(await tiendaApi.catalogo(busqueda, cat));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargar('', '');
  }, []);

  const buscar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void cargar(q, categoria);
  };

  const agregar = async (productoId: number, disponible: number) => {
    const cantidad = Number(cantidades[productoId] ?? 1);
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      setAviso('La cantidad debe ser un entero positivo.');
      return;
    }
    if (cantidad > disponible) {
      setAviso(`Solo hay ${disponible} unidades disponibles.`);
      return;
    }
    setGuardandoId(productoId);
    setAviso('');
    setError('');
    try {
      await tiendaApi.agregarItem(productoId, cantidad);
      setAviso('Producto agregado al carrito.');
      await cargar(q, categoria);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGuardandoId(null);
    }
  };

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Catálogo de equipos de seguridad</h1>
          <p>Agrega EPP al carrito. El stock se reserva al confirmar tu pedido.</p>
        </div>
      </div>

      <Card>
        <form className="filters" onSubmit={buscar}>
          <FieldInput label="Buscar" value={q} onChange={setQ} placeholder="Código, nombre o categoría" />
          <label className="field">
            <span>Categoría</span>
            <select value={categoria} onChange={(event) => { setCategoria(event.target.value); void cargar(q, event.target.value); }}>
              <option value="">Todas</option>
              {(catalogo?.categorias ?? []).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary">Buscar</button>
        </form>
      </Card>

      {aviso && <div className="notice notice-ok">{aviso}</div>}
      {error && <ErrorBox message={error} onRetry={() => void cargar()} />}
      {cargando && <Loading label="Cargando catálogo..." />}

      {!cargando && catalogo && catalogo.items.length === 0 && <EmptyState message="No se encontraron productos disponibles." />}

      {!cargando && catalogo && catalogo.items.length > 0 && (
        <div className="product-grid">
          {catalogo.items.map((producto) => (
            <Card key={producto.id} className="product-card">
              <div className="product-card-head">
                <Badge tone="blue">{producto.categoria}</Badge>
                <StockBadge semaforo={producto.semaforo} />
              </div>
              <h3>{producto.nombre}</h3>
              <small className="muted">{producto.codigo} · {producto.unidadMedida}</small>
              <p className="muted product-desc">{producto.descripcion ?? 'Equipo de protección personal.'}</p>
              <strong className="product-price">{money(producto.precioUnitario)}</strong>
              <div className="muted">Disponible: {producto.stockDisponible} {producto.unidadMedida}</div>
              <div className="product-actions">
                <input
                  type="number"
                  min={1}
                  max={producto.stockDisponible}
                  value={cantidades[producto.id] ?? 1}
                  onChange={(event) =>
                    setCantidades((actual) => ({ ...actual, [producto.id]: Number(event.target.value) }))
                  }
                  aria-label={`Cantidad de ${producto.nombre}`}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={producto.stockDisponible < 1 || guardandoId === producto.id}
                  onClick={() => void agregar(producto.id, producto.stockDisponible)}
                >
                  {guardandoId === producto.id ? 'Agregando...' : 'Agregar'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}
