import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Flag, Plus, Printer, Save } from 'lucide-react';
import { useStore } from '../state/store';
import type { Actividad, Datos } from '../engine/types';
import { addDiasCalendario, diasCalendario, parseISO } from '../engine/calendario';
import { crearLineaBase } from '../engine/calculo';
import { nuevoId } from '../engine/cambios';
import { Chip, Encabezado, Modal, Campo, fechaCorta, num, pesos } from '../ui';
import { PanelActividad } from './PanelActividad';

const ESCALAS = { Día: 24, Semana: 8, Mes: 3 } as const;
type Escala = keyof typeof ESCALAS;
const ALTO = 30;
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface FilaG {
  tipo: 'act' | 'hito' | 'grupo';
  id: string;
  act?: Actividad;
  nivel: number;
}

export function Gantt() {
  const { datos, calc, proyectoId, seleccion, setSeleccion, mutar, previsualizar, esAdmin } = useStore();
  const [escala, setEscala] = useState<Escala>('Semana');
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const [verBase, setVerBase] = useState(true);
  const [verDeps, setVerDeps] = useState(true);
  const [verReal, setVerReal] = useState(true);
  const [nueva, setNueva] = useState(false);
  const [arrastre, setArrastre] = useState<{ id: string; modo: 'mover' | 'duracion'; x0: number; dias: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const filas = useMemo<FilaG[]>(() => {
    if (!calc) return [];
    const acts = datos.actividades.filter((a) => a.proyectoId === proyectoId);
    const hijos = new Map<string | null, Actividad[]>();
    for (const a of acts) {
      const k = a.parentId;
      if (!hijos.has(k)) hijos.set(k, []);
      hijos.get(k)!.push(a);
    }
    for (const l of hijos.values()) l.sort((x, y) => x.orden - y.orden);
    const out: FilaG[] = [];
    const rec = (padre: string | null, nivel: number) => {
      for (const a of hijos.get(padre) ?? []) {
        out.push({ tipo: 'act', id: a.id, act: a, nivel });
        if (!colapsados.has(a.id)) rec(a.id, nivel + 1);
      }
    };
    rec(null, 0);
    const hitos = datos.hitos.filter((h) => h.proyectoId === proyectoId);
    if (hitos.length) {
      out.push({ tipo: 'grupo', id: 'grupo-hitos', nivel: 0 });
      if (!colapsados.has('grupo-hitos')) for (const h of hitos) out.push({ tipo: 'hito', id: h.id, nivel: 1 });
    }
    return out;
  }, [datos, proyectoId, colapsados, calc]);

  if (!calc) return null;
  const p = calc.proyecto;
  const px = ESCALAS[escala];
  const inicioVista = addDiasCalendario(p.fechaInicio, -4);
  const finCandidatos = [calc.finProyecto, p.fechaTerminoPlan, calc.lineaBase?.fin ?? p.fechaInicio, ...datos.hitos.filter((h) => h.proyectoId === proyectoId).map((h) => h.fechaComprometida)];
  const finVista = addDiasCalendario(finCandidatos.sort().slice(-1)[0], 12);
  const totalDias = diasCalendario(inicioVista, finVista) + 1;
  const ancho = totalDias * px;
  const X = (iso: string) => diasCalendario(inicioVista, iso) * px;
  const alto = filas.length * ALTO;
  const filaIdx = new Map(filas.map((f, i) => [f.id, i]));
  const yFila = (i: number) => i * ALTO;

  // ----- arrastre de barras (mover inicio o cambiar duración) con previsualización en vivo
  const aplicarArrastre = (id: string, modo: 'mover' | 'duracion', dias: number) => (d: Datos): Datos => {
    const a = d.actividades.find((x) => x.id === id)!;
    const prog = calc.prog.porId.get(id)!;
    if (modo === 'mover') {
      const destino = addDiasCalendario(prog.inicio, dias);
      const idx = calc.cal.indiceDesde(destino);
      return { ...d, actividades: d.actividades.map((x) => (x.id === id ? { ...x, inicioMinimo: calc.cal.fecha(idx) } : x)) };
    }
    const finNuevo = addDiasCalendario(prog.fin, dias);
    const dur = Math.max(1, calc.cal.indiceHasta(finNuevo) - prog.es + 1);
    return { ...d, actividades: d.actividades.map((x) => (x.id === id ? { ...x, duracion: dur } : x)) };
    void a;
  };

  const onPointerDown = (e: React.PointerEvent, id: string, modo: 'mover' | 'duracion') => {
    if (!esAdmin) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setArrastre({ id, modo, x0: e.clientX, dias: 0 });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!arrastre) return;
    const dias = Math.round((e.clientX - arrastre.x0) / px);
    if (dias !== arrastre.dias) {
      setArrastre({ ...arrastre, dias });
      previsualizar(dias === 0 ? null : aplicarArrastre(arrastre.id, arrastre.modo, dias));
    }
  };
  const onPointerUp = () => {
    if (!arrastre) return;
    const { id, modo, dias } = arrastre;
    setArrastre(null);
    previsualizar(null);
    if (dias === 0) setSeleccion(id); // clic sin arrastre: abrir el panel
    if (dias !== 0) {
      const act = datos.actividades.find((a) => a.id === id)!;
      mutar(aplicarArrastre(id, modo, dias), modo === 'mover' ? `Se movió "${act.codigo} ${act.nombre}"` : `Cambió la duración de "${act.codigo} ${act.nombre}"`);
    }
  };

  // ----- escala de tiempo
  const marcas: { x: number; texto: string; mayor: boolean }[] = [];
  const meses: { x: number; w: number; texto: string }[] = [];
  {
    let d = inicioVista;
    let mesActual = '';
    let xMes = 0;
    for (let i = 0; i < totalDias; i++) {
      const t = parseISO(d);
      const dt = new Date(t);
      const mes = `${MESES[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
      if (mes !== mesActual) {
        if (mesActual) meses.push({ x: xMes, w: i * px - xMes, texto: mesActual });
        mesActual = mes;
        xMes = i * px;
      }
      const dia = dt.getUTCDay();
      if (escala === 'Día') marcas.push({ x: i * px, texto: String(dt.getUTCDate()), mayor: dia === 1 });
      else if (escala === 'Semana' && dia === 1) marcas.push({ x: i * px, texto: String(dt.getUTCDate()), mayor: true });
      d = addDiasCalendario(d, 1);
    }
    meses.push({ x: xMes, w: totalDias * px - xMes, texto: mesActual });
  }

  // fines de semana y feriados sombreados
  const sombras: { x: number; w: number; feriado: boolean }[] = [];
  if (escala !== 'Mes') {
    let d = inicioVista;
    for (let i = 0; i < totalDias; i++) {
      const t = parseISO(d);
      const dia = new Date(t).getUTCDay();
      const feriado = calc.cal.esFeriado(d);
      if (dia === 0 || dia === 6 || feriado) sombras.push({ x: i * px, w: px, feriado });
      d = addDiasCalendario(d, 1);
    }
  }

  const nombreTabla = (f: FilaG) => {
    if (f.tipo === 'grupo') return 'Hitos';
    if (f.tipo === 'hito') {
      const h = datos.hitos.find((x) => x.id === f.id)!;
      return `${h.codigo} ${h.nombre}`;
    }
    return f.act!.nombre;
  };

  const pg = (id: string) => calc.prog.porId.get(id);

  const flechas = verDeps
    ? datos.dependencias
        .filter((d) => d.proyectoId === proyectoId && filaIdx.has(d.predId) && filaIdx.has(d.sucId))
        .map((d) => {
          const a = pg(d.predId);
          const b = pg(d.sucId);
          if (!a || !b) return null;
          const ia = filaIdx.get(d.predId)!;
          const ib = filaIdx.get(d.sucId)!;
          const finA = X(addDiasCalendario(a.fin, 1));
          const iniA = X(a.inicio);
          const iniB = X(b.inicio);
          const finB = X(addDiasCalendario(b.fin, 1));
          const desdeX = d.tipo === 'FS' || d.tipo === 'FF' ? finA : iniA;
          const hastaFin = d.tipo === 'FF' || d.tipo === 'SF';
          const hastaX = hastaFin ? finB : iniB;
          const y1 = yFila(ia) + ALTO / 2;
          const y2 = yFila(ib) + ALTO / 2;
          const critica = a.critica && b.critica;
          const sale = desdeX + (d.tipo === 'FS' || d.tipo === 'FF' ? 6 : -6);
          const llega = hastaFin ? hastaX + 8 : hastaX - 8;
          const yMedio = y2 - (y2 > y1 ? ALTO / 2 - 3 : -(ALTO / 2 - 3));
          const path = `M${desdeX},${y1} H${sale} V${yMedio} H${llega} V${y2} H${hastaX + (hastaFin ? 2 : -2)}`;
          return { id: d.id, path, critica, hastaFin, hastaX, y2, tipo: d.tipo, desfase: d.desfase };
        })
        .filter(Boolean)
    : [];

  const establecerLineaBase = () => {
    if (!confirm('¿Establecer el plan actual como nueva línea base? La línea base anterior se conserva en el historial.')) return;
    mutar((d) => ({ ...d, lineasBase: [...d.lineasBase, crearLineaBase(calc, 'Re-planificación aprobada', p.fechaCorte, nuevoId())] }), 'Nueva línea base establecida');
  };

  return (
    <div style={{ paddingRight: seleccion ? 440 : 0, transition: 'padding-right .2s' }}>
      <Encabezado
        titulo="Planificación y carta Gantt"
        sub={<>Término calculado <b>{fechaCorta(calc.finProyecto)}</b> · comprometido {fechaCorta(p.fechaTerminoPlan)} · corte {fechaCorta(p.fechaCorte)} {calc.desvioPlazo !== null && <> · vs línea base <b style={{ color: calc.desvioPlazo > 0 ? 'var(--crit)' : 'var(--ok)' }}>{calc.desvioPlazo > 0 ? '+' : ''}{calc.desvioPlazo} días hábiles</b></>}</>}
      >
        <div className="fila no-imprimir">
          {(Object.keys(ESCALAS) as Escala[]).map((e) => (
            <button key={e} className={`btn chico ${escala === e ? 'prim' : ''}`} onClick={() => setEscala(e)}>{e}</button>
          ))}
        </div>
        {esAdmin && <button className="btn" onClick={() => setNueva(true)}><Plus size={15} /> Actividad</button>}
        {esAdmin && <button className="btn" onClick={establecerLineaBase}><Save size={15} /> Línea base</button>}
        <button className="btn" onClick={() => window.print()}><Printer size={15} /> Imprimir</button>
      </Encabezado>

      <div className="tarjeta">
        <div className="cuerpo fila wrap no-imprimir" style={{ paddingBottom: 10 }}>
          <div className="leyenda">
            <span><i style={{ background: 'var(--plan)' }} />Planificado</span>
            <span><i style={{ background: 'var(--crit)' }} />Ruta crítica</span>
            <span><i style={{ background: 'rgba(0,0,0,.35)' }} />Avance</span>
            <span><i style={{ background: 'var(--base)' }} />Línea base</span>
            <span><i style={{ background: 'var(--ok)', height: 3 }} />Real</span>
            <span>◆ Hito pronosticado · ◇ comprometido</span>
            <span><AlertTriangle size={12} color="var(--crit)" /> Atrasada</span>
          </div>
          <div className="fila" style={{ marginLeft: 'auto', fontSize: 12.5 }}>
            <label className="fila"><input type="checkbox" checked={verBase} onChange={(e) => setVerBase(e.target.checked)} /> Línea base</label>
            <label className="fila"><input type="checkbox" checked={verReal} onChange={(e) => setVerReal(e.target.checked)} /> Real</label>
            <label className="fila"><input type="checkbox" checked={verDeps} onChange={(e) => setVerDeps(e.target.checked)} /> Dependencias</label>
          </div>
        </div>
        {calc.ciclo && <div className="alerta alta" style={{ margin: '0 16px 10px' }}>Hay una dependencia circular; no se puede calcular el cronograma.</div>}
        {esAdmin && <div className="peq muted no-imprimir" style={{ padding: '0 16px 8px' }}>Arrastre una barra para mover su inicio, o su borde derecho para cambiar la duración. Haga clic en una fila para editarla.</div>}
        <div className="gantt-wrap">
          <div className="gantt-izq">
            <div className="g-cab"><span>Código</span><span>Nombre</span><span className="num">Días</span><span className="num">Avance</span><span className="num">Holg.</span></div>
            {filas.map((f) => {
              const a = f.act;
              const tieneHijos = a ? calc.prog.hijos.has(a.id) : f.tipo === 'grupo';
              const prog = a ? pg(a.id) : undefined;
              const est = f.tipo === 'hito' ? calc.hitos.get(f.id) : undefined;
              return (
                <div
                  key={f.id}
                  className={`g-fila ${a?.nivel ?? (f.tipo === 'grupo' ? 'etapa' : '')} ${seleccion === f.id ? 'sel' : ''}`}
                  onClick={() => f.tipo === 'act' && setSeleccion(f.id)}
                >
                  <span className="muted">{a?.codigo ?? (f.tipo === 'hito' ? '◆' : '')}</span>
                  <span className="nom" style={{ paddingLeft: f.nivel * 12 }}>
                    {tieneHijos ? (
                      <button className="icono-btn" style={{ padding: 0 }} onClick={(e) => { e.stopPropagation(); const s = new Set(colapsados); if (s.has(f.id)) s.delete(f.id); else s.add(f.id); setColapsados(s); }}>
                        {colapsados.has(f.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      </button>
                    ) : <span style={{ width: 14 }} />}
                    {a && calc.atrasadas.has(a.id) && !tieneHijos && <AlertTriangle size={12} color="var(--crit)" />}
                    {f.tipo === 'hito' && <Flag size={12} color="var(--brand)" />}
                    <span title={nombreTabla(f)}>{nombreTabla(f)}</span>
                  </span>
                  <span className="num">{prog ? prog.duracion : f.tipo === 'hito' ? 0 : ''}</span>
                  <span className="num">{a ? `${Math.round(calc.avance.get(a.id) ?? 0)}%` : est ? `${Math.round(est.avance)}%` : ''}</span>
                  <span className="num" style={{ color: prog?.critica ? 'var(--crit)' : undefined }}>{prog && !tieneHijos ? prog.holgura : ''}</span>
                </div>
              );
            })}
          </div>
          <div className="gantt-der" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
            <div className="g-tiempo">
              <svg width={ancho} height={46} style={{ display: 'block' }}>
              {/* encabezado */}
              <g>
                <rect x={0} y={0} width={ancho} height={46} fill="#fafbfe" />
                {meses.map((m, i) => (
                  <g key={i}>
                    <line x1={m.x} x2={m.x} y1={0} y2={46} stroke="#dfe2ec" />
                    <text x={m.x + 6} y={17} fontSize={11.5} fontWeight={600} fill="#4a5070">{m.w > 40 ? m.texto : ''}</text>
                  </g>
                ))}
                {marcas.map((m, i) => (
                  <text key={i} x={m.x + 2} y={38} fontSize={10} fill={m.mayor ? '#4a5070' : '#9aa1b5'}>{m.texto}</text>
                ))}
                <line x1={0} x2={ancho} y1={46} y2={46} stroke="#e2e5ef" />
              </g>
              </svg>
            </div>
            <svg ref={svgRef} width={ancho} height={alto} style={{ display: 'block', userSelect: 'none' }}>
              <defs>
                <marker id="flecha" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="#8a91a8" /></marker>
                <marker id="flecha-c" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="#e5484d" /></marker>
              </defs>
              {meses.map((m, i) => <line key={i} x1={m.x} x2={m.x} y1={0} y2={alto} stroke="#dfe2ec" />)}
              <g>
                {sombras.map((s, i) => <rect key={i} x={s.x} y={0} width={s.w} height={alto} fill={s.feriado ? '#fde8e8' : '#f5f6fa'} />)}
                {filas.map((f, i) => (
                  <rect key={f.id} x={0} y={yFila(i)} width={ancho} height={ALTO} fill={seleccion === f.id ? 'rgba(122,92,245,.08)' : 'transparent'} stroke="#f0f1f6" />
                ))}
                {/* fecha comprometida y fecha de corte */}
                <line x1={X(p.fechaTerminoPlan) + px} x2={X(p.fechaTerminoPlan) + px} y1={0} y2={alto} stroke="#e5484d" strokeDasharray="2 3" />
                <line x1={X(p.fechaCorte) + px} x2={X(p.fechaCorte) + px} y1={0} y2={alto} stroke="#7a5cf5" strokeWidth={1.5} strokeDasharray="5 3" />
                <text x={X(p.fechaCorte) + px + 4} y={12} fontSize={10.5} fill="#7a5cf5" fontWeight={700}>Corte {fechaCorta(p.fechaCorte)}</text>
                {/* flechas de dependencias */}
                {flechas.map((f) => f && (
                  <path key={f.id} d={f.path} fill="none" stroke={f.critica ? '#e5484d' : '#a3a9bd'} strokeWidth={f.critica ? 1.4 : 1} markerEnd={`url(#${f.critica ? 'flecha-c' : 'flecha'})`} opacity={0.9}>
                    <title>{f.tipo}{f.desfase ? ` ${f.desfase > 0 ? '+' : ''}${f.desfase}d` : ''}</title>
                  </path>
                ))}
                {/* barras */}
                {filas.map((f, i) => {
                  const y = yFila(i);
                  if (f.tipo === 'grupo') return null;
                  if (f.tipo === 'hito') {
                    const h = datos.hitos.find((x) => x.id === f.id)!;
                    const e = calc.hitos.get(h.id)!;
                    const col = e.estado === 'Cumplido en plazo' ? '#23946a' : e.estado === 'Vencido' ? '#e5484d' : e.estado === 'Pendiente' ? '#7a5cf5' : '#d98a1c';
                    const xc = X(h.fechaComprometida) + px / 2;
                    const xp = X(e.fechaRealEfectiva ?? e.fechaPronosticada ?? h.fechaComprometida) + px / 2;
                    return (
                      <g key={f.id}>
                        <path d={`M${xc},${y + 7} l8,8 l-8,8 l-8,-8 z`} fill="#fff" stroke={col} strokeWidth={1.5}><title>Comprometido {h.fechaComprometida}</title></path>
                        <path d={`M${xp},${y + 6} l9,9 l-9,9 l-9,-9 z`} fill={col}><title>{h.nombre}: {e.estado}</title></path>
                        <text x={Math.max(xp, xc) + 12} y={y + 19} fontSize={10.5} fill="#4a5070">{e.estado}{e.atrasoDias > 0 && !e.completado ? ` (+${e.atrasoDias}d)` : ''}</text>
                      </g>
                    );
                  }
                  const a = f.act!;
                  const prog = pg(a.id);
                  if (!prog) return null;
                  const x1 = X(prog.inicio);
                  const x2 = X(addDiasCalendario(prog.fin, 1));
                  const w = Math.max(3, x2 - x1);
                  const resumen = calc.prog.hijos.has(a.id);
                  const av = calc.avance.get(a.id) ?? 0;
                  const lb = calc.lineaBase?.actividades[a.id];
                  if (resumen) {
                    return (
                      <g key={a.id} onClick={() => setSeleccion(a.id)} style={{ cursor: 'pointer' }}>
                        <rect x={x1} y={y + 10} width={w} height={7} fill={prog.critica ? '#3b2a6b' : '#3d4361'} rx={1} />
                        <rect x={x1} y={y + 10} width={(w * av) / 100} height={7} fill="#9b87f5" rx={1} />
                        <path d={`M${x1},${y + 17} l0,6 l6,-6 z M${x1 + w},${y + 17} l0,6 l-6,-6 z`} fill="#3d4361" />
                      </g>
                    );
                  }
                  const atrasada = calc.atrasadas.has(a.id);
                  const color = prog.critica ? '#e5484d' : '#5b7cfa';
                  const realFin = a.finReal ?? (a.inicioReal && a.avance > 0 ? p.fechaCorte : null);
                  return (
                    <g key={a.id}>
                      {verBase && lb && (
                        <rect x={X(lb.inicio)} y={y + 22} width={Math.max(2, X(addDiasCalendario(lb.fin, 1)) - X(lb.inicio))} height={4} fill="#c9cede" rx={2}><title>Línea base {lb.inicio} → {lb.fin}</title></rect>
                      )}
                      <g onPointerDown={(e) => onPointerDown(e, a.id, 'mover')} onClick={esAdmin ? undefined : () => setSeleccion(a.id)} style={{ cursor: esAdmin ? 'grab' : 'pointer' }}>
                        <rect x={x1} y={y + 7} width={w} height={14} rx={4} fill={color} opacity={0.88} stroke={atrasada ? '#9b1c1c' : 'none'} strokeWidth={atrasada ? 2 : 0} />
                        <rect x={x1} y={y + 7} width={(w * av) / 100} height={14} rx={4} fill="rgba(0,0,0,.32)" />
                        <title>{`${a.codigo} ${a.nombre}\n${prog.inicio} → ${prog.fin} (${prog.duracion} días hábiles)\nAvance ${Math.round(av)} % · holgura ${prog.holgura}\nCosto ${pesos(calc.costoPlan.get(a.id))}`}</title>
                      </g>
                      {esAdmin && <rect x={x1 + w - 5} y={y + 7} width={8} height={14} fill="transparent" style={{ cursor: 'ew-resize' }} onPointerDown={(e) => onPointerDown(e, a.id, 'duracion')} />}
                      {verReal && a.inicioReal && realFin && (
                        <rect x={X(a.inicioReal)} y={y + 3} width={Math.max(2, X(addDiasCalendario(realFin, 1)) - X(a.inicioReal))} height={3} fill="#23946a" rx={1.5}><title>Real {a.inicioReal} → {a.finReal ?? 'en curso'}</title></rect>
                      )}
                      {escala !== 'Mes' && w > 30 && <text x={x1 + w + 5} y={y + 18} fontSize={10.5} fill="#687089">{Math.round(av)}%</text>}
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </div>
        <div className="cuerpo fila wrap peq muted" style={{ borderTop: '1px solid var(--line2)' }}>
          <span>Costo planificado <b>{pesos(calc.costoPlanTotal)}</b></span>
          <span>· Costo real <b>{pesos(calc.costoRealTotal)}</b></span>
          <span>· Presupuesto {pesos(p.presupuesto)}</span>
          <span>· Avance del proyecto <b>{num(calc.variables.trabajo_total ? ((calc.variables.trabajo_completado ?? 0) / (calc.variables.trabajo_total ?? 1)) * 100 : 0, 1)} %</b></span>
          <span>· Actividades críticas <b>{calc.prog.hojas.filter((h) => pg(h.id)?.critica).length}</b></span>
          {arrastre && <Chip color="morado">Moviendo: {arrastre.dias > 0 ? '+' : ''}{arrastre.dias} días</Chip>}
        </div>
      </div>

      {seleccion && datos.actividades.some((a) => a.id === seleccion) && <PanelActividad id={seleccion} onCerrar={() => setSeleccion(null)} />}
      {nueva && <NuevaActividad onCerrar={() => setNueva(false)} />}
    </div>
  );
}

function NuevaActividad({ onCerrar }: { onCerrar: () => void }) {
  const { datos, proyectoId, mutar, setSeleccion } = useStore();
  const acts = datos.actividades.filter((a) => a.proyectoId === proyectoId);
  const padres = acts.filter((a) => a.nivel !== 'subactividad').sort((a, b) => a.orden - b.orden);
  const [padreId, setPadreId] = useState<string>('');
  const [nombre, setNombre] = useState('');
  const [duracion, setDuracion] = useState(5);
  const [responsable, setResponsable] = useState('');
  const padre = acts.find((a) => a.id === padreId) ?? null;
  const hermanos = acts.filter((a) => a.parentId === (padre?.id ?? null));
  const codigo = padre ? `${padre.codigo}.${hermanos.length + 1}` : String(hermanos.length + 1);
  const nivel: Actividad['nivel'] = !padre ? 'etapa' : padre.nivel === 'etapa' ? 'actividad' : 'subactividad';
  const guardar = () => {
    if (!nombre.trim()) return;
    const ordenBase = padre ? Math.max(padre.orden, ...acts.filter((a) => a.codigo.startsWith(padre.codigo + '.')).map((a) => a.orden)) + 0.5 : Math.max(0, ...acts.map((a) => a.orden)) + 1;
    const nueva: Actividad = {
      id: nuevoId(), proyectoId, parentId: padre?.id ?? null, codigo, nombre: nombre.trim(), descripcion: '', nivel, responsable,
      duracion: nivel === 'etapa' ? 0 : duracion, inicioMinimo: null, inicioReal: null, finReal: null, avance: 0, costoReal: 0, orden: ordenBase,
    };
    mutar((d) => {
      // si el padre era una actividad sin hijos, su duración pasa a calcularse desde sus hijos
      const actividades = [...d.actividades, nueva].sort((a, b) => a.orden - b.orden).map((a, i) => ({ ...a, orden: i }));
      return { ...d, actividades };
    }, `Nueva ${nivel} ${codigo} ${nueva.nombre}`);
    setSeleccion(nueva.id);
    onCerrar();
  };
  return (
    <Modal titulo="Nueva etapa, actividad o subactividad" onCerrar={onCerrar} pie={<><button className="btn" onClick={onCerrar}>Cancelar</button><button className="btn prim" onClick={guardar} disabled={!nombre.trim()}>Agregar</button></>}>
      <div className="form f2">
        <Campo label="Pertenece a" ayuda="Sin selección se crea una etapa nueva" className="ancho">
          <select value={padreId} onChange={(e) => setPadreId(e.target.value)}>
            <option value="">— Nueva etapa —</option>
            {padres.map((a) => <option key={a.id} value={a.id}>{a.codigo} {a.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Código (automático)"><input value={codigo} readOnly /></Campo>
        <Campo label="Nivel"><input value={nivel} readOnly /></Campo>
        <Campo label="Nombre" className="ancho"><input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus /></Campo>
        {nivel !== 'etapa' && <Campo label="Duración (días hábiles)"><input type="number" min={0} value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} /></Campo>}
        <Campo label="Responsable"><input value={responsable} onChange={(e) => setResponsable(e.target.value)} /></Campo>
      </div>
    </Modal>
  );
}
