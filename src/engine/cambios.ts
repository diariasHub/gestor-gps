// Flujo de gestión del cambio (10 pasos) y aplicación de cambios aprobados al plan.

import type { Asignacion, Cambio, Datos, RegistroPaso } from './types';
import { estadoDePaso, PASOS_CAMBIO } from './types';

export function nuevoId(): string {
  return crypto.randomUUID();
}

/** Aplica al plan las acciones de un cambio aprobado. Devuelve los datos modificados. */
export function aplicarAcciones(datos: Datos, cambioId: string, fecha: string): Datos {
  const cambio = datos.cambios.find((c) => c.id === cambioId);
  if (!cambio) return datos;
  let actividades = datos.actividades;
  let asignaciones = datos.asignaciones;
  let proyectos = datos.proyectos;
  const acciones = cambio.acciones.map((ac) => {
    if (ac.aplicada) return ac;
    if (ac.tipo === 'duracion' && ac.actividadId) {
      actividades = actividades.map((a) => (a.id === ac.actividadId ? { ...a, duracion: Math.max(0, a.duracion + ac.delta) } : a));
    } else if (ac.tipo === 'recurso' && ac.actividadId && ac.recursoId) {
      const recurso = datos.recursos.find((r) => r.id === ac.recursoId);
      const existente = asignaciones.find((s) => s.actividadId === ac.actividadId && s.recursoId === ac.recursoId);
      const esProf = recurso?.tipo === 'profesional';
      if (existente) {
        asignaciones = asignaciones.map((s) =>
          s.id === existente.id
            ? { ...s, horasSemana: esProf ? Math.max(0, s.horasSemana + ac.delta) : s.horasSemana, cantidad: esProf ? s.cantidad : Math.max(0, s.cantidad + ac.delta) }
            : s,
        );
      } else {
        const nueva: Asignacion = {
          id: nuevoId(),
          proyectoId: cambio.proyectoId,
          actividadId: ac.actividadId,
          recursoId: ac.recursoId,
          horasSemana: esProf ? ac.delta : 0,
          cantidad: esProf ? 0 : ac.delta,
        };
        asignaciones = [...asignaciones, nueva];
      }
    } else if (ac.tipo === 'presupuesto') {
      proyectos = proyectos.map((p) => (p.id === cambio.proyectoId ? { ...p, presupuesto: p.presupuesto + ac.delta } : p));
    }
    return { ...ac, aplicada: true, aplicadaEn: fecha };
  });
  return {
    ...datos,
    actividades,
    asignaciones,
    proyectos,
    cambios: datos.cambios.map((c) => (c.id === cambioId ? { ...c, acciones } : c)),
  };
}

function registro(c: Cambio, paso: number, estado: Cambio['estado'], fecha: string, usuario: string, nota: string): RegistroPaso[] {
  return [...c.historial, { paso, estado, fecha, usuario, nota }];
}

export type DecisionCambio = 'avanzar' | 'no_amerita' | 'no_factible' | 'aprobar' | 'rechazar';

/**
 * Avanza el flujo de una solicitud. Las decisiones siguen el diagrama de la clase:
 * paso 1 "¿Amerita el cambio?" (no → se cierra), paso 2 "¿Es factible?" (no → proponer medidas factibles),
 * paso 3 decisión de aprobación (aprobar → se aplica al plan; rechazar → termina).
 */
export function avanzarCambio(datos: Datos, cambioId: string, decision: DecisionCambio, fecha: string, usuario: string, nota: string): Datos {
  const c = datos.cambios.find((x) => x.id === cambioId);
  if (!c) return datos;
  let actualizado: Cambio = c;
  if (decision === 'no_amerita') {
    actualizado = { ...c, estado: 'Rechazado', historial: registro(c, c.paso, 'Rechazado', fecha, usuario, nota || 'No amerita el cambio: se cierra el proceso') };
  } else if (decision === 'no_factible') {
    actualizado = { ...c, historial: registro(c, c.paso, c.estado, fecha, usuario, nota || 'No es factible: se proponen medidas factibles') };
  } else if (decision === 'rechazar') {
    actualizado = { ...c, estado: 'Rechazado', fechaReal: fecha, historial: registro(c, c.paso, 'Rechazado', fecha, usuario, nota || 'Solicitud rechazada') };
  } else if (decision === 'aprobar') {
    actualizado = { ...c, paso: 4, estado: 'Aprobado', historial: registro(c, 4, 'Aprobado', fecha, usuario, nota || 'Solicitud aprobada: se aplica al plan') };
    const d = { ...datos, cambios: datos.cambios.map((x) => (x.id === c.id ? actualizado : x)) };
    return aplicarAcciones(d, c.id, fecha);
  } else {
    const paso = Math.min(10, c.paso + 1);
    const estado = estadoDePaso(paso);
    actualizado = {
      ...c,
      paso,
      estado,
      fechaReal: paso === 10 ? fecha : c.fechaReal,
      historial: registro(c, paso, estado, fecha, usuario, nota || PASOS_CAMBIO[paso - 1]),
    };
  }
  return { ...datos, cambios: datos.cambios.map((x) => (x.id === c.id ? actualizado : x)) };
}

/** Cuadrante de la matriz de Eisenhower. */
export function cuadranteEisenhower(c: Pick<Cambio, 'urgente' | 'importante'>): string {
  if (c.importante && c.urgente) return 'Hazlo ya';
  if (c.importante && !c.urgente) return 'Planifica';
  if (!c.importante && c.urgente) return 'Delega';
  return 'Elimínalo';
}
