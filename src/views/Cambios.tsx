import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Plus, Trash2, XCircle } from 'lucide-react';
import { useStore } from '../state/store';
import type { AccionCambio, Cambio, NivelRiesgo, Prioridad, TipoCambio } from '../engine/types';
import { PASOS_CAMBIO } from '../engine/types';
import { avanzarCambio, cuadranteEisenhower, nuevoId, type DecisionCambio } from '../engine/cambios';
import { calcular } from '../engine/calculo';
import { Campo, Chip, Encabezado, Modal, Tarjeta, colorEstadoCambio, fecha, fechaCorta, pesos } from '../ui';

const TIPOS: TipoCambio[] = ['Alcance', 'Tiempo', 'Costo', 'Recurso', 'Tecnología', 'Organización'];
const PRIORIDADES: Prioridad[] = ['Baja', 'Media', 'Alta', 'Crítica'];
const RIESGOS: NivelRiesgo[] = ['Bajo', 'Medio', 'Alto', 'Crítico'];

export function Eisenhower({ cambios, onClick }: { cambios: Cambio[]; onClick?: (id: string) => void }) {
  const cuad = (u: boolean, i: boolean) => cambios.filter((c) => c.urgente === u && c.importante === i && c.estado !== 'Rechazado' && c.estado !== 'Cerrado');
  const caja = (cls: string, titulo: string, sub: string, l: Cambio[]) => (
    <div className={cls}>
      <b>{titulo} <span className="muted" style={{ fontWeight: 400 }}>· {sub}</span></b>
      <div className="fila wrap">{l.map((c) => <span key={c.id} className="chip" style={{ cursor: onClick ? 'pointer' : undefined, background: '#fff' }} onClick={() => onClick?.(c.id)}>{c.codigo}</span>)}</div>
    </div>
  );
  return (
    <div className="eisen">
      {caja('q1', 'Hazlo ya', 'urgente e importante', cuad(true, true))}
      {caja('q2', 'Planifica', 'importante, no urgente', cuad(false, true))}
      {caja('q3', 'Delega', 'urgente, no importante', cuad(true, false))}
      {caja('q4', 'Elimínalo', 'ni urgente ni importante', cuad(false, false))}
    </div>
  );
}

export function Cambios() {
  const { datos, calc, proyectoId, esAdmin } = useStore();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState('');
  if (!calc) return null;
  const todos = datos.cambios.filter((c) => c.proyectoId === proyectoId);
  const cambios = todos.filter((c) => (!filtroEstado || c.estado === filtroEstado) && (!filtroPrioridad || c.prioridad === filtroPrioridad));
  const corte = calc.proyecto.fechaCorte;

  return (
    <div>
      <Encabezado titulo="Gestión del cambio" sub="Registro, evaluación, aprobación, implementación y seguimiento de solicitudes según los 10 pasos de la gestión del cambio">
        <button className="btn prim" onClick={() => setNuevo(true)}><Plus size={15} /> Nueva solicitud</button>
      </Encabezado>
      <div className="grid" style={{ gridTemplateColumns: '1fr 340px', alignItems: 'start' }}>
        <Tarjeta sinPadding titulo="Solicitudes de cambio" derecha={
          <div className="fila">
            <select className="entrada" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ width: 150 }}>
              <option value="">Todos los estados</option>
              {['Abierto', 'En evaluación', 'Aprobado', 'Rechazado', 'En implementación', 'Cerrado'].map((e) => <option key={e}>{e}</option>)}
            </select>
            <select className="entrada" value={filtroPrioridad} onChange={(e) => setFiltroPrioridad(e.target.value)} style={{ width: 130 }}>
              <option value="">Toda prioridad</option>
              {PRIORIDADES.map((e) => <option key={e}>{e}</option>)}
            </select>
          </div>
        }>
          <table className="tabla">
            <thead><tr><th>ID</th><th>Solicitud</th><th>Tipo</th><th>Prioridad</th><th>Riesgo</th><th>Estado</th><th>Paso</th><th>Comprometida</th><th className="num">Costo est.</th></tr></thead>
            <tbody>
              {cambios.map((c) => {
                const atrasado = c.estado !== 'Cerrado' && c.estado !== 'Rechazado' && c.fechaComprometida < corte;
                return (
                  <tr key={c.id} className="clic" onClick={() => setAbierto(c.id)}>
                    <td><b>{c.codigo}</b></td>
                    <td>{c.titulo}<div className="peq muted">{c.solicitante} · {fechaCorta(c.fecha)} · {cuadranteEisenhower(c)}</div></td>
                    <td className="peq">{c.tipo}</td>
                    <td><Chip color={c.prioridad === 'Crítica' || c.prioridad === 'Alta' ? 'rojo' : c.prioridad === 'Media' ? 'amarillo' : ''}>{c.prioridad}</Chip></td>
                    <td className="peq">{c.riesgo}</td>
                    <td><Chip color={colorEstadoCambio(c.estado)}>{c.estado}</Chip></td>
                    <td className="peq">{c.estado === 'Rechazado' ? '—' : `${c.paso}/10`}</td>
                    <td className="peq">{fechaCorta(c.fechaComprometida)} {atrasado && <AlertTriangle size={12} color="var(--crit)" />}</td>
                    <td className="num">{pesos(c.costoEstimado)}</td>
                  </tr>
                );
              })}
              {!cambios.length && <tr><td colSpan={9} className="vacio">Sin solicitudes</td></tr>}
            </tbody>
          </table>
        </Tarjeta>
        <div className="grid">
          <Tarjeta titulo="Priorización (matriz de Eisenhower)">
            <Eisenhower cambios={todos} onClick={setAbierto} />
          </Tarjeta>
          <Tarjeta titulo="Flujo de 10 pasos">
            <ol className="peq" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 3 }}>
              {PASOS_CAMBIO.map((p, i) => <li key={p}>{p} <span className="muted">· {todos.filter((c) => c.paso === i + 1 && c.estado !== 'Rechazado').length}</span></li>)}
            </ol>
            {!esAdmin && <p className="peq muted" style={{ marginBottom: 0 }}>Solo el administrador puede aprobar o rechazar solicitudes.</p>}
          </Tarjeta>
        </div>
      </div>
      {abierto && <DetalleCambio id={abierto} onCerrar={() => setAbierto(null)} />}
      {nuevo && <FormCambio onCerrar={() => setNuevo(false)} onCreado={(id) => { setNuevo(false); setAbierto(id); }} />}
    </div>
  );
}

function FormCambio({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: (id: string) => void }) {
  const { datos, calc, proyectoId, mutar, usuario } = useStore();
  const n = datos.cambios.filter((c) => c.proyectoId === proyectoId).length + 1;
  const hoy = calc!.proyecto.fechaCorte;
  const [c, setC] = useState({ titulo: '', solicitante: '', descripcion: '', justificacion: '', tipo: 'Alcance' as TipoCambio, prioridad: 'Media' as Prioridad, urgente: false, importante: true, riesgo: 'Medio' as NivelRiesgo, fechaComprometida: hoy, costoEstimado: 0, responsable: '' });
  const ok = c.titulo.trim() && c.solicitante.trim() && c.descripcion.trim() && c.fechaComprometida >= hoy;
  const crear = () => {
    if (!ok) return;
    const id = nuevoId();
    const cambio: Cambio = {
      ...c, id, proyectoId, codigo: `CC-${String(n).padStart(2, '0')}`, fecha: hoy, impacto: '', estado: 'Abierto', paso: 1, fechaReal: null, costoReal: 0,
      resultado: '', exitoso: null, adopcion: 0, accionesCorrectivas: '', acciones: [], historial: [{ paso: 1, estado: 'Abierto', fecha: hoy, usuario, nota: 'Solicitud registrada' }],
    };
    mutar((d) => ({ ...d, cambios: [...d.cambios, cambio] }), `Nueva solicitud ${cambio.codigo}`);
    onCreado(id);
  };
  return (
    <Modal titulo="Nueva solicitud de cambio" onCerrar={onCerrar} ancho={720} pie={<><button className="btn" onClick={onCerrar}>Cancelar</button><button className="btn prim" disabled={!ok} onClick={crear}>Registrar (paso 1)</button></>}>
      <div className="form f2">
        <Campo label="Título" className="ancho"><input value={c.titulo} onChange={(e) => setC({ ...c, titulo: e.target.value })} /></Campo>
        <Campo label="Solicitante"><input value={c.solicitante} onChange={(e) => setC({ ...c, solicitante: e.target.value })} /></Campo>
        <Campo label="Responsable"><input value={c.responsable} onChange={(e) => setC({ ...c, responsable: e.target.value })} /></Campo>
        <Campo label="Descripción" className="ancho"><textarea value={c.descripcion} onChange={(e) => setC({ ...c, descripcion: e.target.value })} /></Campo>
        <Campo label="Justificación" className="ancho"><textarea value={c.justificacion} onChange={(e) => setC({ ...c, justificacion: e.target.value })} /></Campo>
        <Campo label="Tipo"><select value={c.tipo} onChange={(e) => setC({ ...c, tipo: e.target.value as TipoCambio })}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></Campo>
        <Campo label="Prioridad"><select value={c.prioridad} onChange={(e) => setC({ ...c, prioridad: e.target.value as Prioridad })}>{PRIORIDADES.map((t) => <option key={t}>{t}</option>)}</select></Campo>
        <Campo label="Riesgo"><select value={c.riesgo} onChange={(e) => setC({ ...c, riesgo: e.target.value as NivelRiesgo })}>{RIESGOS.map((t) => <option key={t}>{t}</option>)}</select></Campo>
        <Campo label="Fecha comprometida" error={c.fechaComprometida < hoy ? 'No puede ser anterior a la fecha de corte' : null}><input type="date" value={c.fechaComprometida} onChange={(e) => setC({ ...c, fechaComprometida: e.target.value })} /></Campo>
        <Campo label="Costo estimado ($)"><input type="number" min={0} value={c.costoEstimado} onChange={(e) => setC({ ...c, costoEstimado: Number(e.target.value) })} /></Campo>
        <div className="fila"><label className="fila"><input type="checkbox" checked={c.urgente} onChange={(e) => setC({ ...c, urgente: e.target.checked })} /> Urgente</label><label className="fila"><input type="checkbox" checked={c.importante} onChange={(e) => setC({ ...c, importante: e.target.checked })} /> Importante</label><Chip color="morado">{cuadranteEisenhower(c)}</Chip></div>
      </div>
    </Modal>
  );
}

function DetalleCambio({ id, onCerrar }: { id: string; onCerrar: () => void }) {
  const { datos, calc, proyectoId, mutar, esAdmin, usuario } = useStore();
  const [nota, setNota] = useState('');
  const [nuevaAccion, setNuevaAccion] = useState<{ tipo: AccionCambio['tipo']; actividadId: string; recursoId: string; delta: number }>({ tipo: 'duracion', actividadId: '', recursoId: '', delta: 0 });
  const c = datos.cambios.find((x) => x.id === id);
  const sim = useMemo(() => {
    if (!c || !calc || c.paso > 3 || c.estado === 'Rechazado' || !c.acciones.length) return null;
    const d2 = avanzarCambio(datos, c.id, 'aprobar', calc.proyecto.fechaCorte, 'simulación', '');
    const c2 = calcular(d2, proyectoId);
    if (!c2) return null;
    const dias = c2.cal.indiceDesde(c2.finProyecto) - calc.cal.indiceDesde(calc.finProyecto);
    const antes = new Set(calc.alertas.map((a) => a.mensaje));
    return { dias, fin: c2.finProyecto, costo: c2.costoPlanTotal - calc.costoPlanTotal, nuevas: c2.alertas.filter((a) => !antes.has(a.mensaje) && a.tipo !== 'kpi') };
  }, [c, calc, datos, proyectoId]);
  if (!c || !calc) return null;
  const hoy = calc.proyecto.fechaCorte;
  const editable = c.paso <= 3 && c.estado !== 'Rechazado';
  const hojas = calc.prog.hojas;
  const recursos = datos.recursos.filter((r) => r.proyectoId === proyectoId);

  const decidir = (dec: DecisionCambio, titulo: string) => {
    mutar((d) => avanzarCambio(d, c.id, dec, hoy, usuario, nota), `${c.codigo}: ${titulo}`);
    setNota('');
  };
  const set = (cambios: Partial<Cambio>, titulo: string) => mutar((d) => ({ ...d, cambios: d.cambios.map((x) => (x.id === c.id ? { ...x, ...cambios } : x)) }), titulo);
  const descAccion = (a: AccionCambio) => {
    const act = datos.actividades.find((x) => x.id === a.actividadId);
    const r = recursos.find((x) => x.id === a.recursoId);
    if (a.tipo === 'duracion') return `Duración de ${act?.codigo} ${act?.nombre}: ${a.delta > 0 ? '+' : ''}${a.delta} días hábiles`;
    if (a.tipo === 'recurso') return `Asignar ${r?.nombre} a ${act?.codigo}: ${a.delta > 0 ? '+' : ''}${a.delta} ${r?.tipo === 'profesional' ? 'h/semana' : 'unid.'}`;
    return `Presupuesto del proyecto: ${a.delta > 0 ? '+' : ''}${pesos(a.delta)}`;
  };

  const botones = () => {
    if (c.estado === 'Rechazado' || c.estado === 'Cerrado') return null;
    if (c.paso === 1) return (<>
      <button className="btn peligro" onClick={() => decidir('no_amerita', 'no amerita el cambio, se cierra')}><XCircle size={14} /> No amerita (cerrar)</button>
      <button className="btn prim" onClick={() => decidir('avanzar', 'amerita el cambio; pasa a análisis')}>Amerita: analizar <ArrowRight size={14} /></button>
    </>);
    if (c.paso === 2) return (<>
      <button className="btn" onClick={() => decidir('no_factible', 'no factible; se proponen medidas factibles')}>No factible: proponer medidas</button>
      <button className="btn prim" onClick={() => decidir('avanzar', 'factible; pasa a evaluación de riesgos')}>Factible: evaluar riesgos <ArrowRight size={14} /></button>
    </>);
    if (c.paso === 3) return esAdmin ? (<>
      <button className="btn peligro lleno" onClick={() => decidir('rechazar', 'solicitud rechazada')}><XCircle size={14} /> Rechazar</button>
      <button className="btn ok" onClick={() => decidir('aprobar', 'aprobado y aplicado al plan')}><CheckCircle2 size={14} /> Aprobar y aplicar al plan</button>
    </>) : <span className="peq muted">Pendiente de decisión del administrador</span>;
    return <button className="btn prim" onClick={() => decidir('avanzar', `paso ${c.paso + 1}: ${PASOS_CAMBIO[c.paso]}`)}>{c.paso === 9 ? 'Cerrar: adoptar el cambio' : `Completar paso ${c.paso}`} <ArrowRight size={14} /></button>;
  };

  return (
    <Modal titulo={<span>{c.codigo} · {c.titulo}</span>} onCerrar={onCerrar} ancho={980} pie={<><input className="entrada" placeholder="Nota para el historial (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} style={{ marginRight: 'auto', maxWidth: 380 }} />{botones()}</>}>
      <div className="pasos" style={{ marginBottom: 16 }}>
        {PASOS_CAMBIO.map((p, i) => {
          const n = i + 1;
          const cls = c.estado === 'Rechazado' && n === c.paso ? 'rechazo' : n < c.paso || c.estado === 'Cerrado' ? 'hecho' : n === c.paso ? 'actual' : '';
          return <div key={p} className={`paso ${cls}`}><div className="bola">{n}</div>{p}</div>;
        })}
      </div>
      <div className="grid g2" style={{ alignItems: "start" }}>
        <div className="grid">
          <div className="fila wrap">
            <Chip color={colorEstadoCambio(c.estado)}>{c.estado}</Chip>
            <Chip color="morado">{cuadranteEisenhower(c)}</Chip>
            <Chip>{c.tipo}</Chip><Chip color={c.riesgo === 'Alto' || c.riesgo === 'Crítico' ? 'rojo' : ''}>Riesgo {c.riesgo.toLowerCase()}</Chip>
          </div>
          <div className="peq"><b>Solicitante:</b> {c.solicitante} · {fecha(c.fecha)} · <b>Responsable:</b> {c.responsable || '—'}</div>
          <div className="peq"><b>Descripción:</b> {c.descripcion}</div>
          <div className="peq"><b>Justificación:</b> {c.justificacion}</div>
          <div className="form f2">
            <Campo label="Prioridad"><select value={c.prioridad} disabled={!editable} onChange={(e) => set({ prioridad: e.target.value as Prioridad }, `${c.codigo}: prioridad`)}>{PRIORIDADES.map((t) => <option key={t}>{t}</option>)}</select></Campo>
            <Campo label="Riesgo"><select value={c.riesgo} disabled={!editable} onChange={(e) => set({ riesgo: e.target.value as NivelRiesgo }, `${c.codigo}: riesgo`)}>{RIESGOS.map((t) => <option key={t}>{t}</option>)}</select></Campo>
            <div className="fila"><label className="fila peq"><input type="checkbox" checked={c.urgente} disabled={!editable} onChange={(e) => set({ urgente: e.target.checked }, `${c.codigo}: urgencia`)} /> Urgente</label><label className="fila peq"><input type="checkbox" checked={c.importante} disabled={!editable} onChange={(e) => set({ importante: e.target.checked }, `${c.codigo}: importancia`)} /> Importante</label></div>
            <Campo label="Fecha comprometida"><input type="date" value={c.fechaComprometida} onChange={(e) => set({ fechaComprometida: e.target.value }, `${c.codigo}: fecha comprometida`)} /></Campo>
            <Campo label="Costo estimado ($)"><input type="number" value={c.costoEstimado} disabled={!editable} onChange={(e) => set({ costoEstimado: Number(e.target.value) }, `${c.codigo}: costo estimado`)} /></Campo>
            <Campo label="Costo real ($)"><input type="number" value={c.costoReal} onChange={(e) => set({ costoReal: Number(e.target.value) }, `${c.codigo}: costo real`)} /></Campo>
            <Campo label="Impacto (plazo, costo, recursos, alcance)" className="ancho"><textarea value={c.impacto} disabled={!editable} onChange={(e) => set({ impacto: e.target.value }, `${c.codigo}: impacto`)} /></Campo>
            {c.paso >= 6 && <Campo label={`Adopción del cambio: ${c.adopcion} %`} className="ancho"><input type="range" min={0} max={100} step={5} value={c.adopcion} onChange={(e) => set({ adopcion: Number(e.target.value) }, `${c.codigo}: adopción ${e.target.value} %`)} /></Campo>}
            {c.paso >= 9 && <Campo label="Acciones correctivas (paso 9)" className="ancho"><textarea value={c.accionesCorrectivas} onChange={(e) => set({ accionesCorrectivas: e.target.value }, `${c.codigo}: acciones correctivas`)} /></Campo>}
            {(c.paso >= 7 || c.estado === 'Rechazado') && <Campo label="Resultado / evaluación final" className="ancho"><textarea value={c.resultado} onChange={(e) => set({ resultado: e.target.value }, `${c.codigo}: resultado`)} /></Campo>}
            {c.paso >= 7 && <label className="fila peq ancho"><input type="checkbox" checked={!!c.exitoso} onChange={(e) => set({ exitoso: e.target.checked }, `${c.codigo}: resultado exitoso`)} /> El cambio logró su objetivo (efectividad)</label>}
          </div>
        </div>
        <div className="grid" style={{ alignContent: 'start' }}>
          <Tarjeta titulo="Modificaciones al plan (trazabilidad)">
            {c.acciones.map((a) => (
              <div key={a.id} className="fila peq" style={{ marginBottom: 6 }}>
                {a.aplicada ? <CheckCircle2 size={14} color="var(--ok)" /> : <span className="punto gris" />}
                <span>{descAccion(a)}</span>
                <span className="muted" style={{ marginLeft: 'auto' }}>{a.aplicada ? `aplicada ${fechaCorta(a.aplicadaEn)}` : 'pendiente'}</span>
                {editable && <button className="icono-btn" onClick={() => set({ acciones: c.acciones.filter((x) => x.id !== a.id) }, `${c.codigo}: se quitó una modificación`)}><Trash2 size={13} /></button>}
              </div>
            ))}
            {!c.acciones.length && <div className="peq muted">Sin modificaciones definidas.</div>}
            {editable && (
              <div className="form" style={{ gridTemplateColumns: '110px 1fr', marginTop: 8 }}>
                <select className="entrada" value={nuevaAccion.tipo} onChange={(e) => setNuevaAccion({ ...nuevaAccion, tipo: e.target.value as AccionCambio['tipo'] })}>
                  <option value="duracion">Duración</option><option value="recurso">Recurso</option><option value="presupuesto">Presupuesto</option>
                </select>
                {nuevaAccion.tipo !== 'presupuesto' ? (
                  <select className="entrada" value={nuevaAccion.actividadId} onChange={(e) => setNuevaAccion({ ...nuevaAccion, actividadId: e.target.value })}>
                    <option value="">Actividad…</option>{hojas.map((h) => <option key={h.id} value={h.id}>{h.codigo} {h.nombre}</option>)}
                  </select>
                ) : <div />}
                {nuevaAccion.tipo === 'recurso' && (
                  <select className="entrada" style={{ gridColumn: '1 / -1' }} value={nuevaAccion.recursoId} onChange={(e) => setNuevaAccion({ ...nuevaAccion, recursoId: e.target.value })}>
                    <option value="">Recurso…</option>{recursos.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                )}
                <input className="entrada" type="number" placeholder={nuevaAccion.tipo === 'duracion' ? '± días' : nuevaAccion.tipo === 'recurso' ? '± h/semana o cantidad' : '± $'} value={nuevaAccion.delta || ''} onChange={(e) => setNuevaAccion({ ...nuevaAccion, delta: Number(e.target.value) })} />
                <button className="btn" disabled={!nuevaAccion.delta || (nuevaAccion.tipo !== 'presupuesto' && !nuevaAccion.actividadId) || (nuevaAccion.tipo === 'recurso' && !nuevaAccion.recursoId)}
                  onClick={() => { set({ acciones: [...c.acciones, { id: nuevoId(), tipo: nuevaAccion.tipo, actividadId: nuevaAccion.actividadId || null, recursoId: nuevaAccion.recursoId || null, delta: nuevaAccion.delta, aplicada: false, aplicadaEn: null }] }, `${c.codigo}: nueva modificación`); setNuevaAccion({ tipo: 'duracion', actividadId: '', recursoId: '', delta: 0 }); }}>Agregar</button>
              </div>
            )}
          </Tarjeta>
          {sim && (
            <Tarjeta titulo="Impacto estimado si se aprueba">
              <div className="datos-calc">
                <span>Término del proyecto</span><b style={{ color: sim.dias > 0 ? 'var(--crit)' : 'var(--ok)' }}>{fechaCorta(sim.fin)} ({sim.dias > 0 ? '+' : ''}{sim.dias} días hábiles)</b>
                <span>Costo planificado</span><b>{sim.costo >= 0 ? '+' : ''}{pesos(sim.costo)}</b>
              </div>
              {sim.nuevas.map((a) => <div key={a.mensaje} className="alerta media" style={{ marginTop: 6 }}><AlertTriangle size={13} /> {a.mensaje}</div>)}
            </Tarjeta>
          )}
          <Tarjeta titulo="Historial">
            <div className="lista-alertas">
              {[...c.historial].reverse().map((h, i) => (
                <div key={i} className="peq"><b>{fechaCorta(h.fecha)}</b> · paso {h.paso} · <Chip color={colorEstadoCambio(h.estado)}>{h.estado}</Chip><div className="muted">{h.nota} — {h.usuario}</div></div>
              ))}
            </div>
          </Tarjeta>
        </div>
      </div>
    </Modal>
  );
}
