import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, apiWithMeta, errorMessage, qs } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Badge, Card, EmptyState, ErrorBox, EstadoBadge, Field, Loading, Modal, PageHeader, Pagination, money, fmtDate, hoyIso } from '../components/ui';

interface Proveedor { id: number; razonSocial: string; estado: string; }
interface Producto { id: number; codigo: string; nombre: string; precioUnitario: number; stockReal: number; }
interface Detalle { id: number; productoId: number; productoCodigo: string; productoNombre: string; cantidad: number; costoUnitario: number; subtotal: number; }
interface Compra { id: number; codigo: string; proveedorRazonSocial: string; proveedorNitCi: string; estado: string; observacion: string | null; total: number; fechaEmision: string; fechaRecepcion: string | null; creadoEn: string; usuarioNombreCompleto: string; detalles?: Detalle[]; }
interface ItemForm { productoId: string; cantidad: string; costoUnitario: string; minimoCompra?: number; }
interface OfertaProveedor { productoId: number; codigo: string; nombre: string; precioUnitario: number; minimoCompra: number; descuentoPorcentaje: number; stockDisponible: number; }

export default function ComprasPage() {
  const { hasPermiso } = useAuth();
  const [items, setItems] = useState<Compra[]>([]); const [meta, setMeta] = useState<any>({});
  const [q, setQ] = useState(''); const [estado, setEstado] = useState(''); const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [proveedores, setProveedores] = useState<Proveedor[]>([]); const [productos, setProductos] = useState<Producto[]>([]);
  const [todosLosProductos, setTodosLosProductos] = useState<Producto[]>([]); const [ofertas, setOfertas] = useState<OfertaProveedor[]>([]);
  const [open, setOpen] = useState(false); const [detail, setDetail] = useState<Compra | null>(null);
  const [form, setForm] = useState({ proveedorId: '', observacion: '', fechaEmision: hoyIso(), items: [{ productoId: '', cantidad: '1', costoUnitario: '' }] as ItemForm[] });
  const [saving, setSaving] = useState(false); const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const r = await apiWithMeta<{ items: Compra[]; total: number }>(`/compras${qs({ q, estado, page, limit: 20 })}`); setItems(r.data.items ?? []); setMeta(r.meta); }
    catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, [q, estado, page]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void (async () => { try { const [p, pr] = await Promise.all([apiWithMeta<{ items: Proveedor[] }>('/proveedores?estado=ACTIVO&limit=100'), apiWithMeta<{ items: Producto[] }>('/productos?activo=true&limit=100')]); setProveedores(p.data.items ?? []); setTodosLosProductos(pr.data.items ?? []); setProductos(pr.data.items ?? []); } catch {} })(); }, []);

  const cambiarProveedor = async (proveedorId: string) => {
    setForm((anterior) => ({ ...anterior, proveedorId, items: [{ productoId: '', cantidad: '1', costoUnitario: '' }] }));
    setOfertas([]);
    if (!proveedorId) { setProductos(todosLosProductos); return; }
    try {
      const respuesta = await api<OfertaProveedor[]>(`/proveedores/${proveedorId}/productos`);
      setOfertas(respuesta);
      if (respuesta.length === 0) setProductos(todosLosProductos);
      else setProductos(todosLosProductos.filter((producto) => respuesta.some((oferta) => oferta.productoId === producto.id)));
    } catch (err) { setFormError(errorMessage(err)); }
  };

  const openNew = () => { setForm({ proveedorId: '', observacion: '', fechaEmision: hoyIso(), items: [{ productoId: '', cantidad: '1', costoUnitario: '' }] }); setOfertas([]); setProductos(todosLosProductos); setFormError(''); setOpen(true); };
  const setItem = (i: number, k: keyof ItemForm, v: string) => {
    const next = [...form.items];
    next[i] = { ...next[i], [k]: v };
    if (k === 'productoId') {
      const oferta = ofertas.find((item) => String(item.productoId) === v);
      if (oferta) {
        next[i].costoUnitario = String(oferta.precioUnitario);
        next[i].cantidad = String(oferta.minimoCompra);
        next[i].minimoCompra = oferta.minimoCompra;
      } else {
        const prod = todosLosProductos.find((p) => String(p.id) === v);
        if (prod && !next[i].costoUnitario) next[i].costoUnitario = String(prod.precioUnitario);
        next[i].minimoCompra = undefined;
      }
    }
    setForm({ ...form, items: next });
  };
  const addItem = () => setForm({ ...form, items: [...form.items, { productoId: '', cantidad: '1', costoUnitario: '' }] });
  const delItem = (i: number) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const total = form.items.reduce((s, it) => s + (Number(it.cantidad || 0) * Number(it.costoUnitario || 0)), 0);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (form.fechaEmision < hoyIso()) {
      setFormError('La fecha de emisión no puede ser anterior a hoy.');
      return;
    }
    if (!form.proveedorId) { setFormError('Selecciona un proveedor.'); return; }
    for (const item of form.items) {
      const minimo = item.minimoCompra ?? 1;
      if (!item.productoId || Number(item.cantidad) < minimo) {
        setFormError(`La cantidad mínima de compra es ${minimo} unidades para los productos de este proveedor.`);
        return;
      }
    }
    setSaving(true); setFormError('');
    try {
      await api('/compras', { method: 'POST', body: { proveedor_id: Number(form.proveedorId), observacion: form.observacion || undefined, fecha_emision: form.fechaEmision, items: form.items.map(it => ({ producto_id: Number(it.productoId), cantidad: Number(it.cantidad), costo_unitario: Number(it.costoUnitario) })) } });
      setOpen(false); await load();
    } catch (err) { setFormError(errorMessage(err)); } finally { setSaving(false); }
  };
  const ver = async (id: number) => { try { setDetail(await api<Compra>(`/compras/${id}`)); } catch (e) { setError(errorMessage(e)); } };
  const recibir = async (id: number) => { if (!confirm('¿Recibir compra e ingresar stock al kardex?')) return; try { await api(`/compras/${id}/recibir`, { method: 'POST' }); await load(); setDetail(null); } catch (e) { setError(errorMessage(e)); } };
  const cancelar = async (id: number) => { if (!confirm('¿Cancelar compra?')) return; try { await api(`/compras/${id}/cancelar`, { method: 'POST' }); await load(); setDetail(null); } catch (e) { setError(errorMessage(e)); } };

  return (
    <>
      <PageHeader title="Compras a proveedores" subtitle="Pedidos por mayoreo a empresas proveedoras. Al recibir, ingresa stock al kardex." action={hasPermiso('compras.crear') && <button className="btn btn-primary" onClick={openNew}>Nueva compra</button>} />
      <Card>
        <div className="filters">
          <Field label="Buscar"><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Código, proveedor" /></Field>
          <Field label="Estado"><select value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}><option value="">Todos</option><option value="REGISTRADA">Registrada</option><option value="RECIBIDA">Recibida</option><option value="CANCELADA">Cancelada</option></select></Field>
        </div>
        {error && <ErrorBox message={error} onRetry={load} />}
        {loading ? <Loading /> : items.length === 0 ? <EmptyState message="No hay compras registradas." /> : (
          <div className="table-wrap"><table><thead><tr><th>Código</th><th>Proveedor</th><th>Fecha</th><th>Estado</th><th className="num">Total</th><th></th></tr></thead>
            <tbody>{items.map((c) => (<tr key={c.id}><td className="strong">{c.codigo}</td><td>{c.proveedorRazonSocial}</td><td className="nowrap">{fmtDate(c.fechaEmision)}</td><td><EstadoBadge estado={c.estado} /></td><td className="num">{money(c.total)}</td><td className="row-actions">
              <button className="btn btn-sm" onClick={() => void ver(c.id)}>Ver</button>
              {hasPermiso('compras.actualizar') && c.estado === 'REGISTRADA' && <><button className="btn btn-sm btn-success" onClick={() => void recibir(c.id)}>Recibir</button><button className="btn btn-sm btn-danger" onClick={() => void cancelar(c.id)}>Cancelar</button></>}
            </td></tr>))}</tbody></table></div>
        )}
        <Pagination page={page} totalPages={Number(meta.totalPages ?? 1)} total={Number(meta.total ?? 0)} onChange={setPage} />
      </Card>

      <Modal open={open} title="Nueva compra a proveedor" onClose={() => setOpen(false)} wide>
        <form onSubmit={save} className="stack">
          {formError && <div className="notice notice-warn">{formError}</div>}
          <div className="form-grid">
            <Field label="Proveedor" className="full"><select value={form.proveedorId} onChange={(e) => void cambiarProveedor(e.target.value)} required><option value="">Seleccionar proveedor...</option>{proveedores.map(p => <option key={p.id} value={p.id}>{p.razonSocial}</option>)}</select></Field>
            <Field label="Fecha emisión"><input type="date" min={hoyIso()} value={form.fechaEmision} onChange={(e) => setForm({ ...form, fechaEmision: e.target.value })} required /></Field>
            <Field label="Observación"><input value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })} /></Field>
          </div>
          <div className="strong">Productos (mayoreo)</div>
          {form.items.map((it, i) => (
            <div key={i} className="form-grid" style={{ alignItems: 'end', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <Field label="Producto" className="full"><select value={it.productoId} onChange={(e) => setItem(i, 'productoId', e.target.value)} required><option value="">Seleccionar...</option>{productos.map(p => <option key={p.id} value={p.id}>{p.codigo} - {p.nombre} (stock {p.stockReal})</option>)}</select></Field>
              <Field label="Cantidad" hint={it.minimoCompra ? `Mínimo mayorista: ${it.minimoCompra}` : undefined}><input type="number" min={it.minimoCompra ?? 1} value={it.cantidad} onChange={(e) => setItem(i, 'cantidad', e.target.value)} required /></Field>
              <Field label="Costo unitario"><input type="number" min="0" step="0.01" value={it.costoUnitario} onChange={(e) => setItem(i, 'costoUnitario', e.target.value)} required /></Field>
              <div>{form.items.length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => delItem(i)}>Quitar</button>}</div>
            </div>
          ))}
          <div className="inline"><button type="button" className="btn btn-sm" onClick={addItem}>+ Agregar producto</button><span className="strong" style={{ marginLeft: 'auto' }}>Total: {money(total)}</span></div>
          <div className="form-actions"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Registrar compra'}</button></div>
        </form>
      </Modal>

      <Modal open={!!detail} title={detail ? `Compra ${detail.codigo}` : ''} onClose={() => setDetail(null)} wide>
        {detail && <div className="stack">
          <div className="grid-2">
            <div><span className="muted">Proveedor:</span> <span className="strong">{detail.proveedorRazonSocial}</span></div>
            <div><span className="muted">NIT:</span> {detail.proveedorNitCi}</div>
            <div><span className="muted">Estado:</span> <EstadoBadge estado={detail.estado} /></div>
            <div><span className="muted">Fecha:</span> {fmtDate(detail.fechaEmision)}</div>
            <div><span className="muted">Registró:</span> {detail.usuarioNombreCompleto}</div>
            <div><span className="muted">Total:</span> <span className="strong">{money(detail.total)}</span></div>
          </div>
          {detail.observacion && <div><span className="muted">Obs:</span> {detail.observacion}</div>}
          <div className="table-wrap"><table><thead><tr><th>Producto</th><th className="num">Cant.</th><th className="num">Costo</th><th className="num">Subtotal</th></tr></thead>
            <tbody>{detail.detalles?.map(d => <tr key={d.id}><td>{d.productoCodigo} - {d.productoNombre}</td><td className="num">{d.cantidad}</td><td className="num">{money(d.costoUnitario)}</td><td className="num">{money(d.subtotal)}</td></tr>)}</tbody></table></div>
          {hasPermiso('compras.actualizar') && detail.estado === 'REGISTRADA' && <div className="form-actions"><button className="btn btn-success" onClick={() => void recibir(detail.id)}>Recibir e ingresar stock</button><button className="btn btn-danger" onClick={() => void cancelar(detail.id)}>Cancelar</button></div>}
        </div>}
      </Modal>
    </>
  );
}
