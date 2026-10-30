import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import type { Semaforo } from './engine/calculo';

export const pesos = (n: number | null | undefined) => (n === null || n === undefined || Number.isNaN(n) ? '—' : '$' + Math.round(n).toLocaleString('es-CL'));
export const millones = (n: number) => '$' + (n / 1_000_000).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + 'M';
export const num = (n: number | null | undefined, dec = 1) => (n === null || n === undefined || Number.isNaN(n) ? '—' : n.toLocaleString('es-CL', { maximumFractionDigits: dec, minimumFractionDigits: 0 }));
export const fecha = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
};
export const fechaCorta = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${meses[Number(m) - 1]}`;
};

export function Tarjeta({ titulo, derecha, children, className = '', sinPadding = false }: { titulo?: ReactNode; derecha?: ReactNode; children: ReactNode; className?: string; sinPadding?: boolean }) {
  return (
    <div className={`tarjeta ${className}`}>
      {titulo && (
        <div className="cab">
          <h3>{titulo}</h3>
          {derecha && <div className="derecha">{derecha}</div>}
        </div>
      )}
      {sinPadding ? children : <div className="cuerpo">{children}</div>}
    </div>
  );
}

export function Chip({ color, children }: { color?: string; children: ReactNode }) {
  return <span className={`chip ${color ?? ''}`}>{children}</span>;
}

export function Punto({ s }: { s: Semaforo }) {
  return <span className={`punto ${s}`} />;
}

export function Campo({ label, children, ayuda, error, className = '' }: { label: string; children: ReactNode; ayuda?: string; error?: string | null; className?: string }) {
  return (
    <div className={`campo ${className}`}>
      <label>{label}</label>
      {children}
      {ayuda && <span className="ayuda">{ayuda}</span>}
      {error && <span className="error">{error}</span>}
    </div>
  );
}

export function Modal({ titulo, onCerrar, children, pie, ancho }: { titulo: ReactNode; onCerrar: () => void; children: ReactNode; pie?: ReactNode; ancho?: number }) {
  return (
    <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal" style={ancho ? { width: `min(${ancho}px, 100%)` } : undefined}>
        <div className="cab">
          <h3>{titulo}</h3>
          <button className="icono-btn" style={{ marginLeft: 'auto' }} onClick={onCerrar} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="cuerpo">{children}</div>
        {pie && <div className="pie">{pie}</div>}
      </div>
    </div>
  );
}

export function BarraProgreso({ valor, color }: { valor: number; color?: string }) {
  return (
    <div className="barra-prog">
      <div style={{ width: `${Math.max(0, Math.min(100, valor))}%`, background: color }} />
    </div>
  );
}

export const colorSemaforo: Record<Semaforo, string> = { verde: '#23946a', amarillo: '#d98a1c', rojo: '#e5484d', gris: '#9aa1b5' };

export function colorEstadoHito(e: string): string {
  if (e === 'Cumplido en plazo') return 'verde';
  if (e === 'Cumplido con atraso' || e === 'En riesgo') return 'amarillo';
  if (e === 'Vencido') return 'rojo';
  return 'azul';
}

export function colorEstadoCambio(e: string): string {
  return ({ Abierto: 'azul', 'En evaluación': 'morado', Aprobado: 'verde', Rechazado: 'rojo', 'En implementación': 'amarillo', Cerrado: '' } as Record<string, string>)[e] ?? '';
}

export function Encabezado({ titulo, sub, children }: { titulo: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="encabezado">
      <div>
        <h1>{titulo}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="acciones">{children}</div>}
    </div>
  );
}
