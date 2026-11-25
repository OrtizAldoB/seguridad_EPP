import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, apiWithMeta, errorMessage, qs } from '../api/client';
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
  fmtDate,
} from '../components/ui';

interface Proveedor {
  id: number;
  razonSocial: string;
}
interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  stockReal: number;
}
interface OfertaProveedor {
  productoId: number;
  precioUnitario: number;
  minimoCompra: number;
}
interface SolicitudItem {
  id: number;
  productoCodigo: string;
  productoNombre: string;
  cantidad: number;
}
interface Solicitud {
  id: number;
  codigo: string;
  proveedorRazonSocial: string;
  proveedorNitCi: string;
  usuarioNombreCompleto: string;
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  observacion: string | null;
  motivoRechazo: string | null;
  compraCodigo: string | null;
  aprobadoPorNombreCompleto: string | null;
  aprobadoEn: string | null;
  creadoEn: string;
  items: SolicitudItem[];
}
interface ItemForm {
  productoId: string;
  cantidad: string;
  minimoCompra?: number;
}

export default function SolicitudesPage() {
  const { hasPermiso } = useAuth();
  const [items, setItems] = useState<Solicitud[]>([]);
  const [meta, setMeta] = useState<any>({});
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [todosLosProductos, setTodosLosProductos] = useState<Producto[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ofertas, setOfertas] = useState<OfertaProveedor[]>([]);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Solicitud | null>(null);
  const [form, setForm] = useState({ proveedorId: '', observacion: '', items: [{ productoId: '', cantidad: '1' } as ItemForm] });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await apiWithMeta<Solicitud[]>(`/solicitudes-compra${qs({ q, estado, page, limit: 20 })}`);
      setItems(Array.isArray(r.data) ? r.data : ((r.data as any).items ?? []));
      setMeta(r.meta);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [q, estado, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const [proveedoresResp, productosResp] = await Promise.all([
          apiWithMeta<{ items: Proveedor[] }>('/proveedores?estado=ACTIVO&limit=100'),
          apiWithMeta<{ items: Producto[] }>('/productos?activo=true&limit=100'),
        ]);
        setProveedores(proveedoresResp.data.items ?? []);
        setTodosLosProductos(productosResp.data.items ?? []);
        setProductos(productosResp.data.items ?? []);
      } catch {
        setProveedores([]);
        setTodosLosProductos([]);
        setProductos([]);
      }
    })();
  }, []);

  const cambiarProveedor = async (proveedorId: string) => {
    setForm((anterior) => ({ ...anterior, proveedorId, items: [{ productoId: '', cantidad: '1' }] }));
    setOfertas([]);
    if (!proveedorId) {
      setProductos(todosLosProductos);
      return;
    }
    try {
      const respuesta = await api<OfertaProveedor[]>(`/proveedores/${proveedorId}/productos`);
      setOfertas(respuesta);
      setProductos(
        respuesta.length === 0
          ? todosLosProductos
          : todosLosProductos.filter((producto) => respuesta.some((oferta) => oferta.productoId === producto.id)),
      );
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const openNew = () => {
    setForm({ proveedorId: '', observacion: '', items: [{ productoId: '', cantidad: '1' }] });
    setOfertas([]);
    setProductos(todosLosProductos);
    setFormError('');
    setOpen(true);
  };

  const setItem = (i: number, campo: keyof ItemForm, valor: string) => {
    const next = [...form.items];
    next[i] = { ...next[i], [campo]: valor };
    if (campo === 'productoId') {
      const oferta = ofertas.find((item) => String(item.productoId) === valor);
      next[i].cantidad = oferta ? String(oferta.minimoCompra) : '1';
      next[i].minimoCompra = oferta?.minimoCompra;
    }
    setForm({ ...form, items: next });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.proveedorId) {
      setFormError('Selecciona un proveedor.');
      return;
    }
    for (const item of form.items) {
      const minimo = item.minimoCompra ?? 1;
      if (!item.productoId || Number(item.cantidad) < minimo) {
        setFormError(`Cada producto requiere una cantidad mínima de ${minimo} unidades.`);
        return;
      }
    }
    setSaving(true);
    setFormError('');
    try {
      await api('/solicitudes-compra', {
        method: 'POST',
        body: {
          proveedor_id: Number(form.proveedorId),
          observacion: form.observacion.trim() || undefined,
          items: form.items.map((item) => ({ producto_id: Number(item.productoId), cantidad: Number(item.cantidad) })),
        },
      });
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const decidir = async (id: number, decision: 'aprobar' | 'rechazar') => {
    const mensaje = decision === 'aprobar' ? '¿Aprobar la solicitud y generar la compra?' : '¿Rechazar la solicitud?';
    if (!confirm(mensaje)) return;
    try {
      await api(`/solicitudes-compra/${id}/${decision}`, {
        method: 'POST',
        body: decision === 'rechazar' ? { motivo_rechazo: 'Rechazada por el administrador' } : {},
      });
      setDetail(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const ver = async (id: number) => {
    try {
      setDetail(await api<Solicitud>(`/solicitudes-compra/${id}`));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Solicitudes de compra"
        subtitle="El almacén solicita productos y el administrador aprueba la compra al proveedor."
        action={hasPermiso('solicitudes.crear') && <button className="btn btn-primary" onClick={openNew}>Nueva solicitud</button>}
      />
      <Card>
        <div className="filters">
          <Field label="Buscar"><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Código o proveedor" /></Field>
          <Field label="Estado">
            <select value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}>
              <option value="">Todas</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="APROBADA">Aprobada</option>
              <option value="RECHAZADA">Rechazada</option>
            </select>
          </Field>
        </div>
        {error && <ErrorBox message={error} onRetry={load} />}
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <EmptyState message="No hay solicitudes registradas." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Proveedor</th>
                  <th>Solicitado por</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Compra</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((solicitud) => (
                  <tr key={solicitud.id}>
                    <td className="strong">{solicitud.codigo}</td>
                    <td>{solicitud.proveedorRazonSocial}</td>
                    <td>{solicitud.usuarioNombreCompleto}</td>
                    <td className="nowrap">{fmtDate(solicitud.creadoEn)}</td>
                    <td><EstadoBadge estado={solicitud.estado} /></td>
                    <td>{solicitud.compraCodigo ?? '—'}</td>
                    <td className="row-actions">
                      <button className="btn btn-sm" onClick={() => void ver(solicitud.id)}>Ver</button>
                      {hasPermiso('solicitudes.decidir') && solicitud.estado === 'PENDIENTE' && (
                        <>
                          <button className="btn btn-sm btn-success" onClick={() => void decidir(solicitud.id, 'aprobar')}>Aprobar</button>
                          <button className="btn btn-sm btn-danger" onClick={() => void decidir(solicitud.id, 'rechazar')}>Rechazar</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={Number(meta.totalPages ?? 1)} total={Number(meta.total ?? 0)} onChange={setPage} />
      </Card>

      <Modal open={open} title="Nueva solicitud de compra" onClose={() => setOpen(false)} wide>
        <form onSubmit={save} className="stack">
          {formError && <div className="notice notice-warn">{formError}</div>}
          <div className="form-grid">
            <Field label="Proveedor" className="full">
              <select value={form.proveedorId} onChange={(e) => void cambiarProveedor(e.target.value)} required>
                <option value="">Seleccionar proveedor...</option>
                {proveedores.map((proveedor) => <option key={proveedor.id} value={proveedor.id}>{proveedor.razonSocial}</option>)}
              </select>
            </Field>
            <Field label="Observación" className="full"><input value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })} /></Field>
          </div>
          <div className="strong">Productos solicitados</div>
          {form.items.map((item, i) => (
            <div key={i} className="form-grid" style={{ alignItems: 'end', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <Field label="Producto" className="full">
                <select value={item.productoId} onChange={(e) => setItem(i, 'productoId', e.target.value)} required>
                  <option value="">Seleccionar...</option>
                  {productos.map((producto) => <option key={producto.id} value={producto.id}>{producto.codigo} - {producto.nombre} (stock {producto.stockReal})</option>)}
                </select>
              </Field>
              <Field label="Cantidad" hint={item.minimoCompra ? `Mínimo mayorista: ${item.minimoCompra}` : undefined}>
                <input type="number" min={item.minimoCompra ?? 1} value={item.cantidad} onChange={(e) => setItem(i, 'cantidad', e.target.value)} required />
              </Field>
              <div>
                {form.items.length > 1 && (
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) })}>Quitar</button>
                )}
              </div>
            </div>
          ))}
          <div className="inline">
            <button type="button" className="btn btn-sm" onClick={() => setForm({ ...form, items: [...form.items, { productoId: '', cantidad: '1' }] })}>+ Agregar producto</button>
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Enviando...' : 'Enviar solicitud'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detail} title={detail ? `Solicitud ${detail.codigo}` : ''} onClose={() => setDetail(null)} wide>
        {detail && (
          <div className="stack">
            <div className="grid-2">
              <div><span className="muted">Proveedor:</span> <span className="strong">{detail.proveedorRazonSocial}</span></div>
              <div><span className="muted">NIT:</span> {detail.proveedorNitCi}</div>
              <div><span className="muted">Estado:</span> <EstadoBadge estado={detail.estado} /></div>
              <div><span className="muted">Solicitó:</span> {detail.usuarioNombreCompleto}</div>
              <div><span className="muted">Compra:</span> {detail.compraCodigo ?? '—'}</div>
              <div><span className="muted">Aprobó:</span> {detail.aprobadoPorNombreCompleto ?? '—'}</div>
            </div>
            {detail.observacion && <div><span className="muted">Obs:</span> {detail.observacion}</div>}
            {detail.motivoRechazo && <div className="notice notice-warn">{detail.motivoRechazo}</div>}
            <div className="table-wrap">
              <table>
                <thead><tr><th>Producto</th><th className="num">Cantidad</th></tr></thead>
                <tbody>
                  {detail.items.map((item) => <tr key={item.id}><td>{item.productoCodigo} - {item.productoNombre}</td><td className="num">{item.cantidad}</td></tr>)}
                </tbody>
              </table>
            </div>
            {hasPermiso('solicitudes.decidir') && detail.estado === 'PENDIENTE' && (
              <div className="form-actions">
                <button className="btn btn-success" onClick={() => void decidir(detail.id, 'aprobar')}>Aprobar y generar compra</button>
                <button className="btn btn-danger" onClick={() => void decidir(detail.id, 'rechazar')}>Rechazar</button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
