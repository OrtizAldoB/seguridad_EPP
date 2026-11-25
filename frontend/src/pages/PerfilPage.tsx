import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Card, Field, PageHeader } from '../components/ui';

export default function PerfilPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  if (!user) return null;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setOk('');
    if (!currentPassword) return setError('Ingresa tu contraseña actual.');
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPassword)) {
      return setError('La nueva contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.');
    }
    if (newPassword !== confirmPassword) return setError('Las contraseñas no coinciden.');
    setSaving(true);
    try {
      await api(`/usuarios/${user.id}/password`, {
        method: 'PATCH',
        body: { currentPassword, newPassword },
      });
      setOk('Contraseña actualizada. Debes iniciar sesión nuevamente en otros dispositivos.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Mi perfil" subtitle="Información de tu cuenta y cambio de contraseña." />
      <div className="grid-2">
        <Card>
          <div className="card-head"><h2>Datos de cuenta</h2></div>
          <div className="stack" style={{ gap: 10 }}>
            <div><span className="muted">Nombre:</span> <span className="strong">{user.nombreCompleto}</span></div>
            <div><span className="muted">Correo:</span> {user.email}</div>
            <div><span className="muted">Rol:</span> {user.roleNombre}</div>
            <div><span className="muted">Estado:</span> {user.activo ? 'Activo' : 'Inactivo'}</div>
          </div>
        </Card>
        <Card>
          <div className="card-head"><h2>Cambiar contraseña</h2></div>
          <form onSubmit={submit}>
            {error && <div className="notice notice-warn" role="alert">{error}</div>}
            {ok && <div className="notice notice-ok" role="status">{ok}</div>}
            <div className="stack" style={{ gap: 12 }}>
              <Field label="Contraseña actual">
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" disabled={saving} />
              </Field>
              <Field label="Nueva contraseña" hint="Mínimo 8 caracteres, con mayúscula, minúscula y número.">
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" disabled={saving} />
              </Field>
              <Field label="Confirmar nueva contraseña">
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" disabled={saving} />
              </Field>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Actualizar contraseña'}</button>
          </div>
        </form>
        </Card>
      </div>
    </>
  );
}
