import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Datos, Rol } from '../engine/types';
import { calcular, type Calculo } from '../engine/calculo';
import { crearSemilla } from '../data/semilla';
import {
  borrarLocal, cargarLocal, cargarRemoto, diferencias, guardarLocal, reemplazarRemoto, sincronizarRemoto, supabase,
} from './persistencia';

export type Vista =
  | 'proyectos' | 'gantt' | 'recursos' | 'hitos' | 'kpis' | 'cambios' | 'tablero-proyecto' | 'tablero-cambios' | 'informe' | 'admin';

export interface Impacto {
  titulo: string;
  lineas: { texto: string; tipo: 'bueno' | 'malo' | 'neutro' }[];
  id: number;
}

interface Store {
  datos: Datos;
  calc: Calculo | null;
  proyectoId: string;
  setProyectoId: (id: string) => void;
  rol: Rol;
  setRolLocal: (r: Rol) => void;
  usuario: string;
  modo: 'local' | 'supabase';
  sync: 'ok' | 'guardando' | 'error';
  errorSync: string | null;
  vista: Vista;
  setVista: (v: Vista) => void;
  seleccion: string | null;
  setSeleccion: (id: string | null) => void;
  mutar: (fn: (d: Datos) => Datos, titulo: string) => void;
  previsualizar: (fn: ((d: Datos) => Datos) | null) => void;
  impacto: Impacto | null;
  cerrarImpacto: () => void;
  restablecer: () => Promise<void>;
  esAdmin: boolean;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('Store no disponible');
  return s;
}

const fmtPesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CL');

/** Resume el efecto de un cambio: fechas, costos, alertas y semáforos de KPI. */
function resumirImpacto(datos: Datos, a: Calculo | null, b: Calculo | null, titulo: string): Impacto | null {
  if (!a || !b) return null;
  const lineas: Impacto['lineas'] = [];
  if (a.finProyecto !== b.finProyecto) {
    const dias = b.cal.indiceDesde(b.finProyecto) - a.cal.indiceDesde(a.finProyecto);
    lineas.push({ texto: `Término del proyecto: ${a.finProyecto} → ${b.finProyecto} (${dias > 0 ? '+' : ''}${dias} días hábiles)`, tipo: dias > 0 ? 'malo' : 'bueno' });
  }
  const dc = b.costoPlanTotal - a.costoPlanTotal;
  if (Math.abs(dc) >= 1) lineas.push({ texto: `Costo planificado: ${fmtPesos(a.costoPlanTotal)} → ${fmtPesos(b.costoPlanTotal)} (${dc > 0 ? '+' : ''}${fmtPesos(dc)})`, tipo: dc > 0 ? 'malo' : 'bueno' });
  const dr = b.costoRealTotal - a.costoRealTotal;
  if (Math.abs(dr) >= 1) lineas.push({ texto: `Costo real: ${fmtPesos(a.costoRealTotal)} → ${fmtPesos(b.costoRealTotal)}`, tipo: 'neutro' });
  // actividades que se movieron
  let movidas = 0;
  for (const [id, p] of b.prog.porId) {
    const q = a.prog.porId.get(id);
    if (q && !b.prog.hijos.has(id) && (q.es !== p.es || q.ef !== p.ef)) movidas++;
  }
  if (movidas) lineas.push({ texto: `${movidas} actividad(es) reprogramada(s) por sus dependencias`, tipo: 'neutro' });
  // hitos
  for (const h of datos.hitos) {
    const x = a.hitos.get(h.id);
    const y = b.hitos.get(h.id);
    if (x && y && (x.estado !== y.estado || x.fechaPronosticada !== y.fechaPronosticada)) {
      lineas.push({ texto: `Hito ${h.codigo}: ${y.estado} (pronóstico ${y.fechaPronosticada ?? '—'})`, tipo: y.atrasoDias > x.atrasoDias ? 'malo' : y.atrasoDias < x.atrasoDias ? 'bueno' : 'neutro' });
    }
  }
  // KPI que cambian de semáforo
  for (const k of datos.kpis) {
    const x = a.kpis.get(k.id);
    const y = b.kpis.get(k.id);
    if (x && y && x.semaforo !== y.semaforo) {
      const peso = { verde: 0, amarillo: 1, rojo: 2, gris: 1 };
      lineas.push({ texto: `KPI ${k.codigo} ${k.nombre}: ${x.semaforo} → ${y.semaforo}`, tipo: peso[y.semaforo] > peso[x.semaforo] ? 'malo' : 'bueno' });
    }
  }
  // alertas nuevas
  const antes = new Set(a.alertas.map((x) => x.mensaje));
  const nuevas = b.alertas.filter((x) => !antes.has(x.mensaje) && x.tipo !== 'kpi');
  for (const n of nuevas.slice(0, 4)) lineas.push({ texto: `Nueva alerta: ${n.mensaje}`, tipo: 'malo' });
  const despues = new Set(b.alertas.map((x) => x.mensaje));
  const resueltas = a.alertas.filter((x) => !despues.has(x.mensaje) && x.tipo !== 'kpi');
  for (const n of resueltas.slice(0, 3)) lineas.push({ texto: `Alerta resuelta: ${n.mensaje}`, tipo: 'bueno' });
  if (!lineas.length) return null;
  return { titulo, lineas, id: Date.now() };
}

export function StoreProvider({ children, rolSesion, usuarioSesion }: { children: ReactNode; rolSesion: Rol | null; usuarioSesion: string | null }) {
  const modo: 'local' | 'supabase' = supabase ? 'supabase' : 'local';
  const [datos, setDatos] = useState<Datos>(() => (modo === 'local' ? cargarLocal() ?? crearSemilla() : { proyectos: [], actividades: [], dependencias: [], recursos: [], asignaciones: [], hitos: [], kpis: [], mediciones: [], cambios: [], lineasBase: [] }));
  const [cargado, setCargado] = useState(modo === 'local');
  const [proyectoId, setProyectoId] = useState<string>('');
  const [rolLocal, setRolLocal] = useState<Rol>('admin');
  const [vista, setVista] = useState<Vista>('tablero-proyecto');
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [impacto, setImpacto] = useState<Impacto | null>(null);
  const [sync, setSync] = useState<'ok' | 'guardando' | 'error'>('ok');
  const [errorSync, setErrorSync] = useState<string | null>(null);
  const [preview, setPreview] = useState<((d: Datos) => Datos) | null>(null);
  const ultimaEscritura = useRef(0);
  const datosRef = useRef(datos);
  datosRef.current = datos;

  // carga inicial desde Supabase (si está vacío, se carga el caso de prueba)
  const recargar = useCallback(async () => {
    if (modo !== 'supabase') return;
    try {
      const d = await cargarRemoto();
      setDatos(d);
      setCargado(true);
    } catch (e) {
      setErrorSync((e as Error).message);
      setSync('error');
      setCargado(true);
    }
  }, [modo]);

  useEffect(() => {
    if (modo === 'supabase') void recargar();
  }, [modo, recargar]);

  // tiempo real: si otro usuario modifica datos, se recargan
  useEffect(() => {
    if (!supabase) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const canal = supabase
      .channel('cambios-db')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        if (Date.now() - ultimaEscritura.current < 2500) return; // eco de nuestros propios cambios
        if (t) clearTimeout(t);
        t = setTimeout(() => void recargar(), 500);
      })
      .subscribe();
    return () => {
      void supabase!.removeChannel(canal);
    };
  }, [recargar]);

  useEffect(() => {
    if (!proyectoId && datos.proyectos.length) setProyectoId(datos.proyectos[0].id);
  }, [datos.proyectos, proyectoId]);

  const datosVista = useMemo(() => (preview ? preview(datos) : datos), [datos, preview]);
  const calc = useMemo(() => (proyectoId ? calcular(datosVista, proyectoId) : null), [datosVista, proyectoId]);

  const mutar = useCallback(
    (fn: (d: Datos) => Datos, titulo: string) => {
      const antes = datosRef.current;
      const despues = fn(antes);
      if (despues === antes) return;
      const pid = proyectoId || despues.proyectos[0]?.id;
      const imp = pid ? resumirImpacto(despues, calcular(antes, pid), calcular(despues, pid), titulo) : null;
      setDatos(despues);
      setPreview(null);
      if (imp) setImpacto(imp);
      if (modo === 'local') {
        guardarLocal(despues);
      } else {
        const difs = diferencias(antes, despues);
        ultimaEscritura.current = Date.now();
        setSync('guardando');
        sincronizarRemoto(difs)
          .then(() => {
            ultimaEscritura.current = Date.now();
            setSync('ok');
            setErrorSync(null);
          })
          .catch((e: Error) => {
            setSync('error');
            setErrorSync(e.message);
          });
      }
    },
    [modo, proyectoId],
  );

  const restablecer = useCallback(async () => {
    const semilla = crearSemilla();
    if (modo === 'local') {
      borrarLocal();
      guardarLocal(semilla);
    } else {
      setSync('guardando');
      ultimaEscritura.current = Date.now() + 60000;
      try {
        await reemplazarRemoto(semilla);
        setSync('ok');
      } catch (e) {
        setSync('error');
        setErrorSync((e as Error).message);
      }
      ultimaEscritura.current = Date.now();
    }
    setDatos(semilla);
    setProyectoId(semilla.proyectos[0].id);
    setImpacto(null);
  }, [modo]);

  const rol = modo === 'local' ? rolLocal : rolSesion ?? 'usuario';
  const valor: Store = {
    datos: datosVista,
    calc,
    proyectoId,
    setProyectoId,
    rol,
    setRolLocal,
    usuario: usuarioSesion ?? (rol === 'admin' ? 'Administrador (modo local)' : 'Usuario de proyecto (modo local)'),
    modo,
    sync,
    errorSync,
    vista,
    setVista,
    seleccion,
    setSeleccion,
    mutar,
    previsualizar: (fn) => setPreview(() => fn),
    impacto,
    cerrarImpacto: () => setImpacto(null),
    restablecer,
    esAdmin: rol === 'admin',
  };

  if (!cargado) return <div className="cargando">Cargando datos del proyecto…</div>;
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
