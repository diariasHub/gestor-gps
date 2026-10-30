// Persistencia: Supabase (PostgreSQL) cuando está configurado; si no, almacenamiento local del navegador.
// La aplicación trabaja en memoria y sincroniza solo las filas que cambian en cada operación.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Datos } from '../engine/types';

export type Coleccion = keyof Datos;

export const TABLAS: Record<Coleccion, string> = {
  proyectos: 'proyectos',
  actividades: 'actividades',
  dependencias: 'dependencias',
  recursos: 'recursos',
  asignaciones: 'asignaciones',
  hitos: 'hitos',
  kpis: 'kpis',
  mediciones: 'mediciones',
  cambios: 'cambios',
  lineasBase: 'lineas_base',
};

// Orden de inserción respetando llaves foráneas (y el inverso para eliminar)
export const ORDEN: Coleccion[] = ['proyectos', 'actividades', 'dependencias', 'recursos', 'asignaciones', 'hitos', 'kpis', 'mediciones', 'cambios', 'lineasBase'];

const URL = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = URL && KEY ? createClient(URL, KEY) : null;

const snake = (k: string) => k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
const camel = (k: string) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export function aFila(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[snake(k)] = v;
  return out;
}

export function deFila<T>(fila: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fila)) {
    if (k === 'created_at' || k === 'updated_at') continue;
    out[camel(k)] = typeof v === 'string' && /^\d+(\.\d+)?$/.test(v) && ['valor', 'presupuesto', 'costo_real', 'costo_estimado', 'costo_total', 'meta', 'meta_max', 'tolerancia', 'valor_manual'].includes(k) ? Number(v) : v;
  }
  return out as T;
}

export interface Diferencia {
  coleccion: Coleccion;
  upserts: Record<string, unknown>[];
  eliminados: string[];
}

export function diferencias(antes: Datos, despues: Datos): Diferencia[] {
  const out: Diferencia[] = [];
  for (const c of ORDEN) {
    const a = antes[c] as unknown as { id: string }[];
    const b = despues[c] as unknown as { id: string }[];
    if (a === b) continue;
    const mapaA = new Map(a.map((x) => [x.id, x]));
    const idsB = new Set(b.map((x) => x.id));
    const upserts = b.filter((x) => mapaA.get(x.id) !== x) as unknown as Record<string, unknown>[];
    const eliminados = a.filter((x) => !idsB.has(x.id)).map((x) => x.id);
    if (upserts.length || eliminados.length) out.push({ coleccion: c, upserts, eliminados });
  }
  return out;
}

const CLAVE_LOCAL = 'gestor-gps-datos-v1';

export function cargarLocal(): Datos | null {
  try {
    const t = localStorage.getItem(CLAVE_LOCAL);
    return t ? (JSON.parse(t) as Datos) : null;
  } catch {
    return null;
  }
}

export function guardarLocal(d: Datos) {
  try {
    localStorage.setItem(CLAVE_LOCAL, JSON.stringify(d));
  } catch {
    /* sin almacenamiento disponible */
  }
}

export function borrarLocal() {
  try {
    localStorage.removeItem(CLAVE_LOCAL);
  } catch {
    /* nada */
  }
}

export async function cargarRemoto(): Promise<Datos> {
  if (!supabase) throw new Error('Supabase no configurado');
  const datos = {} as Datos;
  for (const c of ORDEN) {
    const { data, error } = await supabase.from(TABLAS[c]).select('*');
    if (error) throw error;
    (datos as unknown as Record<string, unknown[]>)[c] = (data ?? []).map((f) => deFila(f));
  }
  return datos;
}

export async function sincronizarRemoto(difs: Diferencia[]): Promise<void> {
  if (!supabase) return;
  // eliminar en orden inverso (hijos primero)
  for (const d of [...difs].reverse()) {
    if (d.eliminados.length) {
      const { error } = await supabase.from(TABLAS[d.coleccion]).delete().in('id', d.eliminados);
      if (error) throw error;
    }
  }
  for (const d of difs) {
    if (d.upserts.length) {
      const { error } = await supabase.from(TABLAS[d.coleccion]).upsert(d.upserts.map(aFila));
      if (error) throw error;
    }
  }
}

export async function reemplazarRemoto(d: Datos): Promise<void> {
  if (!supabase) return;
  // borra todo y vuelve a cargar el caso (solo administrador)
  for (const c of [...ORDEN].reverse()) {
    const { error } = await supabase.from(TABLAS[c]).delete().not('id', 'is', null);
    if (error) throw error;
  }
  for (const c of ORDEN) {
    const filas = (d[c] as unknown as Record<string, unknown>[]).map(aFila);
    for (let i = 0; i < filas.length; i += 200) {
      const { error } = await supabase.from(TABLAS[c]).insert(filas.slice(i, i + 200));
      if (error) throw error;
    }
  }
}
