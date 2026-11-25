import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, apiWithMeta, errorMessage, qs } from '../api/client';
import { useAuth } from '../auth/AuthContext';
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
  numberFormat,
  type Tone,
} from '../components/ui';

interface Usuario {
  id: number;
  nombreCompleto: string;
  email: string;
  role: string;
  roleNombre: string;
  activo: boolean;
  creadoEn: string;
  ultimoAccesoEn: string | null;
}

interface Rol {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
}

interface Permiso {
  id: number;
  codigo: string;
  modulo: string;
  accion: string;
}

interface Catalogos {
  roles: Rol[];
  permisos: Permiso[];
}

interface ListaUsuarios {
  items: Usuario[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Formulario {
  nombreCompleto: string;
  email: string;
  password: string;
  rolId: string;
  tipoDocumento: 'NIT' | 'CI';
  nitCi: string;
  telefono: string;
  direccion: string;
  activo: boolean;
}

const FORMULARIO_VACIO: Formulario = {
  nombreCompleto: '',
  email: '',
  password: '',
  rolId: '',
  tipoDocumento: 'NIT',
  nitCi: '',
  telefono: '',
  direccion: '',
  activo: true,
};

const tonoRol = (codigo: string): Tone =>
  codigo === 'ADMINISTRADOR' ? 'purple' : codigo === 'VENDEDOR' ? 'blue' : 'amber';

export default function UsuariosPage() {
  const { user } = useAuth();
  const [lista, setLista] = useState<ListaUsuarios | null>(null);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [buscar, setBuscar] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroActivo, setFiltroActivo] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modalAbierta, setModalAbierta] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [form, setForm] = useState<Formulario>(FORMULARIO_VACIO);
  const [formError, setFormError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState<number | null>(null);

  const recargar = useCallback(() => setVersion((valor) => valor + 1), []);

  const cargarCatalogos = useCallback(async () => {
    try {
      setCatalogos(await api<Catalogos>('/usuarios/catalogos'));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void cargarCatalogos();
  }, [cargarCatalogos]);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError('');
    const consulta = qs({
      q: buscar,
      role: filtroRol,
      activo: filtroActivo === '' ? undefined : filtroActivo === 'true',
      page,
      limit: 10,
    });
    apiWithMeta<Usuario[]>(`/usuarios${consulta}`)
      .then(({ data, meta }) => {
        if (activo) {
          setLista({
            items: data,
            total: Number(meta.total ?? 0),
            page: Number(meta.page ?? page),
            limit: Number(meta.limit ?? 10),
            totalPages: Number(meta.totalPages ?? 1),
          });
        }
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
  }, [buscar, filtroRol, filtroActivo, page, version]);

  const abrirNuevo = () => {
    const primerRol = catalogos?.roles[0];
    setEditando(null);
    setForm({ ...FORMULARIO_VACIO, rolId: primerRol ? String(primerRol.id) : '' });
    setFormError('');
    setModalAbierta(true);
  };

  const abrirEditar = (usuario: Usuario) => {
    const rol = catalogos?.roles.find((item) => item.codigo === usuario.role);
    setEditando(usuario);
    setForm({
      nombreCompleto: usuario.nombreCompleto,
      email: usuario.email,
      password: '',
      rolId: rol ? String(rol.id) : '',
      tipoDocumento: 'NIT',
      nitCi: '',
      telefono: '',
      direccion: '',
      activo: usuario.activo,
    });
    setFormError('');
    setModalAbierta(true);
  };

  const validar = (): string => {
    if (!form.nombreCompleto.trim()) return 'Ingresa el nombre completo.';
    if (!/^[\p{L}][\p{L}\s'.-]*$/u.test(form.nombreCompleto.trim()) || form.nombreCompleto.trim().length < 2) {
      return 'El nombre completo solo debe contener letras, espacios, apóstrofos, puntos o guiones.';
    }
    if (!form.email.trim()) return 'Ingresa el correo electrónico.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Ingresa un correo electrónico válido.';
    if (!form.rolId) return 'Selecciona un rol.';
    if (form.nitCi.trim() && form.tipoDocumento === 'NIT' && !/^\d+$/.test(form.nitCi.trim())) {
      return 'El NIT solo debe contener números.';
    }
    if (form.nitCi.trim() && form.tipoDocumento === 'CI' && !/^[A-Za-z0-9]+$/.test(form.nitCi.trim())) {
      return 'La CI solo debe contener números y letras.';
    }
    if (!editando) {
      if (!form.password) return 'Ingresa una contraseña.';
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(form.password)) {
        return 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.';
      }
    }
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
    try {
      const comun = {
        nombreCompleto: form.nombreCompleto.trim(),
        email: form.email.trim(),
        rolId: Number(form.rolId),
        nitCi: form.nitCi.trim() || undefined,
        tipoDocumento: form.nitCi.trim() ? form.tipoDocumento : undefined,
        telefono: form.telefono.trim() || undefined,
        direccion: form.direccion.trim() || undefined,
        activo: form.activo,
      };
      if (editando) {
        await api(`/usuarios/${editando.id}`, { method: 'PATCH', body: comun });
      } else {
        await api('/usuarios', { method: 'POST', body: { ...comun, password: form.password } });
      }
      setModalAbierta(false);
      await cargarCatalogos();
      recargar();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (usuario: Usuario) => {
    setCambiandoEstado(usuario.id);
    setError('');
    try {
      await api(`/usuarios/${usuario.id}/estado`, { method: 'PATCH', body: { activo: !usuario.activo } });
      recargar();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCambiandoEstado(null);
    }
  };

  const rolSeleccionado = catalogos?.roles.find((rol) => String(rol.id) === form.rolId);
  const permisosDelRol = rolSeleccionado && user?.role === rolSeleccionado.codigo ? user.permisos : [];

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle="Gestiona cuentas, roles y estados de acceso."
        action={
          <button type="button" className="btn btn-primary" onClick={abrirNuevo}>
            Nuevo usuario
          </button>
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
              placeholder="Nombre o correo"
            />
          </Field>
          <Field label="Rol">
            <select value={filtroRol} onChange={(event) => setFiltroRol(event.target.value)}>
              <option value="">Todos los roles</option>
              {catalogos?.roles.map((rol) => (
                <option key={rol.id} value={rol.codigo}>
                  {rol.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select
              value={filtroActivo}
              onChange={(event) => setFiltroActivo(event.target.value as '' | 'true' | 'false')}
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </Field>
          <button type="submit" className="btn btn-primary">
            Filtrar
          </button>
        </form>
      </Card>

      <Card>
        <div className="card-head">
          <h2>Listado de usuarios</h2>
          {lista && <span className="muted">{numberFormat(lista.total)} registros</span>}
        </div>

        {error && <ErrorBox message={error} onRetry={recargar} />}

        {!error && cargando && <Loading label="Cargando..." />}

        {!error && !cargando && (!lista || lista.items.length === 0) && (
          <EmptyState message="No se encontraron usuarios con los filtros seleccionados." />
        )}

        {!error && !cargando && lista && lista.items.length > 0 && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nombre completo</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Creado</th>
                    <th>Último acceso</th>
                    <th className="right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.items.map((usuario) => (
                    <tr key={usuario.id}>
                      <td className="strong">{usuario.nombreCompleto}</td>
                      <td>{usuario.email}</td>
                      <td>
                        <Badge tone={tonoRol(usuario.role)}>{usuario.roleNombre}</Badge>
                      </td>
                      <td>
                        <EstadoBadge estado={usuario.activo ? 'ACTIVO' : 'INACTIVO'} />
                      </td>
                      <td className="nowrap">{fmtDate(usuario.creadoEn)}</td>
                      <td className="nowrap">{fmtDateTime(usuario.ultimoAccesoEn)}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="btn btn-sm" onClick={() => abrirEditar(usuario)}>
                            Editar
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${usuario.activo ? 'btn-danger' : 'btn-success'}`}
                            onClick={() => void cambiarEstado(usuario)}
                            disabled={cambiandoEstado === usuario.id}
                          >
                            {cambiandoEstado === usuario.id ? 'Procesando...' : usuario.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
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
        title={editando ? 'Editar usuario' : 'Nuevo usuario'}
        onClose={() => setModalAbierta(false)}
      >
        <form onSubmit={guardar}>
          {formError && (
            <div className="notice notice-warn" role="alert">
              {formError}
            </div>
          )}
          <div className="form-grid">
            <Field label="Nombre completo" className="full">
              <input
                value={form.nombreCompleto}
                onChange={(event) => setForm({ ...form, nombreCompleto: event.target.value })}
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
            <Field label={form.tipoDocumento === 'NIT' ? 'NIT' : 'CI'} hint="Si se omite, se genera automáticamente.">
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
                disabled={guardando}
              />
            </Field>
            <Field label="Teléfono">
              <input
                value={form.telefono}
                onChange={(event) => setForm({ ...form, telefono: event.target.value })}
                disabled={guardando}
              />
            </Field>
            <Field label="Dirección" className="full">
              <input
                value={form.direccion}
                onChange={(event) => setForm({ ...form, direccion: event.target.value })}
                disabled={guardando}
              />
            </Field>
            {!editando && (
              <Field
                label="Contraseña"
                className="full"
                hint="Mínimo 8 caracteres, con mayúscula, minúscula y número."
              >
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  autoComplete="new-password"
                  disabled={guardando}
                />
              </Field>
            )}
            <Field label="Rol">
              <select
                value={form.rolId}
                onChange={(event) => setForm({ ...form, rolId: event.target.value })}
                disabled={guardando}
              >
                <option value="">Selecciona un rol</option>
                {catalogos?.roles.map((rol) => (
                  <option key={rol.id} value={rol.id}>
                    {rol.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Estado">
              <select
                value={form.activo ? 'true' : 'false'}
                onChange={(event) => setForm({ ...form, activo: event.target.value === 'true' })}
                disabled={guardando}
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </Field>
          </div>

          {permisosDelRol.length > 0 && (
            <div className="notice" style={{ marginTop: 16 }}>
              <div className="strong">Permisos del rol {rolSeleccionado?.nombre}</div>
              <div className="inline" style={{ marginTop: 8 }}>
                {permisosDelRol.map((permiso) => (
                  <Badge key={permiso} tone="blue">
                    {permiso}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {catalogos && catalogos.permisos.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="strong">Permisos disponibles en el sistema</div>
              <div className="inline" style={{ marginTop: 8 }}>
                {catalogos.permisos.map((permiso) => (
                  <Badge key={permiso.id} tone="gray">
                    {permiso.codigo}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn"
              onClick={() => setModalAbierta(false)}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
