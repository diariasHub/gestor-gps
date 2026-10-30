import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../state/store';
import type { Proyecto } from '../engine/types';
import { nuevoId } from '../engine/cambios';
import { calcular } from '../engine/calculo';
import { BarraProgreso, Campo, Chip, Encabezado, Modal, Tarjeta, fecha, num, pesos } from '../ui';

export function Proyectos() {
  const { datos, proyectoId, setProyectoId, esAdmin, mutar, setVista } = useStore();
  const [editando, setEditando] = useState<Proyecto | null>(null);

  const eliminar = (p: Proyecto) => {
    if (!confirm(`¿Eliminar el proyecto "${p.nombre}" y todos sus registros?`)) return;
    mutar((d) => ({
      proyectos: d.proyectos.filter((x) => x.id !== p.id),
      actividades: d.actividades.filter((x) => x.proyectoId !== p.id),
      dependencias: d.dependencias.filter((x) => x.proyectoId !== p.id),
      recursos: d.recursos.filter((x) => x.proyectoId !== p.id),
      asignaciones: d.asignaciones.filter((x) => x.proyectoId !== p.id),
      hitos: d.hitos.filter((x) => x.proyectoId !== p.id),
      kpis: d.kpis.filter((x) => x.proyectoId !== p.id),
      mediciones: d.mediciones.filter((x) => x.proyectoId !== p.id),
      cambios: d.cambios.filter((x) => x.proyectoId !== p.id),
      lineasBase: d.lineasBase.filter((x) => x.proyectoId !== p.id),
    }), `Se eliminó el proyecto ${p.codigo}`);
  };

  return (
    <div>
      <Encabezado titulo="Administración de proyectos" sub="Crear, editar, consultar y cerrar proyectos. El avance se calcula automáticamente.">
        {esAdmin && (
          <button className="btn prim" onClick={() => setEditando({ id: '', codigo: '', nombre: '', descripcion: '', responsable: '', fechaInicio: '2026-03-02', fechaTerminoPlan: '2026-10-30', presupuesto: 0, estado: 'Planificado', fechaCorte: '2026-03-02', feriados: [] })}>
            <Plus size={15} /> Nuevo proyecto
          </button>
        )}
      </Encabezado>
      <div className="grid g2">
        {datos.proyectos.map((p) => {
          const c = calcular(datos, p.id);
          const av = c ? (c.variables.trabajo_total ? ((c.variables.trabajo_completado ?? 0) / (c.variables.trabajo_total ?? 1)) * 100 : 0) : 0;
          return (
            <Tarjeta key={p.id} titulo={<>{p.codigo} · {p.nombre}</>} derecha={<Chip color={p.estado === 'En ejecución' ? 'azul' : p.estado === 'Terminado' ? 'verde' : p.estado === 'Suspendido' ? 'rojo' : 'morado'}>{p.estado}</Chip>}>
              <p className="peq muted" style={{ marginTop: 0 }}>{p.descripcion}</p>
              <div className="datos-calc">
                <span>Responsable</span><b>{p.responsable}</b>
                <span>Inicio / término planificado</span><b>{fecha(p.fechaInicio)} → {fecha(p.fechaTerminoPlan)}</b>
                <span>Término calculado</span><b>{fecha(c?.finProyecto)}</b>
                <span>Presupuesto autorizado</span><b>{pesos(p.presupuesto)}</b>
                <span>Costo planificado</span><b>{pesos(c?.costoPlanTotal)}</b>
                <span>Fecha de corte</span><b>{fecha(p.fechaCorte)}</b>
              </div>
              <div className="fila peq" style={{ marginTop: 10 }}><span>Avance calculado</span><b style={{ marginLeft: 'auto' }}>{num(av, 1)} %</b></div>
              <BarraProgreso valor={av} />
              <div className="fila" style={{ marginTop: 12 }}>
                <button className={`btn chico ${p.id === proyectoId ? 'prim' : ''}`} onClick={() => { setProyectoId(p.id); setVista('tablero-proyecto'); }}>{p.id === proyectoId ? 'Proyecto activo' : 'Abrir'}</button>
                {esAdmin && <button className="btn chico" onClick={() => setEditando(p)}><Pencil size={13} /> Editar</button>}
                {esAdmin && p.estado !== 'Terminado' && <button className="btn chico" onClick={() => confirm('¿Cerrar el proyecto (estado Terminado)?') && mutar((d) => ({ ...d, proyectos: d.proyectos.map((x) => (x.id === p.id ? { ...x, estado: 'Terminado' } : x)) }), `Proyecto ${p.codigo} cerrado`)}>Cerrar proyecto</button>}
                {esAdmin && datos.proyectos.length > 1 && <button className="btn chico peligro" onClick={() => eliminar(p)}><Trash2 size={13} /></button>}
              </div>
            </Tarjeta>
          );
        })}
      </div>
      {editando && <FormProyecto proyecto={editando} onCerrar={() => setEditando(null)} />}
    </div>
  );
}

function FormProyecto({ proyecto, onCerrar }: { proyecto: Proyecto; onCerrar: () => void }) {
  const { mutar, setProyectoId, datos } = useStore();
  const [p, setP] = useState<Proyecto>(proyecto);
  const [feriado, setFeriado] = useState({ fecha: '', descripcion: '' });
  const errores: string[] = [];
  if (!p.codigo.trim() || !p.nombre.trim()) errores.push('Código y nombre son obligatorios.');
  if (p.fechaTerminoPlan <= p.fechaInicio) errores.push('El término debe ser posterior al inicio.');
  if (p.presupuesto < 0) errores.push('El presupuesto no puede ser negativo.');
  if (datos.proyectos.some((x) => x.id !== p.id && x.codigo === p.codigo)) errores.push('Ya existe un proyecto con ese código.');
  const guardar = () => {
    if (errores.length) return;
    const nuevo = !p.id;
    const fila = nuevo ? { ...p, id: nuevoId() } : p;
    mutar((d) => ({ ...d, proyectos: nuevo ? [...d.proyectos, fila] : d.proyectos.map((x) => (x.id === p.id ? fila : x)) }), nuevo ? `Nuevo proyecto ${p.codigo}` : `Se actualizó el proyecto ${p.codigo}`);
    if (nuevo) setProyectoId(fila.id);
    onCerrar();
  };
  return (
    <Modal titulo={p.id ? 'Editar proyecto' : 'Nuevo proyecto'} onCerrar={onCerrar} ancho={760} pie={<><button className="btn" onClick={onCerrar}>Cancelar</button><button className="btn prim" onClick={guardar} disabled={errores.length > 0}>Guardar</button></>}>
      <div className="form f3">
        <Campo label="Código"><input value={p.codigo} onChange={(e) => setP({ ...p, codigo: e.target.value })} /></Campo>
        <Campo label="Nombre" className="ancho"><input value={p.nombre} onChange={(e) => setP({ ...p, nombre: e.target.value })} /></Campo>
        <Campo label="Descripción (objetivo y alcance)" className="ancho"><textarea value={p.descripcion} onChange={(e) => setP({ ...p, descripcion: e.target.value })} /></Campo>
        <Campo label="Responsable (director/jefe)"><input value={p.responsable} onChange={(e) => setP({ ...p, responsable: e.target.value })} /></Campo>
        <Campo label="Inicio planificado"><input type="date" value={p.fechaInicio} onChange={(e) => setP({ ...p, fechaInicio: e.target.value })} /></Campo>
        <Campo label="Término planificado"><input type="date" value={p.fechaTerminoPlan} onChange={(e) => setP({ ...p, fechaTerminoPlan: e.target.value })} /></Campo>
        <Campo label="Presupuesto autorizado ($)"><input type="number" min={0} value={p.presupuesto} onChange={(e) => setP({ ...p, presupuesto: Number(e.target.value) })} /></Campo>
        <Campo label="Estado"><select value={p.estado} onChange={(e) => setP({ ...p, estado: e.target.value as Proyecto['estado'] })}>{['Planificado', 'En ejecución', 'Suspendido', 'Terminado'].map((s) => <option key={s}>{s}</option>)}</select></Campo>
        <Campo label="Fecha de corte (control)" ayuda="Fecha a la que se mide el avance y los atrasos"><input type="date" value={p.fechaCorte} onChange={(e) => setP({ ...p, fechaCorte: e.target.value })} /></Campo>
      </div>
      <div className="sep" />
      <div className="peq muted" style={{ marginBottom: 6 }}>Calendario laboral: lunes a viernes, excepto estos días no laborables</div>
      <div className="fila wrap" style={{ marginBottom: 8 }}>
        {p.feriados.map((f) => (
          <span key={f.fecha} className="chip">{fecha(f.fecha)} · {f.descripcion} <button className="icono-btn" style={{ padding: 0 }} onClick={() => setP({ ...p, feriados: p.feriados.filter((x) => x.fecha !== f.fecha) })}>×</button></span>
        ))}
      </div>
      <div className="fila">
        <input className="entrada" type="date" style={{ width: 160 }} value={feriado.fecha} onChange={(e) => setFeriado({ ...feriado, fecha: e.target.value })} />
        <input className="entrada" placeholder="Descripción" value={feriado.descripcion} onChange={(e) => setFeriado({ ...feriado, descripcion: e.target.value })} />
        <button className="btn" disabled={!feriado.fecha} onClick={() => { setP({ ...p, feriados: [...p.feriados.filter((x) => x.fecha !== feriado.fecha), feriado].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)) }); setFeriado({ fecha: '', descripcion: '' }); }}>Agregar día no laborable</button>
      </div>
      {errores.map((e) => <div key={e} className="alerta alta" style={{ marginTop: 6 }}>{e}</div>)}
    </Modal>
  );
}
