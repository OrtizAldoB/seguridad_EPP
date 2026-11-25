import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, apiWithMeta, errorMessage, qs } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Badge, Card, EmptyState, ErrorBox, Field, Loading, Modal, PageHeader, Pagination, esTelefonoValido, soloDigitos } from '../components/ui';

interface Proveedor {
  id: number;
  razonSocial: string;
  nitCi: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  contacto: string | null;
  estado: 'ACTIVO' | 'INACTIVO';
}
interface ProductoOpcion {
  id: number;
  codigo: string;
  nombre: string;
}
type ModoProducto = 'EXISTENTE' | 'NUEVO';
type TipoContacto = 'CELULAR' | 'TELEFONO' | 'AMBOS';
interface OfertaForm {
  modo: ModoProducto;
  productoId: string;
  codigo: string;
  nombre: string;
  categoria: string;
  unidadMedida: string;
  descripcion: string;
  precioUnitario: string;
  minimoCompra: string;
}
interface OfertaProveedor {
  productoId: number;
  codigo: string;
  nombre: string;
  precioUnitario: number;
  minimoCompra: number;
  stockDisponible: number;
}
type FormProveedor = {
  razonSocial: string;
  nitCi: string;
  tipoContacto: TipoContacto;
  telefono: string;
  email: string;
  direccion: string;
  contacto: string;
  estado: 'ACTIVO' | 'INACTIVO';
};

const empty: FormProveedor = {
  razonSocial: '',
  nitCi: '',
  tipoContacto: 'CELULAR',
  telefono: '',
  email: '',
  direccion: '',
  contacto: '',
  estado: 'ACTIVO',
};
const ofertaVacia = (categoria: string): OfertaForm => ({
  modo: 'EXISTENTE',
  productoId: '',
  codigo: '',
  nombre: '',
  categoria,
  unidadMedida: 'UND',
  descripcion: '',
  precioUnitario: '',
  minimoCompra: '1',
});

export default function ProveedoresPage() {
  const { hasPermiso } = useAuth();
  const [items, setItems] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<ProductoOpcion[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [ofertas, setOfertas] = useState<OfertaForm[]>([]);
  const [meta, setMeta] = useState<any>({});
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Proveedor | null>(null);
  const [form, setForm] = useState<FormProveedor>(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await apiWithMeta<{ items: Proveedor[] }>(`/proveedores${qs({ q, estado, page, limit: 20 })}`);
      setItems(r.data.items ?? []);
      setMeta(r.meta);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [q, estado, page]);

  const cargarCatalogos = useCallback(async () => {
    try {
      const [productosResp, categoriasResp] = await Promise.all([
        api<{ items: ProductoOpcion[] }>('/productos?activo=true&limit=100'),
        api<string[]>('/productos/categorias'),
      ]);
      setProductos(productosResp.items ?? []);
      setCategorias(categoriasResp);
    } catch {
      setProductos([]);
      setCategorias([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void cargarCatalogos();
  }, [cargarCatalogos]);

  const cargarOfertas = async (proveedorId: number) => {
    try {
      const respuesta = await api<OfertaProveedor[]>(`/proveedores/${proveedorId}/productos`);
      setOfertas(
        respuesta.map((oferta) => ({
          ...ofertaVacia(categorias[0] ?? ''),
          productoId: String(oferta.productoId),
          precioUnitario: String(oferta.precioUnitario),
          minimoCompra: String(oferta.minimoCompra),
        })),
      );
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty, tipoContacto: 'CELULAR' });
    setOfertas([]);
    setFormError('');
    void cargarCatalogos();
    setOpen(true);
  };

  const openEdit = async (p: Proveedor) => {
    setEditing(p);
    const tipoContacto: TipoContacto =
      p.contacto && p.telefono ? 'AMBOS' : p.contacto ? 'CELULAR' : 'TELEFONO';
    setForm({
      razonSocial: p.razonSocial,
      nitCi: p.nitCi,
      tipoContacto,
      telefono: p.telefono ?? '',
      email: p.email ?? '',
      direccion: p.direccion ?? '',
      contacto: p.contacto ?? '',
      estado: p.estado,
    });
    setOfertas([]);
    setFormError('');
    void cargarCatalogos();
    setOpen(true);
    await cargarOfertas(p.id);
  };

  const actualizarOferta = (indice: number, campo: keyof OfertaForm, valor: string) => {
    setOfertas((anteriores) => anteriores.map((oferta, i) => (i === indice ? { ...oferta, [campo]: valor } : oferta)));
  };

  const contactoListo =
    form.tipoContacto === 'CELULAR'
      ? esTelefonoValido(form.contacto)
      : form.tipoContacto === 'TELEFONO'
        ? esTelefonoValido(form.telefono)
        : esTelefonoValido(form.contacto) && esTelefonoValido(form.telefono);

  const ofertasListas =
    ofertas.length === 0 ||
    ofertas.every(
      (oferta) =>
        Number(oferta.precioUnitario) > 0 &&
        Number(oferta.minimoCompra) >= 1 &&
        (oferta.modo === 'EXISTENTE'
          ? Boolean(oferta.productoId)
          : Boolean(oferta.codigo.trim() && oferta.nombre.trim() && oferta.categoria)),
    );

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[\p{L}][\p{L}\s'.-]*$/u.test(form.razonSocial.trim()) || form.razonSocial.trim().length < 2) {
      setFormError('La razón social solo debe contener letras, espacios, apóstrofos, puntos o guiones.');
      return;
    }
    if (!contactoListo) {
      setFormError('Registra un celular, un teléfono o ambos según la opción seleccionada.');
      return;
    }
    if (!ofertasListas) {
      setFormError('Completa los datos de cada producto ofrecido. Los descuentos se configuran solo en el catálogo.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const body = {
        razonSocial: form.razonSocial.trim(),
        nitCi: form.nitCi.trim(),
        telefono: form.tipoContacto === 'CELULAR' ? undefined : form.telefono.trim() || undefined,
        contacto: form.tipoContacto === 'TELEFONO' ? undefined : form.contacto.trim() || undefined,
        email: form.email.trim() || undefined,
        direccion: form.direccion.trim() || undefined,
        estado: form.estado,
        productos: ofertas.map((oferta) =>
          oferta.modo === 'EXISTENTE'
            ? {
                productoId: Number(oferta.productoId),
                precioUnitario: Number(oferta.precioUnitario),
                minimoCompra: Number(oferta.minimoCompra),
              }
            : {
                productoNuevo: {
                  codigo: oferta.codigo.trim(),
                  nombre: oferta.nombre.trim(),
                  categoria: oferta.categoria,
                  unidadMedida: oferta.unidadMedida.trim() || 'UND',
                  descripcion: oferta.descripcion.trim() || undefined,
                },
                precioUnitario: Number(oferta.precioUnitario),
                minimoCompra: Number(oferta.minimoCompra),
              },
        ),
      };
      if (editing) await api(`/proveedores/${editing.id}`, { method: 'PATCH', body });
      else await api('/proveedores', { method: 'POST', body });
      setOpen(false);
      await load();
      await cargarCatalogos();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('¿Desactivar proveedor?')) return;
    try {
      await api(`/proveedores/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader
        title="Proveedores"
        subtitle="Empresas proveedoras de EPP (compras por mayoreo)."
        action={hasPermiso('proveedores.crear') && <button className="btn btn-primary" onClick={openNew}>Nuevo proveedor</button>}
      />
      <Card>
        <div className="filters">
          <Field label="Buscar"><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Razón social, NIT, contacto" /></Field>
          <Field label="Estado"><select value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}><option value="">Todos</option><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select></Field>
        </div>
        {error && <ErrorBox message={error} onRetry={load} />}
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <EmptyState message="No hay proveedores." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Razón social</th><th>NIT/CI</th><th>Celular</th><th>Teléfono</th><th>Email</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td className="strong">{p.razonSocial}</td>
                    <td>{p.nitCi}</td>
                    <td>{p.contacto ?? '—'}</td>
                    <td>{p.telefono ?? '—'}</td>
                    <td>{p.email ?? '—'}</td>
                    <td><Badge tone={p.estado === 'ACTIVO' ? 'green' : 'gray'}>{p.estado}</Badge></td>
                    <td className="row-actions">
                      {hasPermiso('proveedores.actualizar') && <button className="btn btn-sm" onClick={() => void openEdit(p)}>Editar</button>}
                      {hasPermiso('proveedores.eliminar') && p.estado === 'ACTIVO' && <button className="btn btn-sm btn-danger" onClick={() => void remove(p.id)}>Desactivar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={Number(meta.totalPages ?? 1)} total={Number(meta.total ?? 0)} onChange={setPage} />
      </Card>

      <Modal open={open} title={editing ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={() => setOpen(false)} wide>
        <form onSubmit={save} className="stack">
          {formError && <div className="notice notice-warn">{formError}</div>}
          <div className="form-grid">
            <Field label="Razón social" className="full"><input value={form.razonSocial} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })} required /></Field>
            <Field label="NIT/CI"><input value={form.nitCi} onChange={(e) => setForm({ ...form, nitCi: e.target.value })} required /></Field>
            <Field label="Tipo de contacto">
              <select value={form.tipoContacto} onChange={(e) => setForm({ ...form, tipoContacto: e.target.value as TipoContacto })}>
                <option value="CELULAR">Solo celular</option>
                <option value="TELEFONO">Solo teléfono</option>
                <option value="AMBOS">Celular y teléfono</option>
              </select>
            </Field>
            {(form.tipoContacto === 'CELULAR' || form.tipoContacto === 'AMBOS') && (
              <Field label="Celular" hint="Solo números, de 7 a 15 dígitos.">
                <input value={form.contacto} onChange={(e) => setForm({ ...form, contacto: soloDigitos(e.target.value) })} inputMode="numeric" pattern="[0-9]*" maxLength={15} placeholder="70000000" required />
              </Field>
            )}
            {(form.tipoContacto === 'TELEFONO' || form.tipoContacto === 'AMBOS') && (
              <Field label="Teléfono" hint="Solo números, de 7 a 15 dígitos.">
                <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: soloDigitos(e.target.value) })} inputMode="numeric" pattern="[0-9]*" maxLength={15} placeholder="70000000" required />
              </Field>
            )}
            <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Dirección" className="full"><input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></Field>
            <Field label="Estado"><select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as 'ACTIVO' | 'INACTIVO' })}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select></Field>
          </div>

          <div className="card-head" style={{ marginTop: 16 }}>
            <h2>Productos ofrecidos</h2>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setOfertas((anteriores) => [...anteriores, ofertaVacia(categorias[0] ?? '')])}
            >
              Agregar producto
            </button>
          </div>
          <p className="muted">Selecciona un producto del catálogo o registra uno nuevo. Los descuentos se configuran únicamente en Catálogo EPP.</p>
          {ofertas.length === 0 ? (
            <EmptyState message="Sin productos ofrecidos; se permitirán compras generales." />
          ) : (
            <div className="form-grid">
              {ofertas.map((oferta, indice) => (
                <div key={indice} className="full" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div className="form-grid">
                    <Field label="Origen del producto" className="full">
                      <select value={oferta.modo} onChange={(e) => actualizarOferta(indice, 'modo', e.target.value)}>
                        <option value="EXISTENTE">Seleccionar producto existente</option>
                        <option value="NUEVO">Registrar producto nuevo</option>
                      </select>
                    </Field>
                    {oferta.modo === 'EXISTENTE' ? (
                      <Field label="Producto" className="full">
                        <select value={oferta.productoId} onChange={(e) => actualizarOferta(indice, 'productoId', e.target.value)}>
                          <option value="">Selecciona un producto</option>
                          {productos.map((producto) => <option key={producto.id} value={producto.id}>{producto.codigo} · {producto.nombre}</option>)}
                        </select>
                      </Field>
                    ) : (
                      <>
                        <Field label="Código"><input value={oferta.codigo} onChange={(e) => actualizarOferta(indice, 'codigo', e.target.value)} /></Field>
                        <Field label="Nombre"><input value={oferta.nombre} onChange={(e) => actualizarOferta(indice, 'nombre', e.target.value)} /></Field>
                        <Field label="Categoría">
                          <select value={oferta.categoria} onChange={(e) => actualizarOferta(indice, 'categoria', e.target.value)}>
                            <option value="">Selecciona categoría</option>
                            {categorias.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
                          </select>
                        </Field>
                        <Field label="Unidad"><input value={oferta.unidadMedida} onChange={(e) => actualizarOferta(indice, 'unidadMedida', e.target.value)} /></Field>
                        <Field label="Descripción" className="full"><input value={oferta.descripcion} onChange={(e) => actualizarOferta(indice, 'descripcion', e.target.value)} /></Field>
                      </>
                    )}
                    <Field label="Precio unitario"><input type="number" min="0" step="0.01" value={oferta.precioUnitario} onChange={(e) => actualizarOferta(indice, 'precioUnitario', e.target.value)} /></Field>
                    <Field label="Mínimo de compra"><input type="number" min="1" step="1" value={oferta.minimoCompra} onChange={(e) => actualizarOferta(indice, 'minimoCompra', e.target.value)} /></Field>
                    <Field label="Acción"><button type="button" className="btn btn-danger" onClick={() => setOfertas((anteriores) => anteriores.filter((_, i) => i !== indice))}>Quitar</button></Field>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" disabled={saving || !contactoListo || !ofertasListas}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          {!contactoListo && <p className="muted">Completa el contacto seleccionado para habilitar el registro.</p>}
        </form>
      </Modal>
    </>
  );
}
