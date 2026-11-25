import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage, qs } from '../api/client';
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
  fmtDateTime,
  numberFormat,
  esTelefonoValido,
  soloDigitos,
} from '../components/ui';

interface Cliente {
  id: number;
  razonSocial: string;
  nitCi: string;
  tipoDocumento: 'NIT' | 'CI';
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  estado: 'ACTIVO' | 'INACTIVO';
  creadoEn: string;
  actualizadoEn: string;
}

interface ListaClientes {
  items: Cliente[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Formulario {
  razonSocial: string;
  tipoDocumento: 'NIT' | 'CI';
  nitCi: string;
  telefono: string;
  email: string;
  direccion: string;
  estado: 'ACTIVO' | 'INACTIVO';
}

const FORMULARIO_VACIO: Formulario = {
  razonSocial: '',
  tipoDocumento: 'NIT',
  nitCi: '',
  telefono: '',
  email: '',
  direccion: '',
  estado: 'ACTIVO',
};

export default function ClientesPage() {
  const { hasPermiso } = useAuth();
  const puedeCrear = hasPermiso('clientes.crear');
  const puedeActualizar = hasPermiso('clientes.actualizar');
  const puedeEliminar = hasPermiso('clientes.eliminar');
  const [lista, setLista] = useState<ListaClientes | null>(null);
  const [buscar, setBuscar] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modalAbierta, setModalAbierta] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState<Formulario>(FORMULARIO_VACIO);
  const [formError, setFormError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState<number | null>(null);

  const recargar = useCallback(() => setVersion((valor) => valor + 1), []);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError('');
    const consulta = qs({ q: buscar, estado: filtroEstado, page, limit: 10 });
    api<ListaClientes>(`/clientes${consulta}`)
      .then((respuesta) => {
        if (activo) setLista(respuesta);
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
  }, [buscar, filtroEstado, page, version]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORMULARIO_VACIO);
    setFormError('');
    setModalAbierta(true);
  };

  const abrirEditar = (cliente: Cliente) => {
    setEditando(cliente);
    setForm({
      razonSocial: cliente.razonSocial,
      tipoDocumento: cliente.tipoDocumento ?? 'NIT',
      nitCi: cliente.nitCi,
      telefono: cliente.telefono ?? '',
      email: cliente.email ?? '',
      direccion: cliente.direccion ?? '',
      estado: cliente.estado,
    });
    setFormError('');
    setModalAbierta(true);
  };

  const validar = (): string => {
    const razonSocial = form.razonSocial.trim();
    const documento = form.nitCi.trim();
    if (!razonSocial) return 'Ingresa la razón social.';
    if (
      razonSocial.length < 2 ||
      razonSocial.length > 150 ||
      /\d/.test(razonSocial) ||
      !/^[\p{L}][\p{L}\s'.\-]*$/u.test(razonSocial)
    ) {
      return 'La razón social solo debe contener letras, espacios, puntos, apóstrofos o guiones, sin números.';
    }
    if (!documento) return `Ingresa el ${form.tipoDocumento}.`;
    if (documento.length < 5 || documento.length > 30) {
      return `El ${form.tipoDocumento} debe tener entre 5 y 30 caracteres.`;
    }
    if (form.tipoDocumento === 'NIT' && !/^\d+$/.test(documento)) {
      return 'El NIT solo debe contener números.';
    }
    if (form.tipoDocumento === 'CI' && !/^[A-Za-z0-9]+$/.test(documento)) {
      return 'La CI solo debe contener números y letras.';
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return 'Ingresa un correo electrónico válido.';
    }
    if (form.telefono.trim() && !esTelefonoValido(form.telefono)) {
      return 'El teléfono solo debe contener números (7 a 15 dígitos).';
    }
    if (form.direccion.trim().length > 255) return 'La dirección no debe exceder 255 caracteres.';
    return '';
  };

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problema = validar();
    if (problema) {
      setFormError(problema);
      return;
    }

    setGuardando(true);
    setFormError('');
    const cuerpo = {
      razonSocial: form.razonSocial.trim(),
      tipoDocumento: form.tipoDocumento,
      nitCi: form.nitCi.trim(),
      telefono: form.telefono.trim(),
      estado: form.estado,
      ...(form.email.trim() ? { email: form.email.trim().toLowerCase() } : {}),
      ...(form.direccion.trim() ? { direccion: form.direccion.trim() } : {}),
    };
    try {
      if (editando) {
        await api(`/clientes/${editando.id}`, { method: 'PATCH', body: cuerpo });
      } else {
        await api('/clientes', { method: 'POST', body: cuerpo });
      }
      setModalAbierta(false);
      recargar();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setGuardando(false);
    }
  };

  const darDeBaja = async (cliente: Cliente) => {
    if (!window.confirm(`¿Dar de baja a ${cliente.razonSocial}? El cliente quedará inactivo.`)) return;
    setEliminando(cliente.id);
    setError('');
    try {
      await api(`/clientes/${cliente.id}`, { method: 'DELETE' });
      recargar();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setEliminando(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={
          puedeCrear || puedeActualizar || puedeEliminar
            ? 'Administra la información de clientes y su estado.'
            : 'Consulta la información de clientes y su estado.'
        }
        action={
          puedeCrear && (
            <button type="button" className="btn btn-primary" onClick={abrirNuevo}>
              Nuevo cliente
            </button>
          )
        }
      />

      <Card>
        <form
          className="filters"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
          }}
        >
          <Field label="Buscar">
            <input
              type="search"
              value={buscar}
              onChange={(event) => setBuscar(event.target.value)}
              placeholder="Razón social, NIT o CI"
            />
          </Field>
          <Field label="Estado">
            <select value={filtroEstado} onChange={(event) => setFiltroEstado(event.target.value)}>
              <option value="">Todos</option>
              <option value="ACTIVO">Activos</option>
              <option value="INACTIVO">Inactivos</option>
            </select>
          </Field>
          <button type="submit" className="btn btn-primary">
            Filtrar
          </button>
        </form>
      </Card>

      <Card>
        <div className="card-head">
          <h2>Listado de clientes</h2>
          {lista && <span className="muted">{numberFormat(lista.total)} registros</span>}
        </div>

        {error && <ErrorBox message={error} onRetry={recargar} />}

        {!error && cargando && <Loading label="Cargando..." />}
        {!error && !cargando && (!lista || lista.items.length === 0) && (
          <EmptyState message="No se encontraron clientes con los filtros seleccionados." />
        )}

        {!error && !cargando && lista && lista.items.length > 0 && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Razón social</th>
                    <th>Tipo</th>
                    <th>NIT / CI</th>
                    <th>Teléfono</th>
                    <th>Correo</th>
                    <th>Estado</th>
                    <th>Registro</th>
                    <th>Actualizado</th>
                    {(puedeActualizar || puedeEliminar) && <th className="right">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {lista.items.map((cliente) => (
                    <tr key={cliente.id}>
                      <td className="strong">{cliente.razonSocial}</td>
                      <td className="nowrap">{cliente.tipoDocumento ?? 'NIT'}</td>
                      <td className="nowrap">{cliente.nitCi}</td>
                      <td className="nowrap">{cliente.telefono ?? '—'}</td>
                      <td>{cliente.email ?? '—'}</td>
                      <td>
                        <EstadoBadge estado={cliente.estado} />
                      </td>
                      <td className="nowrap">{fmtDate(cliente.creadoEn)}</td>
                      <td className="nowrap">{fmtDateTime(cliente.actualizadoEn)}</td>
                      {(puedeActualizar || puedeEliminar) && (
                        <td>
                          <div className="row-actions">
                            {puedeActualizar && (
                              <button type="button" className="btn btn-sm" onClick={() => abrirEditar(cliente)}>
                                Editar
                              </button>
                            )}
                            {puedeEliminar && (
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                onClick={() => void darDeBaja(cliente)}
                                disabled={eliminando === cliente.id || cliente.estado === 'INACTIVO'}
                              >
                                {eliminando === cliente.id ? 'Procesando...' : 'Inactivar'}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={lista.page}
              totalPages={lista.totalPages}
              total={lista.total}
              onChange={setPage}
            />
          </>
        )}
      </Card>

      <Modal
        open={modalAbierta}
        title={editando ? 'Editar cliente' : 'Nuevo cliente'}
        onClose={() => setModalAbierta(false)}
      >
        <form onSubmit={guardar}>
          {formError && (
            <div className="notice notice-warn" role="alert">
              {formError}
            </div>
          )}
          <div className="form-grid">
            <Field label="Razón social" className="full">
              <input
                value={form.razonSocial}
                onChange={(event) => setForm({ ...form, razonSocial: event.target.value })}
                disabled={guardando}
              />
            </Field>
            <Field label="Tipo de documento">
              <select
                value={form.tipoDocumento}
                onChange={(event) =>
                  setForm({
                    ...form,
                    tipoDocumento: event.target.value as 'NIT' | 'CI',
                    nitCi: '',
                  })
                }
                disabled={guardando}
              >
                <option value="NIT">NIT</option>
                <option value="CI">CI</option>
              </select>
            </Field>
            <Field label={form.tipoDocumento === 'NIT' ? 'NIT' : 'CI'}>
              <input
                value={form.nitCi}
                onChange={(event) =>
                  setForm({
                    ...form,
                    nitCi:
                      form.tipoDocumento === 'NIT'
                        ? event.target.value.replace(/\D/g, '')
                        : event.target.value.replace(/[^A-Za-z0-9]/g, ''),
                  })
                }
                inputMode={form.tipoDocumento === 'NIT' ? 'numeric' : 'text'}
                maxLength={30}
                placeholder={form.tipoDocumento === 'NIT' ? '123456789' : 'AB123456'}
                disabled={guardando}
              />
            </Field>
            <Field label="Teléfono">
              <input
                value={form.telefono}
                onChange={(event) => setForm({ ...form, telefono: soloDigitos(event.target.value) })}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={15}
                placeholder="70000000"
                disabled={guardando}
              />
            </Field>
            <Field label="Correo electrónico" className="full">
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                disabled={guardando}
              />
            </Field>
            <Field label="Dirección" className="full">
              <textarea
                value={form.direccion}
                onChange={(event) => setForm({ ...form, direccion: event.target.value })}
                disabled={guardando}
              />
            </Field>
            <Field label="Estado">
              <select
                value={form.estado}
                onChange={(event) => setForm({ ...form, estado: event.target.value as 'ACTIVO' | 'INACTIVO' })}
                disabled={guardando}
              >
                <option value="ACTIVO">Activo</option>
                <option value="INACTIVO">Inactivo</option>
              </select>
            </Field>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn"
              onClick={() => setModalAbierta(false)}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
