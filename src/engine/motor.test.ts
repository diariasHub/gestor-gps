import { describe, expect, it } from 'vitest';
import { crearSemilla } from '../data/semilla';
import { calcular } from './calculo';
import { Calendario } from './calendario';
import { generaCiclo, programar } from './programacion';
import { evaluarFormula } from './formula';
import { avanzarCambio } from './cambios';
import type { Actividad, Dependencia } from './types';

const act = (id: string, duracion: number): Actividad => ({
  id, proyectoId: 'p', parentId: null, codigo: id, nombre: id, descripcion: '', nivel: 'actividad', responsable: '',
  duracion, inicioMinimo: null, inicioReal: null, finReal: null, avance: 0, costoReal: 0, orden: 0,
});
const dep = (predId: string, sucId: string, tipo: Dependencia['tipo'], desfase = 0): Dependencia => ({ id: predId + sucId, proyectoId: 'p', predId, sucId, tipo, desfase });

describe('Calendario laboral', () => {
  it('salta fines de semana y feriados', () => {
    const cal = new Calendario('2026-03-02', ['2026-03-04']);
    expect(cal.fecha(0)).toBe('2026-03-02');
    expect(cal.fecha(2)).toBe('2026-03-05'); // el miércoles 4 es feriado
    expect(cal.fecha(4)).toBe('2026-03-09'); // salta el fin de semana
  });
});

describe('Dependencias FS, SS, FF y SF con desfases', () => {
  const cal = new Calendario('2026-03-02', []);
  const acts = [act('A', 5), act('B', 3)];
  it('FS: la sucesora comienza al terminar la predecesora', () => {
    const r = programar(acts, [dep('A', 'B', 'FS')], cal);
    expect(r.porId.get('B')!.es).toBe(5);
  });
  it('FS con desfase negativo (adelanto)', () => {
    const r = programar(acts, [dep('A', 'B', 'FS', -2)], cal);
    expect(r.porId.get('B')!.es).toBe(3);
  });
  it('SS con desfase positivo', () => {
    const r = programar(acts, [dep('A', 'B', 'SS', 2)], cal);
    expect(r.porId.get('B')!.es).toBe(2);
  });
  it('FF: la sucesora termina cuando termina la predecesora', () => {
    const r = programar(acts, [dep('A', 'B', 'FF')], cal);
    expect(r.porId.get('B')!.ef).toBe(5);
  });
  it('SF: la sucesora termina después de que inicia la predecesora', () => {
    const r = programar([act('A', 5), act('B', 3)], [dep('A', 'B', 'SF', 4)], cal);
    expect(r.porId.get('B')!.ef).toBe(4);
  });
  it('detecta y rechaza dependencias circulares', () => {
    const deps = [dep('A', 'B', 'FS'), dep('B', 'C', 'FS')];
    expect(generaCiclo(deps, 'C', 'A')).toBe(true);
    expect(generaCiclo(deps, 'A', 'C')).toBe(false);
  });
  it('identifica la ruta crítica y la holgura', () => {
    const r = programar([act('A', 5), act('B', 3), act('C', 10)], [dep('A', 'B', 'FS')], cal);
    expect(r.porId.get('C')!.critica).toBe(true);
    expect(r.porId.get('A')!.holgura).toBe(2);
  });
});

describe('Fórmulas de KPI', () => {
  it('evalúa operaciones y funciones', () => {
    expect(evaluarFormula('a / b * 100', { a: 1, b: 4 })).toBe(25);
    expect(evaluarFormula('max(a, 3) + abs(-2)', { a: 1 })).toBe(5);
    expect(evaluarFormula('a / b', { a: 1, b: 0 })).toBeNull();
  });
});

describe('Caso de prueba Impacto Eventos', () => {
  const datos = crearSemilla();
  const pid = datos.proyectos[0].id;
  const calc = calcular(datos, pid)!;
  it('cumple los mínimos del caso de prueba', () => {
    expect(datos.actividades.filter((a) => a.nivel === 'etapa').length).toBeGreaterThanOrEqual(4);
    expect(datos.actividades.filter((a) => a.nivel === 'actividad').length).toBe(12);
    expect(datos.actividades.filter((a) => a.nivel === 'subactividad').length).toBe(20);
    expect(new Set(datos.dependencias.map((d) => d.tipo)).size).toBe(4);
    expect(datos.recursos.filter((r) => r.tipo === 'profesional').length).toBe(5);
    expect(datos.hitos.length).toBe(6);
    expect(datos.kpis.filter((k) => k.categoria === 'proyecto').length).toBe(8);
    expect(datos.kpis.filter((k) => k.categoria === 'cambio').length).toBe(12);
    expect(datos.cambios.length).toBe(5);
    expect(calc.ciclo).toBeNull();
  });
  it('aprobar un cambio recalcula fechas, costos y KPI', () => {
    const cc5 = datos.cambios.find((c) => c.codigo === 'CC-05')!;
    const d2 = avanzarCambio(datos, cc5.id, 'aprobar', '2026-07-10', 'test', '');
    const c2 = calcular(d2, pid)!;
    expect(c2.finIdx).toBeGreaterThan(calc.finIdx);
    expect(c2.costoPlanTotal).toBeGreaterThan(calc.costoPlanTotal);
    console.log('Fin antes', calc.finProyecto, 'después', c2.finProyecto, 'costo', Math.round(calc.costoPlanTotal), '→', Math.round(c2.costoPlanTotal));
  });
  it('resumen', () => {
    for (const a of datos.actividades) {
      const p = calc.prog.porId.get(a.id)!;
      console.log(a.codigo.padEnd(6), a.nombre.slice(0, 34).padEnd(35), p.inicio, p.fin, 'h', p.holgura, p.critica ? 'CRIT' : '', 'av', Math.round(calc.avance.get(a.id)!), calc.atrasadas.has(a.id) ? 'ATRASO' : '', Math.round(calc.costoPlan.get(a.id)!));
    }
    console.log('Fin', calc.finProyecto, 'Costo plan', Math.round(calc.costoPlanTotal), 'AC', Math.round(calc.ac), 'PV', Math.round(calc.pv), 'EV', Math.round(calc.ev));
    for (const k of datos.kpis) console.log(k.codigo, k.nombre.padEnd(40), calc.kpis.get(k.id)!.valor?.toFixed(2), calc.kpis.get(k.id)!.semaforo, calc.kpis.get(k.id)!.error ?? '');
    for (const h of datos.hitos) console.log(h.codigo, h.fechaComprometida, calc.hitos.get(h.id));
    for (const al of calc.alertas) console.log('ALERTA', al.gravedad, al.mensaje);
  });
});
