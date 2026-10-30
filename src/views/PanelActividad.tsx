import { useEffect, useState } from 'react';
import { Trash2, X, Link2, Users } from 'lucide-react';
import { useStore } from '../state/store';
import type { Actividad, Datos, TipoDep } from '../engine/types';
import { TIPOS_RECURSO } from '../engine/types';
import { generaCiclo } from '../engine/programacion';
import { nuevoId } from '../engine/cambios';
import { Campo, Chip, BarraProgreso, fecha, num, pesos } from '../ui';

const TIPOS_DEP: { v: TipoDep; t: string }[] = [
  { v: 'FS', t: 'FS · Fin a Inicio' },
  { v: 'SS', t: 'SS · Inicio a Inicio' },
  { v: 'FF', t: 'FF · Fin a Fin' },
  { v: 'SF', t: 'SF · Inicio a Fin' },
];

/** Campo de texto o número que se confirma al salir o con Enter (evita recalcular en cada tecla). */
function Editable({ valor, onConfirmar, tipo = 'text', deshabilitado, min, max }: { valor: string | number; onConfirmar: (v: string) => void; tipo?: string; deshabilitado?: boolean; min?: number; max?: number }) {
  const [v, setV] = useState(String(valor ?? ''));
  useEffect(() => setV(String(valor ?? '')), [valor]);
  const confirmar = () => {
    if (v !== String(valor ?? '')) onConfirmar(v);
  };
  return (
    <input
      type={tipo}
      value={v}
      min={min}
      max={max}
      disabled={deshabilitado}
      onChange={(e) => setV(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function PanelActividad({ id, onCerrar }: { id: string; onCerrar: () => void }) {
  const { datos, calc, mutar, esAdmin, proyectoId } = useStore();
  const [errorDep, setErrorDep] = useState<string | null>(null);
  const [nuevaDep, setNuevaDep] = useState<{ predId: string; tipo: TipoDep; desfase: number }>({ predId: '', tipo: 'FS', desfase: 0 });
  const [nuevaAsig, setNuevaAsig] = useState<{ recursoId: string; valor: number }>({ recursoId: '', valor: 0 });
  const a = datos.actividades.find((x) => x.id === id);
  if (!a || !calc) return null;
  const prog = calc.prog.porId.get(id);
  const esHoja = !calc.prog.hijos.has(id);
  const lb = calc.lineaBase?.actividades[id];
  const editarPlan = esAdmin;

  const set = (cambios: Partial<Actividad>, titulo: string) =>
    mutar((d) => ({ ...d, actividades: d.actividades.map((x) => (x.id === id ? { ...x, ...cambios } : x)) }), titulo);

  const deps = datos.dependencias.filter((d) => d.sucId === id);
  const sucesoras = datos.dependencias.filter((d) => d.predId === id);
  const hojas = calc.prog.hojas.filter((h) => h.id !== id);
  const asignaciones = datos.asignaciones.filter((s) => s.actividadId === id);
  const recursos = datos.recursos.filter((r) => r.proyectoId === proyectoId);
  const nombre = (aid: string) => {
    const x = datos.actividades.find((y) => y.id === aid);
    return x ? `${x.codigo} ${x.nombre}` : '—';
  };
  const cambios = calc.cambiosPorActividad.get(id) ?? [];

  const agregarDep = () => {
    setErrorDep(null);
    if (!nuevaDep.predId) return;
    const depsProy = datos.dependencias.filter((d) => d.proyectoId === proyectoId);
    if (generaCiclo(depsProy, nuevaDep.predId, id)) {
      setErrorDep('Dependencia rechazada: generaría una dependencia circular (la actividad terminaría dependiendo de sí misma).');
      return;
    }
    if (depsProy.some((d) => d.predId === nuevaDep.predId && d.sucId === id && d.tipo === nuevaDep.tipo)) {
      setErrorDep('Esa dependencia ya existe.');
      return;
    }
    mutar((d: Datos) => ({ ...d, dependencias: [...d.dependencias, { id: nuevoId(), proyectoId, predId: nuevaDep.predId, sucId: id, tipo: nuevaDep.tipo, desfase: nuevaDep.desfase }] }), `Nueva dependencia ${nuevaDep.tipo} hacia ${a.codigo}`);
    setNuevaDep({ predId: '', tipo: 'FS', desfase: 0 });
  };

  const agregarAsig = () => {
    const r = recursos.find((x) => x.id === nuevaAsig.recursoId);
    if (!r || nuevaAsig.valor <= 0) return;
    const prof = r.tipo === 'profesional';
    mutar((d) => ({ ...d, asignaciones: [...d.asignaciones, { id: nuevoId(), proyectoId, actividadId: id, recursoId: r.id, horasSemana: prof ? nuevaAsig.valor : 0, cantidad: prof ? 0 : nuevaAsig.valor }] }), `Se asignó ${r.nombre} a ${a.codigo}`);
    setNuevaAsig({ recursoId: '', valor: 0 });
  };

  const eliminar = () => {
    const ids = new Set<string>([id]);
    let creciendo = true;
    while (creciendo) {
      creciendo = false;
      for (const x of datos.actividades) if (x.parentId && ids.has(x.parentId) && !ids.has(x.id)) { ids.add(x.id); creciendo = true; }
    }
    if (!confirm(`¿Eliminar ${a.codigo} ${a.nombre}${ids.size > 1 ? ` y sus ${ids.size - 1} elementos dependientes` : ''}? Se eliminan también sus dependencias y asignaciones.`)) return;
    mutar((d) => ({
      ...d,
      actividades: d.actividades.filter((x) => !ids.has(x.id)),
      dependencias: d.dependencias.filter((x) => !ids.has(x.predId) && !ids.has(x.sucId)),
      asignaciones: d.asignaciones.filter((x) => !ids.has(x.actividadId)),
      hitos: d.hitos.map((h) => (h.actividadIds.some((i) => ids.has(i)) ? { ...h, actividadIds: h.actividadIds.filter((i) => !ids.has(i)) } : h)),
    }), `Se eliminó ${a.codigo} ${a.nombre}`);
    onCerrar();
  };

  const estado = !esHoja ? null : calc.atrasadas.has(id) ? <Chip color="rojo">Atrasada</Chip> : (calc.avance.get(id) ?? 0) >= 100 ? <Chip color="verde">Terminada</Chip> : <Chip color="azul">Al día</Chip>;

  return (
    <div className="panel-lateral">
      <div className="cab">
        <div>
          <div className="muted peq">{a.codigo} · {a.nivel}</div>
          <b>{a.nombre}</b>
        </div>
        <button className="icono-btn" style={{ marginLeft: 'auto' }} onClick={onCerrar}><X size={18} /></button>
      </div>
      <div className="cuerpo">
        <div className="fila wrap">
          {estado}
          {prog?.critica && <Chip color="rojo">Ruta crítica</Chip>}
          {cambios.map((c) => <Chip key={c} color="morado">Modificada por {c}</Chip>)}
        </div>

        <div className="datos-calc">
          <span>Inicio calculado</span><b>{fecha(prog?.inicio)}</b>
          <span>Fin calculado</span><b>{fecha(prog?.fin)}</b>
          <span>Duración</span><b>{prog?.duracion ?? 0} días hábiles</b>
          <span>Holgura</span><b style={{ color: prog?.critica ? 'var(--crit)' : undefined }}>{prog?.holgura ?? 0} días</b>
          {lb && <><span>Línea base</span><b>{fecha(lb.inicio)} → {fecha(lb.fin)}</b></>}
          <span>Avance real / esperado</span><b>{num(calc.avance.get(id), 0)} % / {num(calc.esperado.get(id) ?? null, 0)} %</b>
          <span>Costo planificado</span><b>{pesos(calc.costoPlan.get(id))}</b>
          <span>Costo real</span><b>{pesos(calc.costoReal.get(id))}</b>
        </div>

        <div className="form f2">
          <Campo label="Nombre" className="ancho"><Editable valor={a.nombre} deshabilitado={!editarPlan} onConfirmar={(v) => set({ nombre: v }, `Se renombró ${a.codigo}`)} /></Campo>
          <Campo label="Responsable"><Editable valor={a.responsable} deshabilitado={!editarPlan} onConfirmar={(v) => set({ responsable: v }, `Responsable de ${a.codigo}`)} /></Campo>
          {esHoja && <Campo label="Duración (días hábiles)"><Editable tipo="number" min={0} valor={a.duracion} deshabilitado={!editarPlan} onConfirmar={(v) => set({ duracion: Math.max(0, Math.round(Number(v) || 0)) }, `Cambió la duración de ${a.codigo} ${a.nombre}`)} /></Campo>}
          {esHoja && <Campo label="No comenzar antes de" ayuda="Restricción de inicio (opcional)"><Editable tipo="date" valor={a.inicioMinimo ?? ''} deshabilitado={!editarPlan} onConfirmar={(v) => set({ inicioMinimo: v || null }, `Restricción de inicio de ${a.codigo}`)} /></Campo>}
          <Campo label="Descripción" className="ancho"><Editable valor={a.descripcion} deshabilitado={!editarPlan} onConfirmar={(v) => set({ descripcion: v }, `Descripción de ${a.codigo}`)} /></Campo>
        </div>

        {esHoja && (
          <>
            <h4>Avance y datos reales</h4>
            <div className="form f2">
              <Campo label={`Avance: ${a.avance} %`} className="ancho">
                <input type="range" min={0} max={100} step={5} defaultValue={a.avance} key={a.avance}
                  onPointerUp={(e) => { const v = Number((e.target as HTMLInputElement).value); if (v !== a.avance) set({ avance: v, inicioReal: a.inicioReal ?? (v > 0 ? prog?.inicio ?? null : null), finReal: v >= 100 ? a.finReal ?? calc.proyecto.fechaCorte : null }, `Avance de ${a.codigo}: ${v} %`); }}
                  onKeyUp={(e) => { const v = Number((e.target as HTMLInputElement).value); if (v !== a.avance) set({ avance: v }, `Avance de ${a.codigo}: ${v} %`); }} />
                <BarraProgreso valor={calc.esperado.get(id) ?? 0} color="var(--base)" />
                <span className="ayuda">Barra gris: avance esperado según la línea base a la fecha de corte</span>
              </Campo>
              <Campo label="Inicio real"><Editable tipo="date" valor={a.inicioReal ?? ''} onConfirmar={(v) => set({ inicioReal: v || null }, `Inicio real de ${a.codigo}`)} /></Campo>
              <Campo label="Fin real"><Editable tipo="date" valor={a.finReal ?? ''} onConfirmar={(v) => set({ finReal: v || null }, `Fin real de ${a.codigo}`)} /></Campo>
              <Campo label="Costo real ($)" className="ancho"><Editable tipo="number" min={0} valor={a.costoReal} onConfirmar={(v) => set({ costoReal: Math.max(0, Number(v) || 0) }, `Costo real de ${a.codigo}`)} /></Campo>
            </div>

            <h4><Link2 size={13} style={{ verticalAlign: -2 }} /> Predecesoras</h4>
            <table className="tabla">
              <tbody>
                {deps.map((d) => (
                  <tr key={d.id}>
                    <td>{nombre(d.predId)}</td>
                    <td><Chip color="azul">{d.tipo}</Chip></td>
                    <td className="num">{d.desfase > 0 ? '+' : ''}{d.desfase}d</td>
                    <td>{editarPlan && <button className="icono-btn" onClick={() => mutar((x) => ({ ...x, dependencias: x.dependencias.filter((y) => y.id !== d.id) }), `Se eliminó una dependencia de ${a.codigo}`)}><Trash2 size={14} /></button>}</td>
                  </tr>
                ))}
                {!deps.length && <tr><td className="muted peq">Sin predecesoras</td></tr>}
              </tbody>
            </table>
            {sucesoras.length > 0 && <div className="peq muted">Sucesoras: {sucesoras.map((d) => `${nombre(d.sucId).split(' ')[0]} (${d.tipo})`).join(', ')}</div>}
            {editarPlan && (
              <div className="form" style={{ gridTemplateColumns: '1fr 120px 70px auto', alignItems: 'end' }}>
                <Campo label="Predecesora">
                  <select value={nuevaDep.predId} onChange={(e) => setNuevaDep({ ...nuevaDep, predId: e.target.value })}>
                    <option value="">Seleccionar…</option>
                    {hojas.map((h) => <option key={h.id} value={h.id}>{h.codigo} {h.nombre}</option>)}
                  </select>
                </Campo>
                <Campo label="Tipo">
                  <select value={nuevaDep.tipo} onChange={(e) => setNuevaDep({ ...nuevaDep, tipo: e.target.value as TipoDep })}>
                    {TIPOS_DEP.map((t) => <option key={t.v} value={t.v}>{t.t}</option>)}
                  </select>
                </Campo>
                <Campo label="Desfase"><input type="number" value={nuevaDep.desfase} onChange={(e) => setNuevaDep({ ...nuevaDep, desfase: Number(e.target.value) })} /></Campo>
                <button className="btn" onClick={agregarDep} disabled={!nuevaDep.predId}>Agregar</button>
              </div>
            )}
            {errorDep && <div className="alerta alta">{errorDep}</div>}

            <h4><Users size={13} style={{ verticalAlign: -2 }} /> Recursos asignados</h4>
            <table className="tabla">
              <tbody>
                {asignaciones.map((s) => {
                  const r = recursos.find((x) => x.id === s.recursoId);
                  if (!r) return null;
                  const prof = r.tipo === 'profesional';
                  const sobre = prof && calc.sobreasignaciones.some((o) => o.recursoId === r.id && o.actividadIds.includes(id));
                  return (
                    <tr key={s.id}>
                      <td>{r.nombre}<div className="peq muted">{TIPOS_RECURSO[r.tipo].etiqueta}</div></td>
                      <td style={{ width: 92 }}>
                        <Editable tipo="number" min={0} valor={prof ? s.horasSemana : s.cantidad} deshabilitado={!editarPlan}
                          onConfirmar={(v) => mutar((d) => ({ ...d, asignaciones: d.asignaciones.map((y) => (y.id === s.id ? { ...y, horasSemana: prof ? Number(v) : y.horasSemana, cantidad: prof ? y.cantidad : Number(v) } : y)) }), `Cambió la asignación de ${r.nombre} en ${a.codigo}`)} />
                        <div className="peq muted">{prof ? 'h/semana' : r.unidad || 'cantidad'}</div>
                      </td>
                      <td className="num">{pesos(calc.costoAsignacion.get(s.id))}{sobre && <div><Chip color="rojo">Sobreasignado</Chip></div>}</td>
                      <td>{editarPlan && <button className="icono-btn" onClick={() => mutar((d) => ({ ...d, asignaciones: d.asignaciones.filter((y) => y.id !== s.id) }), `Se quitó ${r.nombre} de ${a.codigo}`)}><Trash2 size={14} /></button>}</td>
                    </tr>
                  );
                })}
                {!asignaciones.length && <tr><td className="muted peq">Sin recursos asignados</td></tr>}
              </tbody>
            </table>
            {editarPlan && (
              <div className="form" style={{ gridTemplateColumns: '1fr 90px auto', alignItems: 'end' }}>
                <Campo label="Recurso">
                  <select value={nuevaAsig.recursoId} onChange={(e) => setNuevaAsig({ ...nuevaAsig, recursoId: e.target.value })}>
                    <option value="">Seleccionar…</option>
                    {recursos.map((r) => <option key={r.id} value={r.id}>{r.nombre} ({TIPOS_RECURSO[r.tipo].etiqueta})</option>)}
                  </select>
                </Campo>
                <Campo label={recursos.find((r) => r.id === nuevaAsig.recursoId)?.tipo === 'profesional' ? 'h/semana' : 'Cantidad'}>
                  <input type="number" min={0} value={nuevaAsig.valor} onChange={(e) => setNuevaAsig({ ...nuevaAsig, valor: Number(e.target.value) })} />
                </Campo>
                <button className="btn" onClick={agregarAsig} disabled={!nuevaAsig.recursoId || nuevaAsig.valor <= 0}>Asignar</button>
              </div>
            )}
          </>
        )}

        {!esHoja && (
          <>
            <h4>Elementos que la componen</h4>
            <table className="tabla">
              <tbody>
                {(calc.prog.hijos.get(id) ?? []).map((h) => (
                  <tr key={h.id}><td>{h.codigo} {h.nombre}</td><td className="num">{num(calc.avance.get(h.id), 0)} %</td><td className="num">{pesos(calc.costoPlan.get(h.id))}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="peq muted">Fechas, avance y costos se consolidan automáticamente desde sus elementos, sin duplicar.</div>
          </>
        )}

        {esAdmin && <button className="btn peligro" onClick={eliminar}><Trash2 size={14} /> Eliminar</button>}
      </div>
    </div>
  );
}
