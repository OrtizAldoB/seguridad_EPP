import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function TiendaLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const cerrarSesion = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="tienda-shell">
      <header className="tienda-topbar">
        <NavLink to="/tienda" className="tienda-brand">
          <span className="brand-mark">EPP</span>
          <span>
            <strong>Tienda EPP</strong>
            <small>Equipos de protección personal</small>
          </span>
        </NavLink>
        <nav className="tienda-nav">
          <NavLink to="/tienda" end className={({ isActive }) => `nav-chip ${isActive ? 'nav-chip-active' : ''}`}>
            Catálogo
          </NavLink>
          <NavLink to="/tienda/carrito" className={({ isActive }) => `nav-chip ${isActive ? 'nav-chip-active' : ''}`}>
            Carrito
          </NavLink>
          <NavLink to="/tienda/pedidos" className={({ isActive }) => `nav-chip ${isActive ? 'nav-chip-active' : ''}`}>
            Mis pedidos
          </NavLink>
        </nav>
        <div className="tienda-user">
          <span title={user?.email}>{user?.nombreCompleto}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={cerrarSesion}>
            Salir
          </button>
        </div>
      </header>
      <main className="tienda-content">
        <Outlet />
      </main>
    </div>
  );
}
