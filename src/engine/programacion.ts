// Programación temporal: método de la ruta crítica (CPM) con dependencias
// FS, SS, FF y SF, desfases positivos o negativos y detección de ciclos.

import type { Actividad, Dependencia } from './types';
import { Calendario } from './calendario';

export interface Programa {
  es: number; // inicio temprano (índice de día hábil, inclusivo)
  ef: number; // fin temprano (exclusivo)
  ls: number; // inicio tardío
  lf: number; // fin tardío
  holgura: number;
  critica: boolean;
  inicio: string;
  fin: string; // último día hábil de trabajo
  duracion: number;
}

export interface ResultadoProgramacion {
  porId: Map<string, Programa>;
  hojas: Actividad[];
  hijos: Map<string, Actividad[]>;
  finProyecto: number;
  ciclo: string[] | null;
}

/** Devuelve true si agregar pred -> suc generaría una dependencia circular. */
export function generaCiclo(deps: Pick<Dependencia, 'predId' | 'sucId'>[], predId: string, sucId: string): boolean {
  if (predId === sucId) return true;
  // ¿existe camino desde suc hasta pred? Entonces pred -> suc cierra un ciclo.
  const ady = new Map<string, string[]>();
  for (const d of deps) {
    if (!ady.has(d.predId)) ady.set(d.predId, []);
    ady.get(d.predId)!.push(d.sucId);
  }
  const pila = [sucId];
  const visto = new Set<string>();
  while (pila.length) {
    const n = pila.pop()!;
    if (n === predId) return true;
    if (visto.has(n)) continue;
    visto.add(n);
    for (const m of ady.get(n) ?? []) pila.push(m);
  }
  return false;
}

/** Orden topológico (Kahn). Si hay ciclo devuelve los nodos involucrados. */
export function ordenTopologico(ids: string[], deps: Dependencia[]): { orden: string[]; ciclo: string[] | null } {
  const grado = new Map(ids.map((i) => [i, 0]));
  const ady = new Map<string, string[]>(ids.map((i) => [i, []]));
  for (const d of deps) {
    if (!grado.has(d.predId) || !grado.has(d.sucId)) continue;
    ady.get(d.predId)!.push(d.sucId);
    grado.set(d.sucId, grado.get(d.sucId)! + 1);
  }
  const cola = ids.filter((i) => grado.get(i) === 0);
  const orden: string[] = [];
  while (cola.length) {
    const n = cola.shift()!;
    orden.push(n);
    for (const m of ady.get(n)!) {
      grado.set(m, grado.get(m)! - 1);
      if (grado.get(m) === 0) cola.push(m);
    }
  }
  if (orden.length < ids.length) {
    return { orden, ciclo: ids.filter((i) => !orden.includes(i)) };
  }
  return { orden, ciclo: null };
}

/**
 * Calcula la programación. Si se entrega `corteIdx`, el trabajo pendiente de actividades
 * atrasadas se reprograma desde la fecha de corte (pronóstico), lo que desplaza a sus sucesoras.
 */
export function programar(acts: Actividad[], deps: Dependencia[], cal: Calendario, corteIdx: number | null = null): ResultadoProgramacion {
  const hijos = new Map<string, Actividad[]>();
  for (const a of acts) {
    if (a.parentId) {
      if (!hijos.has(a.parentId)) hijos.set(a.parentId, []);
      hijos.get(a.parentId)!.push(a);
    }
  }
  for (const l of hijos.values()) l.sort((x, y) => x.orden - y.orden);
  const hojas = acts.filter((a) => !hijos.has(a.id));
  const porIdAct = new Map(acts.map((a) => [a.id, a]));
  const hojaIds = new Set(hojas.map((h) => h.id));
  const depsHojas = deps.filter((d) => hojaIds.has(d.predId) && hojaIds.has(d.sucId));

  const { orden, ciclo } = ordenTopologico(hojas.map((h) => h.id), depsHojas);
  const porId = new Map<string, Programa>();
  if (ciclo) {
    return { porId, hojas, hijos, finProyecto: 0, ciclo };
  }

  const entrantes = new Map<string, Dependencia[]>();
  const salientes = new Map<string, Dependencia[]>();
  for (const d of depsHojas) {
    if (!entrantes.has(d.sucId)) entrantes.set(d.sucId, []);
    entrantes.get(d.sucId)!.push(d);
    if (!salientes.has(d.predId)) salientes.set(d.predId, []);
    salientes.get(d.predId)!.push(d);
  }

  // Pasada hacia adelante
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of orden) {
    const a = porIdAct.get(id)!;
    const dur = Math.max(0, Math.round(a.duracion));
    let inicio = 0;
    if (a.inicioMinimo) inicio = Math.max(inicio, cal.indiceDesde(a.inicioMinimo));
    for (const d of entrantes.get(id) ?? []) {
      const pEs = es.get(d.predId)!;
      const pEf = ef.get(d.predId)!;
      let r = 0;
      switch (d.tipo) {
        case 'FS': r = pEf + d.desfase; break;
        case 'SS': r = pEs + d.desfase; break;
        case 'FF': r = pEf + d.desfase - dur; break;
        case 'SF': r = pEs + d.desfase - dur; break;
      }
      inicio = Math.max(inicio, r);
    }
    let fin = inicio + dur;
    if (corteIdx !== null) {
      const av = Math.max(0, Math.min(100, a.avance || 0));
      if (av < 100 && dur > 0) {
        if (av === 0 && inicio <= corteIdx && !a.inicioReal) {
          // debió comenzar y no ha comenzado: no puede iniciar en el pasado
          inicio = corteIdx + 1;
          fin = inicio + dur;
        } else if (inicio <= corteIdx) {
          const pendiente = Math.ceil(dur * (1 - av / 100));
          fin = Math.max(fin, corteIdx + 1 + pendiente);
        }
      }
    }
    es.set(id, inicio);
    ef.set(id, fin);
  }
  const finProyecto = Math.max(0, ...orden.map((i) => ef.get(i)!));

  // Pasada hacia atrás
  const ls = new Map<string, number>();
  const lf = new Map<string, number>();
  for (const id of [...orden].reverse()) {
    const dur = ef.get(id)! - es.get(id)!; // duración efectiva (incluye pronóstico)
    let fin = finProyecto;
    for (const d of salientes.get(id) ?? []) {
      const sLs = ls.get(d.sucId)!;
      const sLf = lf.get(d.sucId)!;
      let r = finProyecto;
      switch (d.tipo) {
        case 'FS': r = sLs - d.desfase; break;
        case 'SS': r = sLs - d.desfase + dur; break;
        case 'FF': r = sLf - d.desfase; break;
        case 'SF': r = sLf - d.desfase + dur; break;
      }
      fin = Math.min(fin, r);
    }
    lf.set(id, fin);
    ls.set(id, fin - dur);
  }

  for (const id of orden) {
    const e = es.get(id)!;
    const dur = ef.get(id)! - e;
    const f = ef.get(id)!;
    const h = ls.get(id)! - e;
    porId.set(id, {
      es: e,
      ef: f,
      ls: ls.get(id)!,
      lf: lf.get(id)!,
      holgura: h,
      critica: h <= 0,
      inicio: cal.fecha(e),
      fin: cal.fecha(Math.max(e, f - 1)),
      duracion: dur,
    });
  }

  // Resumen de etapas y actividades padre (de abajo hacia arriba)
  const resumir = (a: Actividad): Programa | undefined => {
    if (porId.has(a.id)) return porId.get(a.id);
    const hs = (hijos.get(a.id) ?? []).map(resumir).filter(Boolean) as Programa[];
    if (!hs.length) return undefined;
    const e = Math.min(...hs.map((p) => p.es));
    const f = Math.max(...hs.map((p) => p.ef));
    const p: Programa = {
      es: e,
      ef: f,
      ls: Math.min(...hs.map((p) => p.ls)),
      lf: Math.max(...hs.map((p) => p.lf)),
      holgura: Math.min(...hs.map((p) => p.holgura)),
      critica: hs.some((p) => p.critica),
      inicio: cal.fecha(e),
      fin: cal.fecha(Math.max(e, f - 1)),
      duracion: f - e,
    };
    porId.set(a.id, p);
    return p;
  };
  for (const a of acts) resumir(a);

  return { porId, hojas, hijos, finProyecto, ciclo: null };
}
