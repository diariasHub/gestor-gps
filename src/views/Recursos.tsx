import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../state/store';
import type { Recurso, TipoRecurso } from '../engine/types';
import { TIPOS_RECURSO } from '../engine/types';
import { nuevoId } from '../engine/cambios';
import { parseISO, toISO } from '../engine/calendario';
import { Campo, Chip, Encabezado, Modal, Tarjeta, fechaCorta, num, pesos } from '../ui';

const lunes = (iso: string) => {
  const t = parseISO(iso);
  const d = new Date(t).getUTCDay();
  return toISO(t + (d === 0 ? -6 : 1 - d) * 86400000);
};

export function Recursos() {
  const { datos, calc, proyectoId, mutar, esAdmin } = useStore();
  const [pestana, setPestana] = useState<TipoRecurso | 'carga'>('profesional');
  const [editando, setEditando] = useState<Recurso | null>(null);
  const recursos = datos.recursos.filter((r) => r.proyectoId === proyectoId);

  const usos = useMemo(() => {
    const m = new Map<string, { acts: number; costo: number }>();
    for (const s of datos.asignaciones) {
      const e = m.get(s.recursoId) ?? { acts: 0, costo: 0 };
      e.acts++;
      e.costo += calc?.costoAsignacion.get(s.id) ?? 0;
      m.set(s.recursoId, e);
    }
    return m;
  }, [datos.asignaciones, calc]);

  // carga semanal por profesional (horas asignadas por semana)
  const carga = useMemo(() => {
    if (!calc) return { semanas: [] as string[], filas: [] as { r: Recurso; horas: Map<string, number> }[] };
    const semanas = new Set<string>();
    const filas = recursos.filter((r) => r.tipo === 'profesional').map((r) => {
      const horas = new Map<string, number>();
      for (const s of datos.asignaciones.filter((x) => x.recursoId === r.id)) {
        const p = calc.prog.porId.get(s.actividadId);
        if (!p) continue;
        for (let i = p.es; i < p.ef; i++) {
          const sem = lunes(calc.cal.fecha(i));
          horas.set(sem, (horas.get(sem) ?? 0) + s.horasSemana / 5);
        }
      }
      for (const k of horas.keys()) semanas.add(k);
      return { r, horas };
    });
    return { semanas: [...semanas].sort(), filas };
  }, [calc, datos.asignaciones, recursos]);

  if (!calc) return null;
  const lista = pestana === 'carga' ? [] : recursos.filter((r) => r.tipo === pestana);
  const info = pestana === 'carga' ? null : TIPOS_RECURSO[pestana];
  const totalTipo = (t: TipoRecurso) => recursos.filter((r) => r.tipo === t).reduce((s, r) => s + (usos.get(r.id)?.costo ?? 0), 0);

  const eliminar = (r: Recurso) => {
    if ((usos.get(r.id)?.acts ?? 0) > 0) {
      alert(`No se puede eliminar "${r.nombre}": está asignado a ${usos.get(r.id)!.acts} actividad(es). Quite primero las asignaciones (regla de integridad).`);
      return;
    }
    if (!confirm(`¿Eliminar el recurso "${r.nombre}"?`)) return;
    mutar((d) => ({ ...d, recursos: d.recursos.filter((x) => x.id !== r.id) }), `Se eliminó el recurso ${r.nombre}`);
  };

  return (
    <div>
      <Encabezado titulo="Recursos y costos" sub="Costo profesional = horas semanales × semanas × valor hora · costo material = cantidad × valor unitario · costo de actividad = suma de sus recursos">
        {esAdmin && pestana !== 'carga' && <button className="btn prim" onClick={() => setEditando({ id: '', proyectoId, tipo: pestana, nombre: '', detalle: '', valor: 0, horasSemana: pestana === 'profesional' ? 45 : 0, unidad: '', periodo: '' })}><Plus size={15} /> Nuevo recurso</button>}
      </Encabezado>

      <div className="grid g5" style={{ marginBottom: 14 }}>
        {(['profesional', 'tipo_profesional', 'licencia', 'material', 'equipamiento'] as TipoRecurso[]).map((t) => (
          <div key={t} className="tarjeta kpi-tile">
            <div className="nom">{TIPOS_RECURSO[t].etiqueta}</div>
            <div className="val" style={{ fontSize: 19 }}>{pesos(totalTipo(t))}</div>
            <div className="meta">{recursos.filter((r) => r.tipo === t).length} recurso(s)</div>
          </div>
        ))}
      </div>

      <div className="pestanas">
        {(Object.keys(TIPOS_RECURSO) as TipoRecurso[]).map((t) => (
          <button key={t} className={`pestana ${pestana === t ? 'activa' : ''}`} onClick={() => setPestana(t)}>{TIPOS_RECURSO[t].etiqueta}</button>
        ))}
        <button className={`pestana ${pestana === 'carga' ? 'activa' : ''}`} onClick={() => setPestana('carga')}>
          Carga semanal {calc.sobreasignaciones.length > 0 && <Chip color="rojo">{calc.sobreasignaciones.length}</Chip>}
        </button>
      </div>

      {pestana !== 'carga' && info && (
        <Tarjeta sinPadding>
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th><th>{info.detalle}</th><th className="num">{info.valor}</th>
                {pestana === 'profesional' && <th className="num">Horas/semana disp.</th>}
                {pestana !== 'profesional' && <th>Unidad / periodo</th>}
                <th className="num">Actividades</th><th className="num">Costo planificado</th><th />
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.nombre}</b></td>
                  <td>{r.detalle}</td>
                  <td className="num">{pesos(r.valor)}</td>
                  {pestana === 'profesional' && <td className="num">{r.horasSemana}</td>}
                  {pestana !== 'profesional' && <td>{[r.unidad, r.periodo].filter(Boolean).join(' · ') || '—'}</td>}
                  <td className="num">{usos.get(r.id)?.acts ?? 0}</td>
                  <td className="num">{pesos(usos.get(r.id)?.costo ?? 0)}</td>
                  <td className="num">
                    {esAdmin && <>
                      <button className="icono-btn" onClick={() => setEditando(r)}><Pencil size={14} /></button>
                      <button className="icono-btn" onClick={() => eliminar(r)}><Trash2 size={14} /></button>
                    </>}
                  </td>
                </tr>
              ))}
              {!lista.length && <tr><td colSpan={8} className="vacio">Sin recursos de este tipo</td></tr>}
            </tbody>
          </table>
        </Tarjeta>
      )}

      {pestana === 'carga' && (
        <div className="grid">
          <Tarjeta titulo="Horas asignadas por semana (profesionales)" derecha={<span className="peq muted">Rojo: supera las horas disponibles</span>} sinPadding>
            <div style={{ overflowX: 'auto' }}>
              <table className="tabla" style={{ fontSize: 11.5 }}>
                <thead>
                  <tr><th>Profesional</th><th className="num">Disp.</th>{carga.semanas.map((s) => <th key={s} className="num">{fechaCorta(s)}</th>)}</tr>
                </thead>
                <tbody>
                  {carga.filas.map(({ r, horas }) => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: 'nowrap' }}><b>{r.nombre}</b><div className="muted">{r.detalle}</div></td>
                      <td className="num">{r.horasSemana}</td>
                      {carga.semanas.map((s) => {
                        const h = horas.get(s) ?? 0;
                        const sobre = h > r.horasSemana + 0.01;
                        const pct = h / r.horasSemana;
                        return (
                          <td key={s} className="num" style={{ background: sobre ? '#fbd5d6' : h ? `rgba(91,124,250,${0.08 + pct * 0.35})` : undefined, color: sobre ? '#9b1c1c' : undefined, fontWeight: sobre ? 700 : 400 }}>
                            {h ? num(h, 0) : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
          <Tarjeta titulo="Sobreasignaciones detectadas">
            {calc.sobreasignaciones.length === 0 && <div className="muted">No hay profesionales sobreasignados.</div>}
            <div className="lista-alertas">
              {calc.sobreasignaciones.map((s, i) => {
                const r = recursos.find((x) => x.id === s.recursoId)!;
                return (
                  <div key={i} className="alerta alta">
                    <div><b>{r.nombre}</b> · semana del {fechaCorta(s.semana)}: {s.asignadas} h de {s.disponibles} h disponibles.
                      <div className="peq">Actividades: {s.actividadIds.map((id) => datos.actividades.find((a) => a.id === id)?.codigo).join(', ')}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {calc.sobreasignaciones.length > 0 && <p className="peq muted" style={{ marginBottom: 0 }}>Opciones de nivelación: mover una actividad con holgura, reasignar parte del trabajo a otro profesional, agregar un recurso o reducir las horas semanales extendiendo la duración.</p>}
          </Tarjeta>
        </div>
      )}

      {editando && <FormRecurso recurso={editando} onCerrar={() => setEditando(null)} />}
    </div>
  );
}

function FormRecurso({ recurso, onCerrar }: { recurso: Recurso; onCerrar: () => void }) {
  const { mutar } = useStore();
  const [r, setR] = useState<Recurso>(recurso);
  const info = TIPOS_RECURSO[r.tipo];
  const errores: string[] = [];
  if (!r.nombre.trim()) errores.push('El nombre es obligatorio.');
  if (r.valor < 0) errores.push('El valor no puede ser negativo.');
  if (r.tipo === 'profesional' && (r.horasSemana <= 0 || r.horasSemana > 60)) errores.push('Las horas por semana deben estar entre 1 y 60.');
  const guardar = () => {
    if (errores.length) return;
    const nuevo = !r.id;
    const fila = nuevo ? { ...r, id: nuevoId() } : r;
    mutar((d) => ({ ...d, recursos: nuevo ? [...d.recursos, fila] : d.recursos.map((x) => (x.id === r.id ? fila : x)) }), nuevo ? `Nuevo recurso ${r.nombre}` : `Se actualizó el recurso ${r.nombre}`);
    onCerrar();
  };
  return (
    <Modal titulo={r.id ? 'Editar recurso' : 'Nuevo recurso'} onCerrar={onCerrar} pie={<><button className="btn" onClick={onCerrar}>Cancelar</button><button className="btn prim" onClick={guardar} disabled={errores.length > 0}>Guardar</button></>}>
      <div className="form f2">
        <Campo label="Tipo de recurso">
          <select value={r.tipo} onChange={(e) => setR({ ...r, tipo: e.target.value as TipoRecurso })} disabled={!!r.id}>
            {(Object.keys(TIPOS_RECURSO) as TipoRecurso[]).map((t) => <option key={t} value={t}>{TIPOS_RECURSO[t].etiqueta}</option>)}
          </select>
        </Campo>
        <Campo label="Nombre"><input value={r.nombre} onChange={(e) => setR({ ...r, nombre: e.target.value })} /></Campo>
        <Campo label={info.detalle}><input value={r.detalle} onChange={(e) => setR({ ...r, detalle: e.target.value })} /></Campo>
        <Campo label={`${info.valor} ($)`}><input type="number" min={0} value={r.valor} onChange={(e) => setR({ ...r, valor: Number(e.target.value) })} /></Campo>
        {r.tipo === 'profesional' ? (
          <Campo label="Horas disponibles por semana"><input type="number" min={1} max={60} value={r.horasSemana} onChange={(e) => setR({ ...r, horasSemana: Number(e.target.value) })} /></Campo>
        ) : (
          <>
            <Campo label="Unidad"><input value={r.unidad} onChange={(e) => setR({ ...r, unidad: e.target.value })} /></Campo>
            <Campo label="Periodo"><input value={r.periodo} onChange={(e) => setR({ ...r, periodo: e.target.value })} placeholder="mensual, anual…" /></Campo>
          </>
        )}
      </div>
      {errores.map((e) => <div key={e} className="alerta alta" style={{ marginTop: 8 }}>{e}</div>)}
      <p className="peq muted">Las semanas de cada profesional se obtienen de la duración de las actividades donde se asigna, por eso el costo se recalcula al cambiar fechas o duraciones.</p>
    </Modal>
  );
}
