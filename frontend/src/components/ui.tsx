import type { ReactNode } from 'react';

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'purple';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="page-header-actions">{action}</div>}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`.trim()}>{children}</section>;
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function StockBadge({ semaforo }: { semaforo: string }) {
  const tone: Tone = semaforo === 'VERDE' ? 'green' : semaforo === 'AMARILLO' ? 'amber' : 'red';
  return <Badge tone={tone}>{semaforo}</Badge>;
}

const ESTADO_TONES: Record<string, Tone> = {
  BORRADOR: 'gray',
  ENVIADA: 'blue',
  ACEPTADA: 'green',
  VENCIDA: 'red',
  CONVERTIDA: 'purple',
  RECHAZADA: 'red',
  PENDIENTE_APROBACION: 'amber',
  REGISTRADO: 'blue',
  EN_PREPARACION: 'blue',
  DESPACHADO: 'purple',
  ENTREGADO: 'green',
  CANCELADO: 'red',
  ACTIVO: 'green',
  INACTIVO: 'gray',
  PENDIENTE: 'amber',
  APROBADA: 'green',
  APROBADO: 'green',
  RECHAZADO: 'red',
};

export function EstadoBadge({ estado }: { estado: string }) {
  return <Badge tone={ESTADO_TONES[estado] ?? 'gray'}>{estado.replaceAll('_', ' ')}</Badge>;
}

export function Loading({ label = 'Cargando...' }: { label?: string }) {
  return (
    <div className="state-box">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-box state-error" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message = 'No hay datos para mostrar.' }: { message?: string }) {
  return <div className="state-box">{message}</div>;
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className={`modal ${wide ? 'modal-wide' : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total?: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1 && !total) return null;
  return (
    <div className="pagination">
      <span>
        Página {page} de {Math.max(totalPages, 1)}
        {total !== undefined ? ` · ${total} registros` : ''}
      </span>
      <div className="pagination-actions">
        <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Anterior
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  className = '',
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`field ${className}`.trim()}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'blue',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <Card className={`stat-card stat-${tone}`}>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </Card>
  );
}

export function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  if (items.length === 0) return <EmptyState />;
  return (
    <div className="bar-list">
      {items.map((item) => (
        <div className="bar-row" key={item.label}>
          <span className="bar-label" title={item.label}>{item.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
          </div>
          <span className="bar-value">{money(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

export const money = (value: number | string | null | undefined): string =>
  new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 2,
  }).format(Number(value ?? 0));

export const numberFormat = (value: number | string | null | undefined): string =>
  new Intl.NumberFormat('es-BO').format(Number(value ?? 0));

export function hoyIso(): string {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
}

export const soloDigitos = (valor: string): string => valor.replace(/\D/g, '');

export const esTelefonoValido = (valor: string): boolean => /^\d{7,15}$/.test(valor.trim());

export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-BO');
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-BO');
}
