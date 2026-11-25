import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Field, esTelefonoValido, soloDigitos } from '../components/ui';

interface Formulario {
  nombreCompleto: string;
  email: string;
  tipoDocumento: 'NIT' | 'CI';
  nitCi: string;
  telefono: string;
  direccion: string;
  password: string;
  confirmacion: string;
}

const VACIO: Formulario = {
  nombreCompleto: '',
  email: '',
  tipoDocumento: 'NIT',
  nitCi: '',
  telefono: '',
  direccion: '',
  password: '',
  confirmacion: '',
};

export default function RegistroPage() {
  const { user, registrar } = useAuth();
  const navigate = useNavigate();
  const [formulario, setFormulario] = useState<Formulario>(VACIO);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (user) navigate(user.role === 'COMPRADOR' ? '/tienda' : '/', { replace: true });
  }, [user, navigate]);

  const actualizar = (campo: keyof Formulario, valor: string) => {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  };

  const validar = (): string => {
    const { nombreCompleto, email, tipoDocumento, nitCi, telefono, direccion, password, confirmacion } = formulario;
    if (nombreCompleto.trim().length < 3) return 'Ingresa tu nombre completo (mínimo 3 caracteres).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Ingresa un correo electrónico válido.';
    if (nitCi.trim().length < 5 || nitCi.trim().length > 30) return 'El documento debe tener entre 5 y 30 caracteres.';
    if (tipoDocumento === 'NIT' && !/^\d+$/.test(nitCi.trim())) return 'El NIT solo debe contener números.';
    if (tipoDocumento === 'CI' && !/^[A-Za-z0-9]+$/.test(nitCi.trim())) {
      return 'La CI solo debe contener números y letras.';
    }
    if (telefono.trim() && !esTelefonoValido(telefono)) return 'El celular solo debe contener números (7 a 15 dígitos).';
    if (direccion.trim().length > 255) return 'La dirección es demasiado larga.';
    if (password.length < 8 || password.length > 72) return 'La contraseña debe tener entre 8 y 72 caracteres.';
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      return 'La contraseña debe incluir mayúscula, minúscula y número.';
    }
    if (password !== confirmacion) return 'Las contraseñas no coinciden.';
    return '';
  };

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const mensaje = validar();
    if (mensaje) {
      setError(mensaje);
      return;
    }

    setGuardando(true);
    try {
      await registrar({
        nombreCompleto: formulario.nombreCompleto.trim(),
        email: formulario.email.trim().toLowerCase(),
        tipoDocumento: formulario.tipoDocumento,
        nitCi: formulario.nitCi.trim(),
        telefono: formulario.telefono.trim() || undefined,
        direccion: formulario.direccion.trim() || undefined,
        password: formulario.password,
      });
      navigate('/tienda', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <h1>Crear cuenta de comprador</h1>
        <p>Regístrate para comprar equipos de seguridad con seguimiento de tus pedidos.</p>
        <form onSubmit={enviar} noValidate>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <div className="form-grid">
            <Field label="Nombre completo" className="full">
              <input
                value={formulario.nombreCompleto}
                onChange={(event) => actualizar('nombreCompleto', event.target.value)}
                placeholder="Nombre y apellido o razón social"
                autoComplete="name"
                disabled={guardando}
              />
            </Field>
            <Field label="Correo electrónico">
              <input
                type="email"
                value={formulario.email}
                onChange={(event) => actualizar('email', event.target.value)}
                placeholder="comprador@empresa.com"
                autoComplete="username"
                disabled={guardando}
              />
            </Field>
            <Field label="Tipo de documento">
              <select
                value={formulario.tipoDocumento}
                onChange={(event) => {
                  const tipoDocumento = event.target.value as 'NIT' | 'CI';
                  setFormulario((actual) => ({ ...actual, tipoDocumento, nitCi: '' }));
                }}
                disabled={guardando}
              >
                <option value="NIT">NIT</option>
                <option value="CI">CI</option>
              </select>
            </Field>
            <Field label={formulario.tipoDocumento === 'NIT' ? 'NIT' : 'CI'}>
              <input
                value={formulario.nitCi}
                onChange={(event) =>
                  actualizar(
                    'nitCi',
                    formulario.tipoDocumento === 'NIT'
                      ? event.target.value.replace(/\D/g, '')
                      : event.target.value.replace(/[^A-Za-z0-9]/g, ''),
                  )
                }
                inputMode={formulario.tipoDocumento === 'NIT' ? 'numeric' : 'text'}
                maxLength={30}
                placeholder={formulario.tipoDocumento === 'NIT' ? '123456789' : 'AB123456'}
                disabled={guardando}
              />
            </Field>
            <Field label="Teléfono (opcional)">
              <input
                value={formulario.telefono}
                onChange={(event) => actualizar('telefono', soloDigitos(event.target.value))}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={15}
                placeholder="70000000"
                disabled={guardando}
              />
            </Field>
            <Field label="Dirección (opcional)">
              <input
                value={formulario.direccion}
                onChange={(event) => actualizar('direccion', event.target.value)}
                placeholder="Av. Industrial 123"
                disabled={guardando}
              />
            </Field>
            <Field label="Contraseña" hint="Mínimo 8 caracteres, mayúscula, minúscula y número">
              <input
                type="password"
                value={formulario.password}
                onChange={(event) => actualizar('password', event.target.value)}
                autoComplete="new-password"
                disabled={guardando}
              />
            </Field>
            <Field label="Confirmar contraseña">
              <input
                type="password"
                value={formulario.confirmacion}
                onChange={(event) => actualizar('confirmacion', event.target.value)}
                autoComplete="new-password"
                disabled={guardando}
              />
            </Field>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 18 }} disabled={guardando}>
            {guardando ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>
        <div className="auth-demo">
          ¿Ya tienes cuenta? <Link to="/login" className="strong">Inicia sesión</Link>
        </div>
      </div>
    </div>
  );
}
