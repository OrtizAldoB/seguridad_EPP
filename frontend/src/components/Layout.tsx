import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Badge } from './ui';

type Rol = 'ADMINISTRADOR' | 'VENDEDOR' | 'ALMACENERO' | 'COMPRADOR';

interface NavItem {
  to: string;
  label: string;
  short: string;
  permiso: string;
  roles?: Rol[];
  end?: boolean;
}

const COMERCIAL: Rol[] = ['ADMINISTRADOR', 'VENDEDOR'];
const ALMACEN: Rol[] = ['ADMINISTRADOR', 'ALMACENERO'];

const NAV: NavItem[] = [
  { to: '/', label: 'Panel general', short: 'PG', permiso: '', end: true },
  { to: '/clientes', label: 'Clientes', short: 'CL', permiso: 'clientes.leer' },
  { to: '/productos', label: 'Catálogo EPP', short: 'EP', permiso: 'productos.leer' },
  { to: '/proveedores', label: 'Proveedores', short: 'PR', permiso: 'proveedores.leer' },
  { to: '/compras', label: 'Compras', short: 'CM', permiso: 'compras.leer' },
  { to: '/solicitudes-compra', label: 'Solicitudes de compra', short: 'SC', permiso: 'solicitudes.leer' },
  { to: '/cotizaciones', label: 'Cotizaciones', short: 'CO', permiso: 'cotizaciones.leer', roles: COMERCIAL },
  { to: '/pedidos', label: 'Pedidos', short: 'PE', permiso: 'pedidos.leer', roles: COMERCIAL },
  { to: '/almacen', label: 'Almacén y despacho', short: 'AL', permiso: 'pedidos.leer', roles: ALMACEN },
  { to: '/kardex', label: 'Kardex', short: 'KA', permiso: 'inventario.leer' },
  { to: '/aprobaciones', label: 'Aprobaciones', short: 'AP', permiso: 'aprobaciones.leer' },
  { to: '/reportes', label: 'Reportes', short: 'RE', permiso: 'reportes.leer' },
  { to: '/usuarios', label: 'Usuarios', short: 'US', permiso: 'usuarios.leer' },
];

export default function Layout() {
  const { user, logout, hasPermiso } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState(0);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user || !hasPermiso('notificaciones.leer')) return;
    let activo = true;
    api<unknown[]>('/notificaciones?leida=false&limit=100', { auth: true })
      .then((items) => {
        if (activo) setNotificaciones(items.length);
      })
      .catch(() => {
        if (activo) setNotificaciones(0);
      });
    return () => {
      activo = false;
    };
  }, [user, hasPermiso, location.pathname]);

  const visible = NAV.filter(
    (item) =>
      (!item.permiso || hasPermiso(item.permiso)) &&
      (!item.roles || (user?.role !== undefined && item.roles.includes(user.role as Rol))),
  );

  const cerrarSesion = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`.trim()}>
        <div className="brand">
          <span className="brand-mark">EPP</span>
          <div>
            <strong>Sistema EPP</strong>
            <small>Kardex y comercial</small>
          </div>
        </div>
        <nav className="sidebar-nav">
          {visible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`.trim()}
            >
              <span className="nav-icon">{item.short}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>Sesión activa</span>
          <small>{user?.roleNombre}</small>
        </div>
      </aside>

      {menuOpen && <button type="button" className="sidebar-overlay" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" />}

      <div className="app-main">
        <header className="topbar">
          <button type="button" className="menu-btn" onClick={() => setMenuOpen((value) => !value)} aria-label="Abrir menú">
            ☰
          </button>
          <div className="topbar-spacer" />
          {hasPermiso('notificaciones.leer') && (
            <NavLink to="/almacen" className="topbar-link">
              Notificaciones
              {notificaciones > 0 && <Badge tone="red">{notificaciones}</Badge>}
            </NavLink>
          )}
          <NavLink to="/perfil" className="topbar-user topbar-user-link" title="Mi perfil">
            <span className="avatar">{user?.nombreCompleto.charAt(0).toUpperCase()}</span>
            <div>
              <strong>{user?.nombreCompleto}</strong>
              <small>{user?.email}</small>
            </div>
          </NavLink>
          <button type="button" className="btn btn-ghost btn-sm" onClick={cerrarSesion}>
            Salir
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

