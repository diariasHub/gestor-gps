import { useMemo, useState } from 'react';
import { AlertTriangle, Printer } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useStore } from '../state/store';
import type { KPI } from '../engine/types';
import { BarraProgreso, Chip, Encabezado, Punto, Tarjeta, colorEstadoCambio, colorEstadoHito, colorSemaforo, fechaCorta, millones, num, pesos } from '../ui';
import { textoMeta } from './KPIs';
import { Eisenhower } from './Cambios';

function TileKPI({ k }: { k: KPI }) {
  const { calc } = useStore();
  const r = calc!.kpis.get(k.id)!;
  return (
    <div className={`tarjeta kpi-tile ${r.semaforo}`} title={`${k.objetivo}\nFórmula: ${k.formula || 'manual'}`}>
      <div className="nom"><Punto s={r.semaforo} />{k.codigo} · {k.nombre}</div>
      <div className="val">{num(r.valor, k.unidad === 'índice' ? 2 : 1)}<small>{k.unidad}</small></div>
      <div className="meta">Meta {textoMeta(k)}</div>
    </div>
  );
}

const tt = { contentStyle: { fontSize: 12, borderRadius: 8 } };

export function TableroProyecto() {
  const { datos, calc, proyectoId, setVista, setSeleccion } = useStore();
  const [etapa, setEtapa] = useState('');
  const [resp, setResp] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const etapas = datos.actividades.filter((a) => a.proyectoId === proyectoId && a.nivel === 'etapa').sort((a, b) => a.orden - b.orden);
  const responsables = [...new Set(datos.actividades.filter((a) => a.proyectoId === proyectoId).map((a) => a.responsable).filter(Boolean))].sort();

  const hojas = useMemo(() => {
    if (!calc) return [];
    const etapaDe = (id: string): string => {
      let a = calc.porId.get(id);
      while (a?.parentId) a = calc.porId.get(a.parentId);
      return a?.id ?? '';
    };
    return calc.prog.hojas.filter((h) => {
      const p = calc.prog.porId.get(h.id);
      if (etapa && etapaDe(h.id) !== etapa) return false;
      if (resp && h.responsable !== resp) return false;
      if (desde && p && p.fin < desde) return false;
      if (hasta && p && p.inicio > hasta) return false;
      return true;
    });
  }, [calc, etapa, resp, desde, hasta]);

  if (!calc) return null;
  const p = calc.proyecto;
  const kpis = datos.kpis.filter((k) => k.proyectoId === proyectoId && k.categoria === 'proyecto');
  const hitos = datos.hitos.filter((h) => h.proyectoId === proyectoId);
  const filtrado = !!(etapa || resp || desde || hasta);

  // métricas del subconjunto filtrado
  const sum = (f: (id: string) => number) => hojas.reduce((s, h) => s + f(h.id), 0);
  const trabajo = hojas.reduce((s, h) => s + h.duracion, 0);
  const avanceF = trabajo ? hojas.reduce((s, h) => s + h.duracion * (calc.avance.get(h.id) ?? 0), 0) / trabajo : 0;
  const esperadoF = trabajo ? hojas.reduce((s, h) => s + h.duracion * (calc.esperado.get(h.id) ?? 0), 0) / trabajo : 0;
  const costoPlanF = sum((id) => calc.costoPlan.get(id) ?? 0);
  const costoRealF = sum((id) => calc.costoReal.get(id) ?? 0);
  const atrasadasF = hojas.filter((h) => calc.atrasadas.has(h.id));

  const porEtapa = etapas.map((e) => ({
    nombre: `${e.codigo}. ${e.nombre}`,
    real: Math.round(calc.avance.get(e.id) ?? 0),
    esperado: (() => {
      const hs = calc.prog.hojas.filter((h) => h.codigo.startsWith(e.codigo + '.') || h.codigo === e.codigo);
      const t = hs.reduce((s, h) => s + h.duracion, 0);
      return t ? Math.round(hs.reduce((s, h) => s + h.duracion * (calc.esperado.get(h.id) ?? 0), 0) / t) : 0;
    })(),
    plan: Math.round((calc.costoPlan.get(e.id) ?? 0) / 1e6 * 10) / 10,
    realCosto: Math.round((calc.costoReal.get(e.id) ?? 0) / 1e6 * 10) / 10,
  }));

  const profesionales = datos.recursos.filter((r) => r.proyectoId === proyectoId && r.tipo === 'profesional').map((r) => {
    const asig = datos.asignaciones.filter((s) => s.recursoId === r.id && hojas.some((h) => h.id === s.actividadId));
    const horas = asig.reduce((s, x) => s + x.horasSemana * ((calc.porId.get(x.actividadId)?.duracion ?? 0) / 5), 0);
    return { nombre: r.nombre.split(' ')[0], horas: Math.round(horas), sobre: calc.sobreasignaciones.filter((o) => o.recursoId === r.id).length };
  });

  const curva = calc.curvaS.map((c) => ({ fecha: fechaCorta(c.fecha), actual: Math.round(c.pv / 1e5) / 10, base: c.pvBase === null ? null : Math.round(c.pvBase / 1e5) / 10, iso: c.fecha }));
  const puntoCorte = curva.reduce((best, c) => (c.iso <= p.fechaCorte ? c : best), curva[0]);
  const alertas = calc.alertas.filter((a) => a.tipo !== 'cambio');

  return (
    <div>
      <Encabezado titulo="Tablero 1 · Seguimiento del proyecto" sub={<>{p.nombre} · estado <b>{p.estado}</b> · fecha de corte <b>{fechaCorta(p.fechaCorte)}</b></>}>
        <button className="btn" onClick={() => window.print()}><Printer size={15} /> Imprimir</button>
      </Encabezado>

      <div className="tarjeta no-imprimir" style={{ marginBottom: 14 }}>
        <div className="cuerpo fila wrap">
          <b className="peq">Filtros</b>
          <select className="entrada" style={{ width: 200 }} value={etapa} onChange={(e) => setEtapa(e.target.value)}><option value="">Todas las etapas</option>{etapas.map((e) => <option key={e.id} value={e.id}>{e.codigo}. {e.nombre}</option>)}</select>
          <select className="entrada" style={{ width: 180 }} value={resp} onChange={(e) => setResp(e.target.value)}><option value="">Todos los responsables</option>{responsables.map((r) => <option key={r}>{r}</option>)}</select>
          <span className="peq muted">Desde</span><input className="entrada" type="date" style={{ width: 150 }} value={desde} onChange={(e) => setDesde(e.target.value)} />
          <span className="peq muted">Hasta</span><input className="entrada" type="date" style={{ width: 150 }} value={hasta} onChange={(e) => setHasta(e.target.value)} />
          {filtrado && <button className="btn chico" onClick={() => { setEtapa(''); setResp(''); setDesde(''); setHasta(''); }}>Limpiar</button>}
          <span className="peq muted" style={{ marginLeft: 'auto' }}>{hojas.length} actividades en la vista</span>
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <div className="tarjeta kpi-tile">
          <div className="nom">Avance {filtrado ? '(filtro)' : 'del proyecto'}</div>
          <div className="val">{num(avanceF, 1)}<small>%</small></div>
          <BarraProgreso valor={avanceF} />
          <div className="meta">Esperado según línea base: {num(esperadoF, 1)} %</div>
        </div>
        <div className="tarjeta kpi-tile">
          <div className="nom">Costo real vs planificado</div>
          <div className="val">{millones(costoRealF)}<small>de {millones(costoPlanF)}</small></div>
          <BarraProgreso valor={costoPlanF ? (costoRealF / costoPlanF) * 100 : 0} color="var(--brand)" />
          <div className="meta">Presupuesto autorizado {millones(p.presupuesto)} · uso {num((calc.costoPlanTotal / p.presupuesto) * 100, 0)} %</div>
        </div>
        <div className="tarjeta kpi-tile">
          <div className="nom">Término calculado</div>
          <div className="val" style={{ color: calc.finProyecto > p.fechaTerminoPlan ? 'var(--crit)' : undefined }}>{fechaCorta(calc.finProyecto)}</div>
          <div className="meta">Comprometido {fechaCorta(p.fechaTerminoPlan)} · línea base {fechaCorta(calc.lineaBase?.fin)}</div>
          <div className="meta">{calc.desvioPlazo !== null && <>Desviación <b style={{ color: calc.desvioPlazo > 0 ? 'var(--crit)' : 'var(--ok)' }}>{calc.desvioPlazo > 0 ? '+' : ''}{calc.desvioPlazo} días hábiles</b></>}</div>
        </div>
        <div className="tarjeta kpi-tile">
          <div className="nom">Atrasos y alertas</div>
          <div className="val" style={{ color: atrasadasF.length ? 'var(--crit)' : 'var(--ok)' }}>{atrasadasF.length}<small>actividades atrasadas</small></div>
          <div className="meta">{calc.sobreasignaciones.length} semanas con sobreasignación · {alertas.filter((a) => a.gravedad === 'alta').length} alertas altas</div>
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: 14 }}>
        {kpis.map((k) => <TileKPI key={k.id} k={k} />)}
      </div>

      <div className="grid g2" style={{ marginBottom: 14 }}>
        <Tarjeta titulo="Curva S · valor planificado acumulado (millones)">
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={curva}>
                <CartesianGrid stroke="#eef0f6" />
                <XAxis dataKey="fecha" fontSize={10.5} interval={3} />
                <YAxis fontSize={10.5} />
                <Tooltip {...tt} />
                <Legend wrapperStyle={{ fontSize: 11.5 }} />
                <Line dataKey="base" name="Línea base" stroke="#9aa1b5" strokeDasharray="5 4" dot={false} />
                <Line dataKey="actual" name="Plan actual" stroke="#5b7cfa" strokeWidth={2} dot={false} />
                {puntoCorte && <ReferenceLine x={puntoCorte.fecha} stroke="#7a5cf5" strokeDasharray="4 3" label={{ value: 'Corte', fontSize: 10, fill: '#7a5cf5' }} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="fila wrap peq">
            <span>PV {pesos(calc.pv)}</span><span>· EV {pesos(calc.ev)}</span><span>· AC {pesos(calc.ac)}</span>
            <span>· SPI <b>{num(calc.pv ? calc.ev / calc.pv : null, 2)}</b></span><span>· CPI <b>{num(calc.ac ? calc.ev / calc.ac : null, 2)}</b></span>
          </div>
        </Tarjeta>
        <Tarjeta titulo="Avance real vs esperado por etapa (%)">
          <div style={{ height: 270 }}>
            <ResponsiveContainer>
              <BarChart data={porEtapa} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid stroke="#eef0f6" />
                <XAxis type="number" domain={[0, 100]} fontSize={10.5} />
                <YAxis type="category" dataKey="nombre" fontSize={10.5} width={130} />
                <Tooltip {...tt} />
                <Legend wrapperStyle={{ fontSize: 11.5 }} />
                <Bar dataKey="esperado" name="Esperado" fill="#c9cede" radius={3} />
                <Bar dataKey="real" name="Real" fill="#7a5cf5" radius={3} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
      </div>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <Tarjeta titulo="Presupuesto por etapa (millones)">
          <div style={{ height: 230 }}>
            <ResponsiveContainer>
              <BarChart data={porEtapa}>
                <CartesianGrid stroke="#eef0f6" />
                <XAxis dataKey="nombre" fontSize={9.5} tickFormatter={(v: string) => v.split('.')[0]} />
                <YAxis fontSize={10.5} />
                <Tooltip {...tt} />
                <Legend wrapperStyle={{ fontSize: 11.5 }} />
                <Bar dataKey="plan" name="Planificado" fill="#5b7cfa" radius={3} />
                <Bar dataKey="realCosto" name="Real" fill="#23946a" radius={3} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
        <Tarjeta titulo="Recursos · horas asignadas por profesional">
          <div style={{ height: 230 }}>
            <ResponsiveContainer>
              <BarChart data={profesionales}>
                <CartesianGrid stroke="#eef0f6" />
                <XAxis dataKey="nombre" fontSize={10.5} />
                <YAxis fontSize={10.5} />
                <Tooltip {...tt} />
                <Bar dataKey="horas" name="Horas asignadas" radius={3}>
                  {profesionales.map((x, i) => <Cell key={i} fill={x.sobre ? '#e5484d' : '#7a5cf5'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="peq muted">En rojo: profesionales con semanas sobreasignadas.</div>
        </Tarjeta>
        <Tarjeta titulo="Hitos">
          <table className="tabla">
            <tbody>
              {hitos.map((h) => {
                const e = calc.hitos.get(h.id)!;
                return (
                  <tr key={h.id}>
                    <td><b>{h.codigo}</b> {h.nombre}<div className="peq muted">Comprometido {fechaCorta(h.fechaComprometida)} · {e.completado ? 'real' : 'pronóstico'} {fechaCorta(e.fechaRealEfectiva ?? e.fechaPronosticada)}</div></td>
                    <td><Chip color={colorEstadoHito(e.estado)}>{e.estado}</Chip></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Tarjeta>
      </div>

      <div className="grid g2">
        <Tarjeta titulo={`Actividades atrasadas (${atrasadasF.length})`}>
          <table className="tabla">
            <thead><tr><th>Actividad</th><th>Responsable</th><th className="num">Real</th><th className="num">Esperado</th><th>Fin</th></tr></thead>
            <tbody>
              {atrasadasF.map((h) => (
                <tr key={h.id} className="clic" onClick={() => { setSeleccion(h.id); setVista('gantt'); }}>
                  <td>{h.codigo} {h.nombre} {calc.prog.porId.get(h.id)?.critica && <Chip color="rojo">crítica</Chip>}</td>
                  <td className="peq">{h.responsable}</td>
                  <td className="num">{num(calc.avance.get(h.id), 0)} %</td>
                  <td className="num">{num(calc.esperado.get(h.id), 0)} %</td>
                  <td className="peq">{fechaCorta(calc.prog.porId.get(h.id)?.fin)}</td>
                </tr>
              ))}
              {!atrasadasF.length && <tr><td colSpan={5} className="vacio">Sin actividades atrasadas</td></tr>}
            </tbody>
          </table>
        </Tarjeta>
        <Tarjeta titulo={`Alertas del proyecto (${alertas.length})`}>
          <div className="lista-alertas">
            {alertas.map((a, i) => <div key={i} className={`alerta ${a.gravedad}`}><AlertTriangle size={14} style={{ flex: 'none', marginTop: 1 }} />{a.mensaje}</div>)}
            {!alertas.length && <div className="muted">Sin alertas.</div>}
          </div>
        </Tarjeta>
      </div>
    </div>
  );
}

const COLORES_ESTADO: Record<string, string> = { Abierto: '#5b7cfa', 'En evaluación': '#7a5cf5', Aprobado: '#23946a', Rechazado: '#e5484d', 'En implementación': '#d98a1c', Cerrado: '#687089' };

export function TableroCambios() {
  const { datos, calc, proyectoId, setVista } = useStore();
  const [estado, setEstado] = useState('');
  const [prioridad, setPrioridad] = useState('');
  const [tipo, setTipo] = useState('');
  const [desde, setDesde] = useState('');
  if (!calc) return null;
  const todos = datos.cambios.filter((c) => c.proyectoId === proyectoId);
  const cambios = todos.filter((c) => (!estado || c.estado === estado) && (!prioridad || c.prioridad === prioridad) && (!tipo || c.tipo === tipo) && (!desde || c.fecha >= desde));
  const kpis = datos.kpis.filter((k) => k.proyectoId === proyectoId && k.categoria === 'cambio');
  const corte = calc.proyecto.fechaCorte;

  const porEstado = Object.keys(COLORES_ESTADO).map((e) => ({ name: e, value: cambios.filter((c) => c.estado === e).length })).filter((x) => x.value);
  const porRiesgo = ['Bajo', 'Medio', 'Alto', 'Crítico'].map((r) => ({ riesgo: r, abiertas: cambios.filter((c) => c.riesgo === r && c.estado !== 'Cerrado' && c.estado !== 'Rechazado').length, total: cambios.filter((c) => c.riesgo === r).length }));
  const tiempos = cambios.map((c) => ({ codigo: c.codigo, aprobacion: calc.diasAprobacion.get(c.id) ?? 0, implementacion: calc.diasImplementacion.get(c.id) ?? 0 }));
  const costos = cambios.map((c) => ({ codigo: c.codigo, estimado: Math.round(c.costoEstimado / 1e5) / 10, real: Math.round(c.costoReal / 1e5) / 10 }));
  const alertas = calc.alertas.filter((a) => a.tipo === 'cambio' || (a.tipo === 'kpi' && kpis.some((k) => k.id === a.ref)));

  return (
    <div>
      <Encabezado titulo="Tablero 2 · Gestión del cambio" sub="Distribución por estado, tiempos, riesgos, costos, cumplimiento de etapas, efectividad y adopción">
        <button className="btn" onClick={() => window.print()}><Printer size={15} /> Imprimir</button>
      </Encabezado>
      <div className="tarjeta no-imprimir" style={{ marginBottom: 14 }}>
        <div className="cuerpo fila wrap">
          <b className="peq">Filtros</b>
          <select className="entrada" style={{ width: 170 }} value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos los estados</option>{Object.keys(COLORES_ESTADO).map((e) => <option key={e}>{e}</option>)}</select>
          <select className="entrada" style={{ width: 150 }} value={prioridad} onChange={(e) => setPrioridad(e.target.value)}><option value="">Toda prioridad</option>{['Baja', 'Media', 'Alta', 'Crítica'].map((e) => <option key={e}>{e}</option>)}</select>
          <select className="entrada" style={{ width: 150 }} value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todo tipo</option>{['Alcance', 'Tiempo', 'Costo', 'Recurso', 'Tecnología', 'Organización'].map((e) => <option key={e}>{e}</option>)}</select>
          <span className="peq muted">Solicitadas desde</span><input className="entrada" type="date" style={{ width: 150 }} value={desde} onChange={(e) => setDesde(e.target.value)} />
          <span className="peq muted" style={{ marginLeft: 'auto' }}>{cambios.length} de {todos.length} solicitudes</span>
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: 14 }}>
        {kpis.map((k) => <TileKPI key={k.id} k={k} />)}
      </div>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <Tarjeta titulo="Solicitudes por estado">
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={porEstado} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} isAnimationActive={false}>
                  {porEstado.map((e) => <Cell key={e.name} fill={COLORES_ESTADO[e.name]} />)}
                </Pie>
                <Tooltip {...tt} />
                <Legend wrapperStyle={{ fontSize: 11.5 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
        <Tarjeta titulo="Tiempos de gestión (días)">
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={tiempos}>
                <CartesianGrid stroke="#eef0f6" />
                <XAxis dataKey="codigo" fontSize={10.5} />
                <YAxis fontSize={10.5} />
                <Tooltip {...tt} />
                <Legend wrapperStyle={{ fontSize: 11.5 }} />
                <Bar dataKey="aprobacion" name="Hasta la decisión" fill="#7a5cf5" radius={3} />
                <Bar dataKey="implementacion" name="Implementación" fill="#5cc8e0" radius={3} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
        <Tarjeta titulo="Riesgos de las solicitudes">
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={porRiesgo}>
                <CartesianGrid stroke="#eef0f6" />
                <XAxis dataKey="riesgo" fontSize={10.5} />
                <YAxis allowDecimals={false} fontSize={10.5} />
                <Tooltip {...tt} />
                <Legend wrapperStyle={{ fontSize: 11.5 }} />
                <Bar dataKey="total" name="Total" fill="#c9cede" radius={3} />
                <Bar dataKey="abiertas" name="Abiertas" fill="#e5484d" radius={3} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
      </div>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <Tarjeta titulo="Costos de los cambios (millones)">
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={costos}>
                <CartesianGrid stroke="#eef0f6" />
                <XAxis dataKey="codigo" fontSize={10.5} />
                <YAxis fontSize={10.5} />
                <Tooltip {...tt} />
                <Legend wrapperStyle={{ fontSize: 11.5 }} />
                <Bar dataKey="estimado" name="Estimado" fill="#5b7cfa" radius={3} />
                <Bar dataKey="real" name="Real" fill="#23946a" radius={3} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
        <Tarjeta titulo="Cumplimiento de etapas y adopción">
          <table className="tabla">
            <tbody>
              {cambios.filter((c) => c.estado !== 'Rechazado').map((c) => (
                <tr key={c.id}>
                  <td style={{ width: 54 }}><b>{c.codigo}</b></td>
                  <td>
                    <div className="peq muted">Paso {c.paso}/10 · adopción {c.adopcion} %</div>
                    <BarraProgreso valor={c.paso * 10} color={COLORES_ESTADO[c.estado]} />
                  </td>
                  <td><Chip color={colorEstadoCambio(c.estado)}>{c.estado}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="peq muted" style={{ marginTop: 6 }}>Efectividad: {num(calc.variables.cambios_cerrados ? ((calc.variables.cambios_exitosos ?? 0) / (calc.variables.cambios_cerrados ?? 1)) * 100 : null, 0)} % de los cambios cerrados lograron su objetivo.</div>
        </Tarjeta>
        <Tarjeta titulo="Priorización (Eisenhower)">
          <Eisenhower cambios={cambios} onClick={() => setVista('cambios')} />
        </Tarjeta>
      </div>

      <div className="grid g2">
        <Tarjeta titulo={`Alertas de gestión del cambio (${alertas.length})`}>
          <div className="lista-alertas">
            {alertas.map((a, i) => <div key={i} className={`alerta ${a.gravedad}`}><AlertTriangle size={14} style={{ flex: 'none', marginTop: 1 }} />{a.mensaje}</div>)}
            {!alertas.length && <div className="muted">Sin alertas.</div>}
          </div>
        </Tarjeta>
        <Tarjeta titulo="Solicitudes y acciones correctivas">
          <table className="tabla">
            <thead><tr><th>ID</th><th>Solicitud</th><th>Comprometida</th><th>Acciones correctivas</th></tr></thead>
            <tbody>
              {cambios.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.codigo}</b></td>
                  <td className="peq">{c.titulo}</td>
                  <td className="peq" style={{ color: c.estado !== 'Cerrado' && c.estado !== 'Rechazado' && c.fechaComprometida < corte ? 'var(--crit)' : undefined }}>{fechaCorta(c.fechaComprometida)}</td>
                  <td className="peq muted">{c.accionesCorrectivas || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      </div>
    </div>
  );
}

export { colorSemaforo };
