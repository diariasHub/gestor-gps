import { useState } from 'react';
import { CheckCircle2, Flag, Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../state/store';
import type { Hito } from '../engine/types';
import { nuevoId } from '../engine/cambios';
import { BarraProgreso, Campo, Chip, Encabezado, Modal, Tarjeta, colorEstadoHito, fecha, num } from '../ui';

export function Hitos() {
  const { datos, calc, proyectoId, mutar, esAdmin } = useStore();
  const [editando, setEditando] = useState<Hito | null>(null);
  if (!calc) return null;
  const hitos = datos.hitos.filter((h) => h.proyectoId === proyectoId);
  const kpis = datos.kpis.filter((k) => k.proyectoId === proyectoId);
  const kpiDe = (h: Hito) => kpis.filter((k) => k.hitoId === h.id || k.formula.includes(`${h.codigo}_`) || k.formula.includes('hitos_'));
  const cumplidos = hitos.filter((h) => calc.hitos.get(h.id)?.completado).length;

  return (
    <div>
      <Encabezado titulo="Hitos y logro" sub={`${cumplidos} de ${hitos.length} hitos cumplidos · el estado se calcula desde las actividades asociadas, los criterios de aceptación y la fecha comprometida`}>
        {esAdmin && <button className="btn prim" onClick={() => setEditando({ id: '', proyectoId, codigo: `H${hitos.length + 1}`, nombre: '', descripcion: '', responsable: '', fechaComprometida: calc.proyecto.fechaTerminoPlan, fechaReal: null, criterios: '', evidencia: '', aceptado: false, actividadIds: [] })}><Plus size={15} /> Nuevo hito</button>}
      </Encabezado>

      <div className="grid g3">
        {hitos.map((h) => {
          const e = calc.hitos.get(h.id)!;
          return (
            <Tarjeta key={h.id} titulo={<span className="fila"><Flag size={15} color="var(--brand)" />{h.codigo} · {h.nombre}</span>} derecha={<Chip color={colorEstadoHito(e.estado)}>{e.estado}</Chip>}>
              <div className="datos-calc" style={{ marginBottom: 10 }}>
                <span>Comprometida</span><b>{fecha(h.fechaComprometida)}</b>
                <span>{e.completado ? 'Fecha real' : 'Pronosticada'}</span><b>{fecha(e.fechaRealEfectiva ?? e.fechaPronosticada)}</b>
                <span>Desviación</span><b style={{ color: e.atrasoDias > 0 ? 'var(--crit)' : 'var(--ok)' }}>{e.atrasoDias > 0 ? '+' : ''}{e.atrasoDias} días hábiles</b>
                <span>Responsable</span><b>{h.responsable || '—'}</b>
              </div>
              <div className="peq muted" style={{ marginBottom: 4 }}>Asociaciones de cumplimiento ({num(e.avance, 0)} %)</div>
              {h.actividadIds.map((id) => {
                const a = datos.actividades.find((x) => x.id === id);
                if (!a) return null;
                const av = calc.avance.get(id) ?? 0;
                return (
                  <div key={id} style={{ marginBottom: 6 }}>
                    <div className="fila peq"><span>{a.codigo} {a.nombre}</span><span style={{ marginLeft: 'auto' }}>{Math.round(av)} %</span></div>
                    <BarraProgreso valor={av} color={calc.atrasadas.has(id) ? 'var(--crit)' : av >= 100 ? 'var(--ok)' : undefined} />
                  </div>
                );
              })}
              <div className="fila peq" style={{ marginTop: 8 }}>
                {h.aceptado ? <><CheckCircle2 size={14} color="var(--ok)" /> Criterios aceptados</> : <span className="muted">Criterios pendientes de aceptación</span>}
              </div>
              <div className="peq muted" style={{ marginTop: 4 }}><b>Criterios:</b> {h.criterios || '—'}</div>
              {h.evidencia && <div className="peq muted"><b>Evidencia:</b> {h.evidencia}</div>}
              <div className="fila wrap" style={{ marginTop: 8 }}>
                {kpiDe(h).slice(0, 3).map((k) => {
                  const r = calc.kpis.get(k.id)!;
                  return <Chip key={k.id} color={r.semaforo === 'gris' ? '' : r.semaforo}>{k.codigo} {num(r.valor)} {k.unidad}</Chip>;
                })}
              </div>
              {esAdmin && (
                <div className="fila" style={{ marginTop: 10 }}>
                  <button className="btn chico" onClick={() => setEditando(h)}><Pencil size={13} /> Editar</button>
                  {!h.aceptado && e.avance >= 99.99 && <button className="btn chico ok" onClick={() => mutar((d) => ({ ...d, hitos: d.hitos.map((x) => (x.id === h.id ? { ...x, aceptado: true, fechaReal: x.fechaReal ?? calc.proyecto.fechaCorte, evidencia: x.evidencia || 'Acta de aceptación registrada' } : x)) }), `Hito ${h.codigo} aceptado`)}>Aceptar hito</button>}
                </div>
              )}
            </Tarjeta>
          );
        })}
      </div>
      {editando && <FormHito hito={editando} onCerrar={() => setEditando(null)} />}
    </div>
  );
}

function FormHito({ hito, onCerrar }: { hito: Hito; onCerrar: () => void }) {
  const { datos, calc, mutar } = useStore();
  const [h, setH] = useState<Hito>(hito);
  if (!calc) return null;
  const hojas = calc.prog.hojas;
  const errores: string[] = [];
  if (!h.nombre.trim()) errores.push('El nombre es obligatorio.');
  if (!h.fechaComprometida) errores.push('La fecha comprometida es obligatoria.');
  if (!h.actividadIds.length) errores.push('Asocie al menos una actividad.');
  if (h.aceptado && !h.evidencia.trim()) errores.push('Para aceptar el hito registre la evidencia.');
  const guardar = () => {
    if (errores.length) return;
    const nuevo = !h.id;
    const fila = nuevo ? { ...h, id: nuevoId() } : h;
    mutar((d) => ({ ...d, hitos: nuevo ? [...d.hitos, fila] : d.hitos.map((x) => (x.id === h.id ? fila : x)) }), nuevo ? `Nuevo hito ${h.codigo}` : `Se actualizó el hito ${h.codigo}`);
    onCerrar();
  };
  const eliminar = () => {
    if (!confirm('¿Eliminar este hito?')) return;
    mutar((d) => ({ ...d, hitos: d.hitos.filter((x) => x.id !== h.id), kpis: d.kpis.map((k) => (k.hitoId === h.id ? { ...k, hitoId: null } : k)) }), `Se eliminó el hito ${h.codigo}`);
    onCerrar();
  };
  return (
    <Modal titulo={h.id ? `Editar hito ${h.codigo}` : 'Nuevo hito'} onCerrar={onCerrar} ancho={720}
      pie={<>{h.id && <button className="btn peligro" style={{ marginRight: 'auto' }} onClick={eliminar}><Trash2 size={14} /> Eliminar</button>}<button className="btn" onClick={onCerrar}>Cancelar</button><button className="btn prim" onClick={guardar} disabled={errores.length > 0}>Guardar</button></>}>
      <div className="form f3">
        <Campo label="Identificador"><input value={h.codigo} onChange={(e) => setH({ ...h, codigo: e.target.value })} /></Campo>
        <Campo label="Nombre" className="ancho"><input value={h.nombre} onChange={(e) => setH({ ...h, nombre: e.target.value, descripcion: e.target.value })} /></Campo>
        <Campo label="Responsable"><input value={h.responsable} onChange={(e) => setH({ ...h, responsable: e.target.value })} /></Campo>
        <Campo label="Fecha comprometida"><input type="date" value={h.fechaComprometida} onChange={(e) => setH({ ...h, fechaComprometida: e.target.value })} /></Campo>
        <Campo label="Fecha real"><input type="date" value={h.fechaReal ?? ''} onChange={(e) => setH({ ...h, fechaReal: e.target.value || null })} /></Campo>
        <Campo label="Criterios de aceptación" className="ancho"><textarea value={h.criterios} onChange={(e) => setH({ ...h, criterios: e.target.value })} /></Campo>
        <Campo label="Evidencia" className="ancho"><input value={h.evidencia} onChange={(e) => setH({ ...h, evidencia: e.target.value })} placeholder="Acta, informe, enlace…" /></Campo>
        <label className="fila ancho"><input type="checkbox" checked={h.aceptado} onChange={(e) => setH({ ...h, aceptado: e.target.checked })} /> Criterios de aceptación cumplidos (el hito se cumple cuando además sus actividades llegan al 100 %)</label>
      </div>
      <div className="sep" />
      <div className="peq muted" style={{ marginBottom: 6 }}>Actividades asociadas (asociaciones de cumplimiento)</div>
      <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--line2)', borderRadius: 8, padding: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {hojas.map((a) => (
          <label key={a.id} className="fila peq">
            <input type="checkbox" checked={h.actividadIds.includes(a.id)} onChange={(e) => setH({ ...h, actividadIds: e.target.checked ? [...h.actividadIds, a.id] : h.actividadIds.filter((x) => x !== a.id) })} />
            {a.codigo} {a.nombre}
          </label>
        ))}
      </div>
      {errores.map((e) => <div key={e} className="alerta alta" style={{ marginTop: 6 }}>{e}</div>)}
      <div className="peq muted" style={{ marginTop: 6 }}>{datos.kpis.filter((k) => k.hitoId === h.id).length} KPI asociado(s) a este hito.</div>
    </Modal>
  );
}
