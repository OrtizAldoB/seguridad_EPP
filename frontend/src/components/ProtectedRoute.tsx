import { Navigate, Outlet } from 'react-router-dom';
import type { AuthUser } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Loading } from './ui';

export default function ProtectedRoute({
  permiso,
  roles,
}: {
  permiso?: string;
  roles?: AuthUser['role'][];
}) {
  const { user, loading, hasPermiso, hasRole } = useAuth();

  if (loading) return <Loading label="Verificando sesión..." />
  if (!user) return <Navigate to="/login" replace />;
  if (permiso && !hasPermiso(permiso)) return <Navigate to="/sin-acceso" replace />;
  if (roles && !hasRole(...roles)) return <Navigate to="/sin-acceso" replace />;

  return <Outlet />;
}
