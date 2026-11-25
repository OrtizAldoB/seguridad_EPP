import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import TiendaLayout from './components/TiendaLayout';
import LoginPage from './pages/LoginPage';
import RegistroPage from './pages/RegistroPage';
import TiendaPage from './pages/TiendaPage';
import CarritoPage from './pages/CarritoPage';
import MisPedidosPage from './pages/MisPedidosPage';
import DashboardPage from './pages/DashboardPage';
import ClientesPage from './pages/ClientesPage';
import ProductosPage from './pages/ProductosPage';
import CotizacionesPage from './pages/CotizacionesPage';
import PedidosPage from './pages/PedidosPage';
import KardexPage from './pages/KardexPage';
import AprobacionesPage from './pages/AprobacionesPage';
import AlmacenPage from './pages/AlmacenPage';
import ReportesPage from './pages/ReportesPage';
import UsuariosPage from './pages/UsuariosPage';
import PerfilPage from './pages/PerfilPage';
import ProveedoresPage from './pages/ProveedoresPage';
import ComprasPage from './pages/ComprasPage';
import SolicitudesPage from './pages/SolicitudesPage';
import SinAccesoPage from './pages/SinAccesoPage';

const ROLES_INTERNOS = ['ADMINISTRADOR', 'VENDEDOR', 'ALMACENERO'] as const;

function Inicio() {
  const { user } = useAuth();
  if (user?.role === 'COMPRADOR') return <Navigate to="/tienda" replace />;
  return <DashboardPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegistroPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<ProtectedRoute permiso="tienda.comprar" />}>
              <Route path="/tienda" element={<TiendaLayout />}>
                <Route index element={<TiendaPage />} />
                <Route path="carrito" element={<CarritoPage />} />
                <Route path="pedidos" element={<MisPedidosPage />} />
              </Route>
            </Route>
            <Route element={<Layout />}>
              <Route index element={<Inicio />} />
              <Route path="sin-acceso" element={<SinAccesoPage />} />
              <Route path="perfil" element={<PerfilPage />} />
              <Route element={<ProtectedRoute roles={[...ROLES_INTERNOS]} />}>
                <Route element={<ProtectedRoute permiso="clientes.leer" />}>
                  <Route path="clientes" element={<ClientesPage />} />
                </Route>
                <Route element={<ProtectedRoute permiso="productos.leer" />}>
                  <Route path="productos" element={<ProductosPage />} />
                </Route>
                <Route element={<ProtectedRoute permiso="proveedores.leer" />}>
                  <Route path="proveedores" element={<ProveedoresPage />} />
                </Route>
                <Route element={<ProtectedRoute permiso="compras.leer" />}>
                  <Route path="compras" element={<ComprasPage />} />
                </Route>
                <Route element={<ProtectedRoute permiso="solicitudes.leer" />}>
                  <Route path="solicitudes-compra" element={<SolicitudesPage />} />
                </Route>
                <Route element={<ProtectedRoute permiso="cotizaciones.leer" />}>
                  <Route path="cotizaciones" element={<CotizacionesPage />} />
                </Route>
                <Route element={<ProtectedRoute permiso="pedidos.leer" />}>
                  <Route element={<ProtectedRoute roles={['ADMINISTRADOR', 'VENDEDOR']} />}>
                    <Route path="pedidos" element={<PedidosPage />} />
                  </Route>
                  <Route path="almacen" element={<AlmacenPage />} />
                </Route>
                <Route element={<ProtectedRoute permiso="inventario.leer" />}>
                  <Route path="kardex" element={<KardexPage />} />
                </Route>
                <Route element={<ProtectedRoute permiso="aprobaciones.leer" />}>
                  <Route path="aprobaciones" element={<AprobacionesPage />} />
                </Route>
                <Route element={<ProtectedRoute permiso="reportes.leer" />}>
                  <Route path="reportes" element={<ReportesPage />} />
                </Route>
                <Route element={<ProtectedRoute permiso="usuarios.leer" />}>
                  <Route path="usuarios" element={<UsuariosPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
