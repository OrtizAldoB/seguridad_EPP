import { Link } from 'react-router-dom';
import { Card, PageHeader } from '../components/ui';

export default function SinAccesoPage() {
  return (
    <>
      <PageHeader title="Sin acceso" subtitle="Tu perfil no tiene permisos para esta sección." />
      <Card>
        <p className="muted">Solicita a un administrador los permisos necesarios o vuelve al panel general.</p>
        <div className="form-actions">
          <Link className="btn btn-primary" to="/">Volver al panel</Link>
        </div>
      </Card>
    </>
  );
}
