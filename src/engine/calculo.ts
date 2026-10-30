// Motor de cálculo: a partir de los datos base deriva fechas, costos, avance,
// atrasos, sobreasignaciones, estado de hitos, variables y KPI con semáforo.
// Toda la aplicación lee de este resultado, por eso cualquier cambio se propaga
// de forma coherente al Gantt, a los costos, a los KPI y a los tableros.

import type { Actividad, Asignacion, Cambio, Datos, Hito, KPI, LineaBase, Proyecto, Recurso } from './types';
import { Calendario, diasCalendario, parseISO, toISO } from './calendario';
import { programar, type Programa, type ResultadoProgramacion } from './programacion';
import { evaluarFormula } from './formula';

export type Semaforo = 'verde' | 'amarillo' | 'rojo' | 'gris';

export interface EstadoHito {
  fechaPronosticada: string | null;
  fechaRealEfectiva: string | null;
  completado: boolean;
  estado: 'Cumplido en plazo' | 'Cumplido con atraso' | 'Vencido' | 'En riesgo' | 'Pendiente';
  atrasoDias: number; // días hábiles (pronosticada o real - comprometida)
  avance: number;
}

export interface ResultadoKPI {
  valor: number | null;
  semaforo: Semaforo;
  error: string | null;
}

export interface Sobreasignacion {
  recursoId: string;
  semana: string; // lunes de la semana
  asignadas: number;
  disponibles: number;
  actividadIds: string[];
}

export interface Alerta {
  tipo: 'atraso' | 'sobreasignacion' | 'hito' | 'kpi' | 'cambio' | 'presupuesto' | 'plazo';
  gravedad: 'alta' | 'media';
  mensaje: string;
  ref?: string;
}

export interface Calculo {
  proyecto: Proyecto;
  cal: Calendario;
  prog: ResultadoProgramacion;
  actividades: Actividad[];
  porId: Map<string, Actividad>;
  costoPlan: Map<string, number>;
  costoReal: Map<string, number>;
  costoAsignacion: Map<string, number>;
  avance: Map<string, number>;
  esperado: Map<string, number>;
  atrasadas: Set<string>;
  corteIdx: number;
  finIdx: number;
  finProyecto: string;
  costoPlanTotal: number;
  costoRealTotal: number;
  pv: number;
  ev: number;
  ac: number;
  sobreasignaciones: Sobreasignacion[];
  hitos: Map<string, EstadoHito>;
  variables: Record<string, number | null>;
  kpis: Map<string, ResultadoKPI>;
  alertas: Alerta[];
  curvaS: { fecha: string; pv: number; pvBase: number | null }[];
  lineaBase: LineaBase | null;
  desvioPlazo: number | null; // días hábiles fin actual vs línea base
  cambiosPorActividad: Map<string, string[]>;
  diasAprobacion: Map<string, number | null>;
  diasImplementacion: Map<string, number | null>;
  ciclo: string[] | null;
}

export interface DescVariable {
  nombre: string;
  descripcion: string;
  ambito: 'proyecto' | 'cambio' | 'hito';
}

export const VARIABLES_BASE: DescVariable[] = [
  { nombre: 'trabajo_total', descripcion: 'Suma de duraciones de actividades (días hábiles)', ambito: 'proyecto' },
  { nombre: 'trabajo_completado', descripcion: 'Trabajo completado ponderado por avance (días hábiles)', ambito: 'proyecto' },
  { nombre: 'actividades_evaluadas', descripcion: 'Actividades que ya debían comenzar a la fecha de corte', ambito: 'proyecto' },
  { nombre: 'actividades_atrasadas', descripcion: 'Actividades cuyo avance es menor al esperado', ambito: 'proyecto' },
  { nombre: 'actividades_terminadas', descripcion: 'Actividades con 100 % de avance', ambito: 'proyecto' },
  { nombre: 'actividades_terminadas_plazo', descripcion: 'Actividades terminadas en o antes de su fin planificado', ambito: 'proyecto' },
  { nombre: 'hitos_total', descripcion: 'Cantidad de hitos', ambito: 'hito' },
  { nombre: 'hitos_cumplidos', descripcion: 'Hitos cumplidos', ambito: 'hito' },
  { nombre: 'hitos_cumplidos_plazo', descripcion: 'Hitos cumplidos en o antes de la fecha comprometida', ambito: 'hito' },
  { nombre: 'hitos_vencidos_o_completados', descripcion: 'Hitos vencidos (fecha pasada) o completados', ambito: 'hito' },
  { nombre: 'presupuesto', descripcion: 'Presupuesto autorizado del proyecto ($)', ambito: 'proyecto' },
  { nombre: 'costo_planificado_total', descripcion: 'Costo planificado total ($)', ambito: 'proyecto' },
  { nombre: 'costo_planificado_fecha', descripcion: 'Valor planificado a la fecha de corte, PV ($)', ambito: 'proyecto' },
  { nombre: 'valor_ganado', descripcion: 'Valor ganado, EV ($)', ambito: 'proyecto' },
  { nombre: 'costo_real', descripcion: 'Costo real acumulado, AC ($)', ambito: 'proyecto' },
  { nombre: 'horas_asignadas', descripcion: 'Horas de profesionales asignadas en el proyecto', ambito: 'proyecto' },
  { nombre: 'horas_disponibles', descripcion: 'Horas disponibles de profesionales durante el proyecto', ambito: 'proyecto' },
  { nombre: 'semanas_sobreasignadas', descripcion: 'Semanas-persona con sobreasignación', ambito: 'proyecto' },
  { nombre: 'desvio_plazo_dias', descripcion: 'Días hábiles de diferencia entre el fin actual y el de la línea base', ambito: 'proyecto' },
  { nombre: 'cambios_total', descripcion: 'Solicitudes de cambio registradas', ambito: 'cambio' },
  { nombre: 'cambios_abiertos', descripcion: 'Solicitudes no cerradas ni rechazadas', ambito: 'cambio' },
  { nombre: 'cambios_aprobados', descripcion: 'Solicitudes aprobadas (incluye en implementación y cerradas)', ambito: 'cambio' },
  { nombre: 'cambios_rechazados', descripcion: 'Solicitudes rechazadas', ambito: 'cambio' },
  { nombre: 'cambios_decididos', descripcion: 'Solicitudes aprobadas o rechazadas', ambito: 'cambio' },
  { nombre: 'cambios_cerrados', descripcion: 'Solicitudes cerradas (paso 10)', ambito: 'cambio' },
  { nombre: 'cambios_cerrados_plazo', descripcion: 'Cerradas en o antes de la fecha comprometida', ambito: 'cambio' },
  { nombre: 'cambios_exitosos', descripcion: 'Cerradas con resultado exitoso', ambito: 'cambio' },
  { nombre: 'cambios_atrasados', descripcion: 'Abiertas con fecha comprometida vencida', ambito: 'cambio' },
  { nombre: 'cambios_riesgo_alto_abiertos', descripcion: 'Abiertas con riesgo alto o crítico', ambito: 'cambio' },
  { nombre: 'dias_promedio_aprobacion', descripcion: 'Días promedio desde la solicitud hasta la decisión', ambito: 'cambio' },
  { nombre: 'dias_promedio_implementacion', descripcion: 'Días promedio desde la aprobación hasta el cierre', ambito: 'cambio' },
  { nombre: 'impacto_costo_cambios', descripcion: 'Costo estimado de los cambios aprobados ($)', ambito: 'cambio' },
  { nombre: 'costo_real_cambios', descripcion: 'Costo real de los cambios aprobados ($)', ambito: 'cambio' },
  { nombre: 'impacto_plazo_cambios', descripcion: 'Días agregados al plan por cambios aprobados', ambito: 'cambio' },
  { nombre: 'adopcion_promedio', descripcion: 'Adopción promedio (%) de cambios en implementación o cerrados', ambito: 'cambio' },
  { nombre: 'pasos_completados', descripcion: 'Pasos del flujo completados por las solicitudes aprobadas', ambito: 'cambio' },
  { nombre: 'pasos_esperados', descripcion: 'Pasos que deberían estar completos según fecha comprometida', ambito: 'cambio' },
];

function semaforoKPI(k: KPI, v: number | null): Semaforo {
  if (v === null) return 'gris';
  const tol = Math.abs(k.tolerancia || 0);
  if (k.sentido === 'mayor') return v >= k.meta ? 'verde' : v >= k.meta - tol ? 'amarillo' : 'rojo';
  if (k.sentido === 'menor') return v <= k.meta ? 'verde' : v <= k.meta + tol ? 'amarillo' : 'rojo';
  const max = k.metaMax ?? k.meta;
  if (v >= k.meta && v <= max) return 'verde';
  if (v >= k.meta - tol && v <= max + tol) return 'amarillo';
  return 'rojo';
}

export function costoDeAsignacion(as: Asignacion, r: Recurso, duracionDias: number): number {
  const semanas = duracionDias / 5;
  switch (r.tipo) {
    case 'profesional':
      return as.horasSemana * semanas * r.valor; // horas semanales × semanas × valor hora
    case 'tipo_profesional':
      return as.cantidad * r.valor * semanas; // cantidad requerida × tarifa semanal × semanas
    default:
      return as.cantidad * r.valor; // cantidad × valor unitario / costo
  }
}

function lunes(iso: string): string {
  const t = parseISO(iso);
  const d = new Date(t).getUTCDay();
  const delta = d === 0 ? -6 : 1 - d;
  return toISO(t + delta * 86400000);
}

export function calcular(datos: Datos, proyectoId: string): Calculo | null {
  const proyecto = datos.proyectos.find((p) => p.id === proyectoId);
  if (!proyecto) return null;
  const actividades = datos.actividades.filter((a) => a.proyectoId === proyectoId);
  const deps = datos.dependencias.filter((d) => d.proyectoId === proyectoId);
  const recursos = datos.recursos.filter((r) => r.proyectoId === proyectoId);
  const asignaciones = datos.asignaciones.filter((a) => a.proyectoId === proyectoId);
  const hitos = datos.hitos.filter((h) => h.proyectoId === proyectoId);
  const kpis = datos.kpis.filter((k) => k.proyectoId === proyectoId);
  const cambios = datos.cambios.filter((c) => c.proyectoId === proyectoId);
  const lineaBase =
    datos.lineasBase.filter((l) => l.proyectoId === proyectoId).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0] ?? null;

  const cal = new Calendario(proyecto.fechaInicio, proyecto.feriados.map((f) => f.fecha));
  const corteIdx = cal.indiceHasta(proyecto.fechaCorte);
  const prog = programar(actividades, deps, cal, corteIdx);
  const porId = new Map(actividades.map((a) => [a.id, a]));
  const recPorId = new Map(recursos.map((r) => [r.id, r]));
  const alertas: Alerta[] = [];

  if (prog.ciclo) {
    alertas.push({ tipo: 'plazo', gravedad: 'alta', mensaje: 'Existe una dependencia circular: no se puede calcular la programación.' });
  }

  const pg = (id: string): Programa | undefined => prog.porId.get(id);

  // ---- Costos por asignación y por actividad hoja
  const costoAsignacion = new Map<string, number>();
  const costoPlan = new Map<string, number>();
  const costoReal = new Map<string, number>();
  for (const h of prog.hojas) {
    costoPlan.set(h.id, 0);
    costoReal.set(h.id, h.costoReal || 0);
  }
  for (const as of asignaciones) {
    const r = recPorId.get(as.recursoId);
    const a = porId.get(as.actividadId);
    if (!r || !a) continue;
    const c = costoDeAsignacion(as, r, Math.max(0, a.duracion));
    costoAsignacion.set(as.id, c);
    if (costoPlan.has(a.id)) costoPlan.set(a.id, costoPlan.get(a.id)! + c);
  }

  // ---- Avance esperado y atrasos de hojas
  const avance = new Map<string, number>();
  const esperado = new Map<string, number>();
  const atrasadas = new Set<string>();
  let pv = 0;
  let ev = 0;
  let trabajoTotal = 0;
  let trabajoCompletado = 0;
  let actEvaluadas = 0;
  let actTerminadas = 0;
  let actTerminadasPlazo = 0;
  for (const h of prog.hojas) {
    const p = pg(h.id);
    const av = Math.max(0, Math.min(100, h.avance || 0));
    avance.set(h.id, av);
    trabajoTotal += h.duracion;
    trabajoCompletado += (h.duracion * av) / 100;
    if (!p) continue;
    // El avance esperado y el valor planificado (PV) se miden contra la línea base, si existe.
    const lb = lineaBase?.actividades[h.id];
    const baseEs = lb ? cal.indiceDesde(lb.inicio) : p.es;
    const baseDur = lb ? lb.duracion : h.duracion;
    let esp = 0;
    if (corteIdx >= baseEs) esp = baseDur === 0 ? 1 : Math.min(1, (corteIdx - baseEs + 1) / Math.max(1, baseDur));
    esperado.set(h.id, esp * 100);
    const cp = costoPlan.get(h.id) ?? 0;
    pv += (lb ? lb.costo : cp) * esp;
    ev += (cp * av) / 100;
    if (corteIdx >= baseEs) {
      actEvaluadas++;
      if (av < esp * 100 - 0.5) atrasadas.add(h.id);
    }
    if (av >= 100) {
      actTerminadas++;
      const finReal = h.finReal ?? p.fin;
      if (finReal <= p.fin || (lineaBase?.actividades[h.id] && finReal <= lineaBase.actividades[h.id].fin)) actTerminadasPlazo++;
    }
  }

  // ---- Consolidación hacia etapas y actividades padre (sin duplicar)
  const consolidar = (a: Actividad): { dur: number; tr: number; cp: number; cr: number } => {
    if (!prog.hijos.has(a.id)) {
      return { dur: a.duracion, tr: (a.duracion * (avance.get(a.id) ?? 0)) / 100, cp: costoPlan.get(a.id) ?? 0, cr: costoReal.get(a.id) ?? 0 };
    }
    let dur = 0, tr = 0, cp = 0, cr = 0;
    for (const hijo of prog.hijos.get(a.id)!) {
      const r = consolidar(hijo);
      dur += r.dur; tr += r.tr; cp += r.cp; cr += r.cr;
    }
    avance.set(a.id, dur ? (tr / dur) * 100 : 0);
    costoPlan.set(a.id, cp);
    costoReal.set(a.id, cr);
    if (prog.hijos.get(a.id)!.some((x) => atrasadas.has(x.id))) atrasadas.add(a.id);
    return { dur, tr, cp, cr };
  };
  const raices = actividades.filter((a) => !a.parentId).sort((a, b) => a.orden - b.orden);
  let costoPlanTotal = 0;
  let costoRealTotal = 0;
  for (const r of raices) {
    const c = consolidar(r);
    costoPlanTotal += c.cp;
    costoRealTotal += c.cr;
  }
  const ac = costoRealTotal;

  // ---- Sobreasignación semanal de profesionales
  const carga = new Map<string, Map<string, { horas: number; acts: Set<string> }>>();
  let horasAsignadas = 0;
  for (const as of asignaciones) {
    const r = recPorId.get(as.recursoId);
    const a = porId.get(as.actividadId);
    const p = a && pg(a.id);
    if (!r || !a || !p || r.tipo !== 'profesional') continue;
    horasAsignadas += as.horasSemana * (a.duracion / 5);
    for (let i = p.es; i < p.ef; i++) {
      const sem = lunes(cal.fecha(i));
      if (!carga.has(r.id)) carga.set(r.id, new Map());
      const m = carga.get(r.id)!;
      if (!m.has(sem)) m.set(sem, { horas: 0, acts: new Set() });
      const e = m.get(sem)!;
      e.horas += as.horasSemana / 5; // proporcional al día trabajado
      e.acts.add(a.id);
    }
  }
  const sobreasignaciones: Sobreasignacion[] = [];
  for (const [rid, semanas] of carga) {
    const r = recPorId.get(rid)!;
    for (const [sem, e] of semanas) {
      if (e.horas > r.horasSemana + 0.01) {
        sobreasignaciones.push({ recursoId: rid, semana: sem, asignadas: Math.round(e.horas * 10) / 10, disponibles: r.horasSemana, actividadIds: [...e.acts] });
      }
    }
  }
  sobreasignaciones.sort((a, b) => (a.semana < b.semana ? -1 : 1));
  const semanasProyecto = prog.finProyecto / 5;
  const horasDisponibles = recursos.filter((r) => r.tipo === 'profesional').reduce((s, r) => s + r.horasSemana * semanasProyecto, 0);

  // ---- Hitos
  const estadoHitos = new Map<string, EstadoHito>();
  let hitosCumplidos = 0, hitosCumplidosPlazo = 0, hitosVencidosOCompletados = 0;
  for (const h of hitos) {
    const progs = h.actividadIds.map((id) => pg(id)).filter(Boolean) as Programa[];
    const fechaPronosticada = progs.length ? cal.fecha(Math.max(...progs.map((p) => p.ef)) - 1) : null;
    const hojasAsoc = h.actividadIds.map((id) => porId.get(id)).filter(Boolean) as Actividad[];
    const av = hojasAsoc.length ? hojasAsoc.reduce((s, a) => s + (avance.get(a.id) ?? 0), 0) / hojasAsoc.length : 0;
    const completado = hojasAsoc.length > 0 && av >= 99.99 && h.aceptado;
    const finesReales = hojasAsoc.map((a) => a.finReal).filter(Boolean) as string[];
    const fechaRealEfectiva = completado ? h.fechaReal ?? (finesReales.length ? finesReales.sort().slice(-1)[0] : fechaPronosticada) : null;
    let estado: EstadoHito['estado'] = 'Pendiente';
    const ref = fechaRealEfectiva ?? fechaPronosticada;
    const atrasoDias = ref && h.fechaComprometida ? cal.indiceDesde(ref) - cal.indiceDesde(h.fechaComprometida) : 0;
    if (completado) {
      estado = fechaRealEfectiva! <= h.fechaComprometida ? 'Cumplido en plazo' : 'Cumplido con atraso';
      hitosCumplidos++;
      if (estado === 'Cumplido en plazo') hitosCumplidosPlazo++;
      hitosVencidosOCompletados++;
    } else if (proyecto.fechaCorte > h.fechaComprometida) {
      estado = 'Vencido';
      hitosVencidosOCompletados++;
    } else if (fechaPronosticada && fechaPronosticada > h.fechaComprometida) {
      estado = 'En riesgo';
    }
    estadoHitos.set(h.id, { fechaPronosticada, fechaRealEfectiva, completado, estado, atrasoDias, avance: av });
    if (estado === 'Vencido') alertas.push({ tipo: 'hito', gravedad: 'alta', mensaje: `Hito ${h.codigo} "${h.nombre}" vencido sin cumplirse`, ref: h.id });
    if (estado === 'En riesgo') alertas.push({ tipo: 'hito', gravedad: 'media', mensaje: `Hito ${h.codigo} "${h.nombre}" pronosticado ${atrasoDias} días hábiles después de lo comprometido`, ref: h.id });
  }

  // ---- Cambios
  const diasAprobacion = new Map<string, number | null>();
  const diasImplementacion = new Map<string, number | null>();
  let cambiosAprobados = 0, cambiosRechazados = 0, cambiosCerrados = 0, cambiosCerradosPlazo = 0, cambiosExitosos = 0;
  let cambiosAtrasados = 0, cambiosRiesgoAlto = 0, impactoCosto = 0, costoRealCambios = 0, impactoPlazo = 0;
  let sumAprob = 0, nAprob = 0, sumImpl = 0, nImpl = 0, sumAdop = 0, nAdop = 0, pasosComp = 0, pasosEsp = 0;
  const cambiosPorActividad = new Map<string, string[]>();
  for (const c of cambios) {
    const abierto = c.estado !== 'Cerrado' && c.estado !== 'Rechazado';
    const aprobado = ['Aprobado', 'En implementación', 'Cerrado'].includes(c.estado);
    if (aprobado) cambiosAprobados++;
    if (c.estado === 'Rechazado') cambiosRechazados++;
    if (c.estado === 'Cerrado') {
      cambiosCerrados++;
      if (c.fechaReal && c.fechaReal <= c.fechaComprometida) cambiosCerradosPlazo++;
      if (c.exitoso) cambiosExitosos++;
    }
    if (abierto && c.fechaComprometida < proyecto.fechaCorte) {
      cambiosAtrasados++;
      alertas.push({ tipo: 'cambio', gravedad: 'alta', mensaje: `Cambio ${c.codigo} atrasado: fecha comprometida ${c.fechaComprometida}`, ref: c.id });
    }
    if (abierto && (c.riesgo === 'Alto' || c.riesgo === 'Crítico')) {
      cambiosRiesgoAlto++;
      alertas.push({ tipo: 'cambio', gravedad: c.riesgo === 'Crítico' ? 'alta' : 'media', mensaje: `Cambio ${c.codigo} abierto con riesgo ${c.riesgo.toLowerCase()}`, ref: c.id });
    }
    if (aprobado) {
      impactoCosto += c.costoEstimado;
      costoRealCambios += c.costoReal;
      for (const a of c.acciones) if (a.aplicada && a.tipo === 'duracion') impactoPlazo += a.delta;
    }
    for (const a of c.acciones) {
      if (a.aplicada && a.actividadId) {
        if (!cambiosPorActividad.has(a.actividadId)) cambiosPorActividad.set(a.actividadId, []);
        cambiosPorActividad.get(a.actividadId)!.push(c.codigo);
      }
    }
    const decision = c.historial.find((h) => h.estado === 'Aprobado' || h.estado === 'Rechazado');
    const dA = decision ? diasCalendario(c.fecha, decision.fecha) : null;
    diasAprobacion.set(c.id, dA);
    if (dA !== null) { sumAprob += dA; nAprob++; }
    const cierre = c.historial.find((h) => h.estado === 'Cerrado');
    const dI = decision && cierre && decision.estado === 'Aprobado' ? diasCalendario(decision.fecha, cierre.fecha) : null;
    diasImplementacion.set(c.id, dI);
    if (dI !== null) { sumImpl += dI; nImpl++; }
    if (c.estado === 'En implementación' || c.estado === 'Cerrado') { sumAdop += c.adopcion; nAdop++; }
    if (aprobado) {
      pasosComp += c.paso;
      // pasos esperados: proporcional al tiempo transcurrido entre aprobación y fecha comprometida
      const ini = decision?.fecha ?? c.fecha;
      const total = Math.max(1, diasCalendario(ini, c.fechaComprometida));
      const trans = Math.max(0, diasCalendario(ini, proyecto.fechaCorte));
      pasosEsp += Math.min(10, 4 + Math.round((6 * Math.min(trans, total)) / total));
    }
  }

  const finIdx = prog.finProyecto;
  const finProyecto = cal.fecha(Math.max(0, finIdx - 1));
  const desvioPlazo = lineaBase ? cal.indiceDesde(finProyecto) - cal.indiceDesde(lineaBase.fin) : null;

  // ---- Variables para KPI
  const variables: Record<string, number | null> = {
    trabajo_total: trabajoTotal,
    trabajo_completado: trabajoCompletado,
    actividades_evaluadas: actEvaluadas,
    actividades_atrasadas: [...atrasadas].filter((id) => !prog.hijos.has(id)).length,
    actividades_terminadas: actTerminadas,
    actividades_terminadas_plazo: actTerminadasPlazo,
    hitos_total: hitos.length,
    hitos_cumplidos: hitosCumplidos,
    hitos_cumplidos_plazo: hitosCumplidosPlazo,
    hitos_vencidos_o_completados: hitosVencidosOCompletados,
    presupuesto: proyecto.presupuesto,
    costo_planificado_total: costoPlanTotal,
    costo_planificado_fecha: pv,
    valor_ganado: ev,
    costo_real: ac,
    horas_asignadas: horasAsignadas,
    horas_disponibles: horasDisponibles,
    semanas_sobreasignadas: sobreasignaciones.length,
    desvio_plazo_dias: desvioPlazo,
    cambios_total: cambios.length,
    cambios_abiertos: cambios.filter((c) => c.estado !== 'Cerrado' && c.estado !== 'Rechazado').length,
    cambios_aprobados: cambiosAprobados,
    cambios_rechazados: cambiosRechazados,
    cambios_decididos: cambiosAprobados + cambiosRechazados,
    cambios_cerrados: cambiosCerrados,
    cambios_cerrados_plazo: cambiosCerradosPlazo,
    cambios_exitosos: cambiosExitosos,
    cambios_atrasados: cambiosAtrasados,
    cambios_riesgo_alto_abiertos: cambiosRiesgoAlto,
    dias_promedio_aprobacion: nAprob ? sumAprob / nAprob : null,
    dias_promedio_implementacion: nImpl ? sumImpl / nImpl : null,
    impacto_costo_cambios: impactoCosto,
    costo_real_cambios: costoRealCambios,
    impacto_plazo_cambios: impactoPlazo,
    adopcion_promedio: nAdop ? sumAdop / nAdop : null,
    pasos_completados: pasosComp,
    pasos_esperados: pasosEsp,
  };
  for (const h of hitos) {
    const e = estadoHitos.get(h.id)!;
    variables[`${h.codigo}_atraso_dias`] = e.atrasoDias;
    variables[`${h.codigo}_cumplido`] = e.completado ? 1 : 0;
    variables[`${h.codigo}_avance`] = e.avance;
  }

  // ---- KPI
  const resKpis = new Map<string, ResultadoKPI>();
  for (const k of kpis) {
    let valor: number | null = null;
    let error: string | null = null;
    if (k.formula.trim()) {
      try {
        valor = evaluarFormula(k.formula, variables);
      } catch (e) {
        error = (e as Error).message;
      }
    } else {
      valor = k.valorManual;
    }
    const semaforo = error ? 'gris' : semaforoKPI(k, valor);
    resKpis.set(k.id, { valor, semaforo, error });
    if (semaforo === 'rojo') {
      alertas.push({
        tipo: 'kpi',
        gravedad: 'media',
        mensaje: `KPI ${k.codigo} "${k.nombre}" fuera de meta (${valor?.toFixed(1)} ${k.unidad}; meta ${k.sentido === 'menor' ? '≤' : '≥'} ${k.meta})`,
        ref: k.id,
      });
    }
  }

  // ---- Alertas de atraso, sobreasignación, presupuesto y plazo
  for (const id of atrasadas) {
    if (prog.hijos.has(id)) continue;
    const a = porId.get(id)!;
    alertas.push({ tipo: 'atraso', gravedad: pg(id)?.critica ? 'alta' : 'media', mensaje: `${a.codigo} ${a.nombre}: avance ${Math.round(avance.get(id)!)} % de ${Math.round(esperado.get(id)!)} % esperado${pg(id)?.critica ? ' (ruta crítica)' : ''}`, ref: id });
  }
  const sobrePorRecurso = new Map<string, number>();
  for (const s of sobreasignaciones) sobrePorRecurso.set(s.recursoId, (sobrePorRecurso.get(s.recursoId) ?? 0) + 1);
  for (const [rid, n] of sobrePorRecurso) {
    const r = recPorId.get(rid)!;
    const peor = sobreasignaciones.filter((s) => s.recursoId === rid).sort((a, b) => b.asignadas - a.asignadas)[0];
    alertas.push({ tipo: 'sobreasignacion', gravedad: 'alta', mensaje: `${r.nombre} sobreasignado en ${n} semana(s); máximo ${peor.asignadas} h de ${r.horasSemana} h disponibles (semana del ${peor.semana})`, ref: rid });
  }
  if (costoPlanTotal > proyecto.presupuesto) {
    alertas.push({ tipo: 'presupuesto', gravedad: 'alta', mensaje: `El costo planificado ($${Math.round(costoPlanTotal).toLocaleString('es-CL')}) supera el presupuesto autorizado` });
  }
  if (finProyecto > proyecto.fechaTerminoPlan) {
    alertas.push({ tipo: 'plazo', gravedad: 'alta', mensaje: `El término calculado (${finProyecto}) supera la fecha comprometida (${proyecto.fechaTerminoPlan})` });
  }

  // ---- Curva S (valor planificado acumulado, actual y de línea base)
  const curvaS: Calculo['curvaS'] = [];
  const hojasLB = lineaBase ? Object.entries(lineaBase.actividades) : [];
  const limite = Math.max(finIdx, lineaBase ? cal.indiceDesde(lineaBase.fin) + 1 : 0);
  for (let i = 0; i <= limite + 5; i += 5) {
    let acum = 0;
    for (const h of prog.hojas) {
      const p = pg(h.id);
      if (!p) continue;
      const cp = costoPlan.get(h.id) ?? 0;
      const f = h.duracion === 0 ? (i >= p.es ? 1 : 0) : Math.max(0, Math.min(1, (i - p.es) / h.duracion));
      acum += cp * f;
    }
    let base: number | null = null;
    if (lineaBase) {
      base = 0;
      for (const [, v] of hojasLB) {
        const s = cal.indiceDesde(v.inicio);
        const d = Math.max(1, v.duracion);
        base += v.costo * Math.max(0, Math.min(1, (i - s) / d));
      }
    }
    curvaS.push({ fecha: cal.fecha(i), pv: Math.round(acum), pvBase: base === null ? null : Math.round(base) });
  }

  const orden: Record<string, number> = { alta: 0, media: 1 };
  alertas.sort((a, b) => orden[a.gravedad] - orden[b.gravedad]);

  return {
    proyecto, cal, prog, actividades, porId, costoPlan, costoReal, costoAsignacion, avance, esperado, atrasadas,
    corteIdx, finIdx, finProyecto, costoPlanTotal, costoRealTotal, pv, ev, ac, sobreasignaciones,
    hitos: estadoHitos, variables, kpis: resKpis, alertas, curvaS, lineaBase, desvioPlazo,
    cambiosPorActividad, diasAprobacion, diasImplementacion, ciclo: prog.ciclo,
  };
}

/** Fotografía del plan actual para usarla como línea base. */
export function crearLineaBase(calc: Calculo, motivo: string, fecha: string, id: string): LineaBase {
  const actividades: LineaBase['actividades'] = {};
  for (const h of calc.prog.hojas) {
    const p = calc.prog.porId.get(h.id);
    if (!p) continue;
    actividades[h.id] = { inicio: p.inicio, fin: p.fin, costo: calc.costoPlan.get(h.id) ?? 0, duracion: h.duracion };
  }
  return { id, proyectoId: calc.proyecto.id, fecha, motivo, actividades, fin: calc.finProyecto, costoTotal: calc.costoPlanTotal };
}

export type { Hito, Cambio };
