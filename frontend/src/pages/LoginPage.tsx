import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Field } from '../components/ui';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (user) navigate(user.role === 'COMPRADOR' ? '/tienda' : '/', { replace: true });
  }, [user, navigate]);

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const correo = email.trim();
    if (!correo) {
      setError('Ingresa tu correo electrónico.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }
    if (!password) {
      setError('Ingresa tu contraseña.');
      return;
    }

    setGuardando(true);
    try {
      await login(correo, password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Sistema EPP</h1>
        <p>Ingresa con tu cuenta para continuar.</p>
        <form onSubmit={enviar} noValidate>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <Field label="Correo electrónico">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="usuario@epp.com"
              autoComplete="username"
              disabled={guardando}
            />
          </Field>
          <Field label="Contraseña">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Contraseña"
              autoComplete="current-password"
              disabled={guardando}
            />
          </Field>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={guardando}>
            {guardando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        <div className="auth-demo">
          <div>
            ¿No tienes cuenta? <Link to="/registro" className="strong">Registrarme como comprador</Link>
          </div>
          <div className="strong" style={{ marginTop: 12 }}>Cuentas de demostración</div>
          <div>
            Administrador: <code>admin@epp.com</code>
          </div>
          <div>
            Vendedor: <code>vendedor@epp.com</code>
          </div>
          <div>
            Almacén: <code>almacen@epp.com</code>
          </div>
          <div>
            Comprador: <code>comprador@epp.com</code>
          </div>
          <div>
            Contraseña: <code>Clave123!</code>
          </div>
        </div>
      </div>
    </div>
  );
}
