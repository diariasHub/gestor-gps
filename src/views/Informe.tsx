import { Printer } from 'lucide-react';
import { useStore } from '../state/store';
import { Chip, Encabezado, Punto, Tarjeta, colorEstadoCambio, colorEstadoHito, fecha, fechaCorta, num, pesos } from '../ui';
import { textoMeta } from './KPIs';

/** Informe ejecutivo para imprimir o guardar como PDF (estructura: resumen, resultados, acciones). */
export function Informe() {
  const { datos, calc, proyectoId } = useStore();
  if (!calc) return null;
  const p = calc.proyecto;
  const kpis = datos.kpis.filter((k) => k.proyectoId === proyectoId);
  const etapas = datos.actividades.filter((a) => a.proyectoId === proyectoId && a.nivel === 'etapa').sort((a, b) => a.orden - b.orden);
  const avance = calc.variables.trabajo_total ? ((calc.variables.trabajo_completado ?? 0) / (calc.variables.trabajo_total ?? 1)) * 100 : 0;
  const rojos = kpis.filter((k) => calc.kpis.get(k.id)?.semaforo === 'rojo');
  return (
    <div>
      <Encabezado titulo="Informe ejecutivo del proyecto" sub="Vista optimizada para imprimir o guardar como PDF (hoja horizontal)">
        <button className="btn prim" onClick={() => window.print()}><Printer size={15} /> Imprimir / PDF</button>
      </Encabezado>
      <div className="grid">
        <Tarjeta titulo={`${p.codigo} · ${p.nombre}`} derecha={<span className="peq muted">Informe al {fecha(p.fechaCorte)}</span>}>
          <div className="grid g4">
            <div><div className="peq muted">Avance</div><b style={{ fontSize: 20 }}>{num(avance, 1)} %</b></div>
            <div><div className="peq muted">Término calculado / comprometido</div><b style={{ fontSize: 16 }}>{fecha(calc.finProyecto)} / {fecha(p.fechaTerminoPlan)}</b></div>
            <div><div className="peq muted">Costo planificado / real</div><b style={{ fontSize: 16 }}>{pesos(calc.costoPlanTotal)} / {pesos(calc.costoRealTotal)}</b></div>
            <div><div className="peq muted">Presupuesto autorizado</div><b style={{ fontSize: 16 }}>{pesos(p.presupuesto)}</b></div>
          </div>
          <p className="peq" style={{ marginBottom: 0 }}>
            <b>Resumen:</b> a la fecha de corte el proyecto registra {num(avance, 1)} % de avance frente a {num(calc.pv && calc.costoPlanTotal ? (calc.pv / calc.costoPlanTotal) * 100 : null, 1)} % planificado (SPI {num(calc.pv ? calc.ev / calc.pv : null, 2)}, CPI {num(calc.ac ? calc.ev / calc.ac : null, 2)}).
            {calc.desvioPlazo !== null && <> El término calculado se desvía {calc.desvioPlazo} días hábiles respecto de la línea base.</>} Hay {calc.alertas.filter((a) => a.gravedad === 'alta').length} alertas altas y {rojos.length} KPI fuera de meta.
          </p>
        </Tarjeta>

        <div className="grid g2">
          <Tarjeta titulo="Avance por etapa" sinPadding>
            <table className="tabla">
              <thead><tr><th>Etapa</th><th>Inicio</th><th>Fin</th><th className="num">Avance</th><th className="num">Costo plan</th><th className="num">Costo real</th></tr></thead>
              <tbody>
                {etapas.map((e) => {
                  const pr = calc.prog.porId.get(e.id);
                  return <tr key={e.id}><td>{e.codigo}. {e.nombre}</td><td>{fechaCorta(pr?.inicio)}</td><td>{fechaCorta(pr?.fin)}</td><td className="num">{num(calc.avance.get(e.id), 0)} %</td><td className="num">{pesos(calc.costoPlan.get(e.id))}</td><td className="num">{pesos(calc.costoReal.get(e.id))}</td></tr>;
                })}
              </tbody>
            </table>
          </Tarjeta>
          <Tarjeta titulo="Hitos" sinPadding>
            <table className="tabla">
              <thead><tr><th>Hito</th><th>Comprometido</th><th>Real / pronóstico</th><th>Estado</th></tr></thead>
              <tbody>
                {datos.hitos.filter((h) => h.proyectoId === proyectoId).map((h) => {
                  const e = calc.hitos.get(h.id)!;
                  return <tr key={h.id}><td>{h.codigo} {h.nombre}</td><td>{fechaCorta(h.fechaComprometida)}</td><td>{fechaCorta(e.fechaRealEfectiva ?? e.fechaPronosticada)}</td><td><Chip color={colorEstadoHito(e.estado)}>{e.estado}</Chip></td></tr>;
                })}
              </tbody>
            </table>
          </Tarjeta>
        </div>

        <Tarjeta titulo="Indicadores (KPI)" sinPadding>
          <table className="tabla">
            <thead><tr><th>Código</th><th>Indicador</th><th className="num">Valor</th><th>Meta</th><th>Estado</th></tr></thead>
            <tbody>
              {kpis.map((k) => {
                const r = calc.kpis.get(k.id)!;
                return <tr key={k.id}><td>{k.codigo}</td><td>{k.nombre}</td><td className="num">{num(r.valor, 2)} {k.unidad}</td><td>{textoMeta(k)}</td><td><span className="fila"><Punto s={r.semaforo} />{r.semaforo}</span></td></tr>;
              })}
            </tbody>
          </table>
        </Tarjeta>

        <div className="grid g2">
          <Tarjeta titulo="Solicitudes de cambio" sinPadding>
            <table className="tabla">
              <thead><tr><th>ID</th><th>Solicitud</th><th>Estado</th><th>Paso</th><th className="num">Costo est.</th></tr></thead>
              <tbody>
                {datos.cambios.filter((c) => c.proyectoId === proyectoId).map((c) => <tr key={c.id}><td>{c.codigo}</td><td>{c.titulo}</td><td><Chip color={colorEstadoCambio(c.estado)}>{c.estado}</Chip></td><td>{c.paso}/10</td><td className="num">{pesos(c.costoEstimado)}</td></tr>)}
              </tbody>
            </table>
          </Tarjeta>
          <Tarjeta titulo="Alertas y acciones recomendadas">
            <div className="lista-alertas" style={{ maxHeight: 'none' }}>
              {calc.alertas.filter((a) => a.gravedad === 'alta').map((a, i) => <div key={i} className="alerta alta">{a.mensaje}</div>)}
            </div>
            <p className="peq" style={{ marginBottom: 0 }}><b>Acciones:</b> nivelar los recursos sobreasignados, recuperar las actividades críticas atrasadas (agregar recursos o solapar actividades) y cerrar los cambios atrasados antes de nuevas aprobaciones.</p>
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}
