import { useMemo, useState } from 'react';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../state/store';
import type { KPI } from '../engine/types';
import { VARIABLES_BASE } from '../engine/calculo';
import { evaluarFormula, validarFormula } from '../engine/formula';
import { nuevoId } from '../engine/cambios';
import { Campo, Chip, Encabezado, Modal, Punto, Tarjeta, fechaCorta, num } from '../ui';

export const textoMeta = (k: KPI) =>
  k.sentido === 'rango' ? `entre ${num(k.meta, 2)} y ${num(k.metaMax ?? k.meta, 2)}` : `${k.sentido === 'mayor' ? '≥' : '≤'} ${num(k.meta, 2)}`;

export function Sparkline({ valores, color = '#7a5cf5' }: { valores: number[]; color?: string }) {
  if (valores.length < 2) return <span className="muted peq">—</span>;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const w = 80, h = 22;
  const pts = valores.map((v, i) => `${(i / (valores.length - 1)) * w},${h - 2 - ((v - min) / (max - min || 1)) * (h - 4)}`).join(' ');
  return <svg width={w} height={h}><polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} /></svg>;
}

export function KPIs() {
  const { datos, calc, proyectoId, mutar, esAdmin } = useStore();
  const [cat, setCat] = useState<'proyecto' | 'cambio'>('proyecto');
  const [editando, setEditando] = useState<KPI | null>(null);
  const [detalle, setDetalle] = useState<string | null>(null);
  if (!calc) return null;
  const kpis = datos.kpis.filter((k) => k.proyectoId === proyectoId && k.categoria === cat);
  const historial = (id: string) => datos.mediciones.filter((m) => m.kpiId === id).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

  const registrarMedicion = () => {
    const fecha = calc.proyecto.fechaCorte;
    mutar((d) => {
      const nuevas = d.kpis
        .filter((k) => k.proyectoId === proyectoId)
        .map((k) => ({ k, v: calc.kpis.get(k.id)?.valor }))
        .filter((x) => x.v !== null && x.v !== undefined)
        .map(({ k, v }) => ({ id: nuevoId(), proyectoId, kpiId: k.id, fecha, valor: Math.round((v as number) * 100) / 100 }));
      const sinDuplicar = d.mediciones.filter((m) => !(m.fecha === fecha && nuevas.some((n) => n.kpiId === m.kpiId)));
      return { ...d, mediciones: [...sinDuplicar, ...nuevas] };
    }, `Medición de KPI registrada al ${fecha}`);
  };

  const nuevo = (): KPI => ({
    id: '', proyectoId, codigo: cat === 'proyecto' ? `KP${String(kpis.length + 1).padStart(2, '0')}` : `KC${String(kpis.length + 1).padStart(2, '0')}`, nombre: '', objetivo: '',
    ambito: cat === 'cambio' ? 'cambio' : 'proyecto', categoria: cat, formula: '', unidad: '%', meta: 0, metaMax: null, sentido: 'mayor', tolerancia: 0,
    periodicidad: 'Semanal', fuente: 'Cálculo automático del sistema', responsable: '', valorManual: null, hitoId: null, adicional: true, justificacion: '',
  });

  const k = detalle ? datos.kpis.find((x) => x.id === detalle) : null;

  return (
    <div>
      <Encabezado titulo="Administrador de KPI" sub="Indicadores configurables: variables, fórmula, meta, sentido, umbrales, periodicidad, historial y semáforo">
        {esAdmin && <button className="btn" onClick={registrarMedicion}><Save size={15} /> Registrar medición ({fechaCorta(calc.proyecto.fechaCorte)})</button>}
        {esAdmin && <button className="btn prim" onClick={() => setEditando(nuevo())}><Plus size={15} /> Nuevo KPI</button>}
      </Encabezado>
      <div className="pestanas">
        <button className={`pestana ${cat === 'proyecto' ? 'activa' : ''}`} onClick={() => setCat('proyecto')}>Proyecto e hitos ({datos.kpis.filter((x) => x.proyectoId === proyectoId && x.categoria === 'proyecto').length})</button>
        <button className={`pestana ${cat === 'cambio' ? 'activa' : ''}`} onClick={() => setCat('cambio')}>Gestión del cambio ({datos.kpis.filter((x) => x.proyectoId === proyectoId && x.categoria === 'cambio').length})</button>
      </div>
      <Tarjeta sinPadding>
        <table className="tabla">
          <thead>
            <tr><th>Código</th><th>Indicador</th><th>Fórmula</th><th className="num">Valor</th><th>Meta</th><th>Estado</th><th>Tendencia</th><th>Ámbito</th><th /></tr>
          </thead>
          <tbody>
            {kpis.map((x) => {
              const r = calc.kpis.get(x.id)!;
              const h = historial(x.id).map((m) => m.valor);
              if (r.valor !== null) h.push(r.valor);
              return (
                <tr key={x.id} className="clic" onClick={() => setDetalle(x.id)}>
                  <td><b>{x.codigo}</b></td>
                  <td>{x.nombre} {x.adicional && <Chip color="morado">Adicional</Chip>}<div className="peq muted">{x.objetivo}</div></td>
                  <td><code className="peq">{x.formula || 'Medición manual'}</code></td>
                  <td className="num"><b>{num(r.valor, 2)}</b> <span className="muted peq">{x.unidad}</span></td>
                  <td className="peq">{textoMeta(x)} <span className="muted">(tol. {num(x.tolerancia, 2)})</span></td>
                  <td>{r.error ? <Chip color="rojo">Error</Chip> : <span className="fila"><Punto s={r.semaforo} /> {r.semaforo}</span>}</td>
                  <td><Sparkline valores={h} /></td>
                  <td className="peq">{x.ambito}</td>
                  <td>{esAdmin && <button className="icono-btn" onClick={(e) => { e.stopPropagation(); setEditando(x); }}><Pencil size={14} /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Tarjeta>

      {k && (
        <Modal titulo={`${k.codigo} · ${k.nombre}`} onCerrar={() => setDetalle(null)} ancho={760}>
          <div className="grid g2">
            <div className="datos-calc">
              <span>Valor actual</span><b>{num(calc.kpis.get(k.id)?.valor, 2)} {k.unidad}</b>
              <span>Meta</span><b>{textoMeta(k)}</b>
              <span>Sentido</span><b>{k.sentido === 'mayor' ? 'Mayor es mejor' : k.sentido === 'menor' ? 'Menor es mejor' : 'Rango'}</b>
              <span>Tolerancia (amarillo)</span><b>{num(k.tolerancia, 2)}</b>
              <span>Periodicidad</span><b>{k.periodicidad}</b>
              <span>Fuente</span><b>{k.fuente}</b>
              <span>Responsable</span><b>{k.responsable || '—'}</b>
            </div>
            <div className="peq">
              <div><b>Objetivo:</b> {k.objetivo}</div>
              <div style={{ marginTop: 6 }}><b>Fórmula:</b> <code>{k.formula || 'medición manual'}</code></div>
              <div style={{ marginTop: 6 }}><b>Justificación:</b> {k.justificacion || '—'}</div>
            </div>
          </div>
          <div style={{ height: 220, marginTop: 14 }}>
            <ResponsiveContainer>
              <LineChart data={[...historial(k.id).map((m) => ({ fecha: fechaCorta(m.fecha), valor: m.valor })), { fecha: `${fechaCorta(calc.proyecto.fechaCorte)} (actual)`, valor: calc.kpis.get(k.id)?.valor }]}>
                <CartesianGrid stroke="#eef0f6" />
                <XAxis dataKey="fecha" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <ReferenceLine y={k.meta} stroke="#23946a" strokeDasharray="4 3" label={{ value: 'Meta', fontSize: 10, fill: '#23946a' }} />
                {k.sentido === 'rango' && k.metaMax !== null && <ReferenceLine y={k.metaMax} stroke="#23946a" strokeDasharray="4 3" />}
                <Line type="monotone" dataKey="valor" stroke="#7a5cf5" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Modal>
      )}
      {editando && <FormKPI kpi={editando} onCerrar={() => setEditando(null)} />}
    </div>
  );
}

function FormKPI({ kpi, onCerrar }: { kpi: KPI; onCerrar: () => void }) {
  const { datos, calc, mutar, proyectoId } = useStore();
  const [k, setK] = useState<KPI>(kpi);
  const variables = useMemo(() => {
    const extra = datos.hitos.filter((h) => h.proyectoId === proyectoId).flatMap((h) => [
      { nombre: `${h.codigo}_atraso_dias`, descripcion: `Atraso del hito ${h.codigo} (días hábiles)`, ambito: 'hito' as const },
      { nombre: `${h.codigo}_cumplido`, descripcion: `1 si el hito ${h.codigo} está cumplido`, ambito: 'hito' as const },
      { nombre: `${h.codigo}_avance`, descripcion: `Avance de las actividades del hito ${h.codigo} (%)`, ambito: 'hito' as const },
    ]);
    return [...VARIABLES_BASE, ...extra];
  }, [datos.hitos, proyectoId]);
  const errorFormula = k.formula.trim() ? validarFormula(k.formula, variables.map((v) => v.nombre)) : null;
  let vistaPrevia: number | null = null;
  try {
    vistaPrevia = k.formula.trim() && !errorFormula && calc ? evaluarFormula(k.formula, calc.variables) : k.valorManual;
  } catch {
    vistaPrevia = null;
  }
  const errores: string[] = [];
  if (!k.codigo.trim() || !k.nombre.trim()) errores.push('Código y nombre son obligatorios.');
  if (errorFormula) errores.push(`Fórmula no válida: ${errorFormula}`);
  if (!k.formula.trim() && k.valorManual === null) errores.push('Ingrese una fórmula o una medición manual.');
  if (k.sentido === 'rango' && (k.metaMax === null || k.metaMax < k.meta)) errores.push('En un rango, la meta máxima debe ser mayor o igual a la mínima.');
  if (datos.kpis.some((x) => x.id !== k.id && x.proyectoId === proyectoId && x.codigo === k.codigo)) errores.push('Ya existe un KPI con ese código.');

  const guardar = () => {
    if (errores.length) return;
    const nuevo = !k.id;
    const fila = nuevo ? { ...k, id: nuevoId() } : k;
    mutar((d) => ({ ...d, kpis: nuevo ? [...d.kpis, fila] : d.kpis.map((x) => (x.id === k.id ? fila : x)) }), nuevo ? `Nuevo KPI ${k.codigo}` : `Se actualizó el KPI ${k.codigo}`);
    onCerrar();
  };
  const eliminar = () => {
    if (!confirm('¿Eliminar este KPI y su historial?')) return;
    mutar((d) => ({ ...d, kpis: d.kpis.filter((x) => x.id !== k.id), mediciones: d.mediciones.filter((m) => m.kpiId !== k.id) }), `Se eliminó el KPI ${k.codigo}`);
    onCerrar();
  };
  const insertar = (nombre: string) => setK({ ...k, formula: (k.formula + ' ' + nombre).trim() });

  return (
    <Modal titulo={k.id ? `Editar KPI ${k.codigo}` : 'Nuevo KPI'} onCerrar={onCerrar} ancho={900}
      pie={<>{k.id && <button className="btn peligro" style={{ marginRight: 'auto' }} onClick={eliminar}><Trash2 size={14} /> Eliminar</button>}<button className="btn" onClick={onCerrar}>Cancelar</button><button className="btn prim" onClick={guardar} disabled={errores.length > 0}>Guardar</button></>}>
      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <div className="form f2">
          <Campo label="Código"><input value={k.codigo} onChange={(e) => setK({ ...k, codigo: e.target.value })} /></Campo>
          <Campo label="Nombre"><input value={k.nombre} onChange={(e) => setK({ ...k, nombre: e.target.value })} /></Campo>
          <Campo label="Objetivo (qué se mide)" className="ancho"><input value={k.objetivo} onChange={(e) => setK({ ...k, objetivo: e.target.value })} /></Campo>
          <Campo label="Categoría">
            <select value={k.categoria} onChange={(e) => setK({ ...k, categoria: e.target.value as KPI['categoria'] })}><option value="proyecto">Proyecto e hitos</option><option value="cambio">Gestión del cambio</option></select>
          </Campo>
          <Campo label="Ámbito">
            <select value={k.ambito} onChange={(e) => setK({ ...k, ambito: e.target.value as KPI['ambito'] })}>
              {['proyecto', 'etapa', 'actividad', 'hito', 'cambio'].map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Campo>
          <Campo label="Fórmula (vacía = medición manual)" className="ancho" error={errorFormula} ayuda={!errorFormula && k.formula ? `Vista previa con los datos actuales: ${num(vistaPrevia, 2)}` : 'Operadores: + - * / ( ) · funciones: min, max, abs, redondear, si'}>
            <input value={k.formula} onChange={(e) => setK({ ...k, formula: e.target.value })} style={{ fontFamily: 'monospace' }} />
          </Campo>
          {!k.formula.trim() && <Campo label="Medición manual" className="ancho"><input type="number" value={k.valorManual ?? ''} onChange={(e) => setK({ ...k, valorManual: e.target.value === '' ? null : Number(e.target.value) })} /></Campo>}
          <Campo label="Unidad"><input value={k.unidad} onChange={(e) => setK({ ...k, unidad: e.target.value })} placeholder="%, días, horas, $…" /></Campo>
          <Campo label="Sentido">
            <select value={k.sentido} onChange={(e) => setK({ ...k, sentido: e.target.value as KPI['sentido'], metaMax: e.target.value === 'rango' ? k.metaMax ?? k.meta : null })}>
              <option value="mayor">Mayor es mejor</option><option value="menor">Menor es mejor</option><option value="rango">Rango</option>
            </select>
          </Campo>
          <Campo label={k.sentido === 'rango' ? 'Meta mínima' : 'Meta'}><input type="number" value={k.meta} onChange={(e) => setK({ ...k, meta: Number(e.target.value) })} /></Campo>
          {k.sentido === 'rango' ? <Campo label="Meta máxima"><input type="number" value={k.metaMax ?? ''} onChange={(e) => setK({ ...k, metaMax: Number(e.target.value) })} /></Campo> : <div />}
          <Campo label="Tolerancia (umbral amarillo)" ayuda="Fuera de meta pero dentro de este margen = amarillo; más allá = rojo"><input type="number" value={k.tolerancia} onChange={(e) => setK({ ...k, tolerancia: Number(e.target.value) })} /></Campo>
          <Campo label="Periodicidad"><select value={k.periodicidad} onChange={(e) => setK({ ...k, periodicidad: e.target.value })}>{['Diaria', 'Semanal', 'Quincenal', 'Mensual', 'Por hito'].map((p) => <option key={p}>{p}</option>)}</select></Campo>
          <Campo label="Fuente"><input value={k.fuente} onChange={(e) => setK({ ...k, fuente: e.target.value })} /></Campo>
          <Campo label="Responsable"><input value={k.responsable} onChange={(e) => setK({ ...k, responsable: e.target.value })} /></Campo>
          <Campo label="Hito asociado">
            <select value={k.hitoId ?? ''} onChange={(e) => setK({ ...k, hitoId: e.target.value || null })}>
              <option value="">— Ninguno —</option>
              {datos.hitos.filter((h) => h.proyectoId === proyectoId).map((h) => <option key={h.id} value={h.id}>{h.codigo} {h.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Justificación de la meta y umbrales" className="ancho"><textarea value={k.justificacion} onChange={(e) => setK({ ...k, justificacion: e.target.value })} /></Campo>
          <label className="fila ancho peq"><input type="checkbox" checked={k.adicional} onChange={(e) => setK({ ...k, adicional: e.target.checked })} /> KPI adicional definido por el equipo</label>
        </div>
        <div>
          <div className="peq muted" style={{ marginBottom: 6 }}>Variables disponibles (clic para insertar)</div>
          <div style={{ maxHeight: 520, overflow: 'auto', border: '1px solid var(--line2)', borderRadius: 8 }}>
            <table className="tabla" style={{ fontSize: 11.5 }}>
              <tbody>
                {variables.map((v) => (
                  <tr key={v.nombre} className="clic" onClick={() => insertar(v.nombre)}>
                    <td><code>{v.nombre}</code><div className="muted">{v.descripcion}</div></td>
                    <td className="num">{num(calc?.variables[v.nombre] ?? null, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {errores.length > 0 && <div className="alerta alta" style={{ marginTop: 10 }}>{errores.join(' ')}</div>}
    </Modal>
  );
}
