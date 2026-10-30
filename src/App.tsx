import { useEffect, useState, type ReactNode } from 'react';
import {
  BarChart3, CalendarRange, ClipboardList, FileText, Flag, FolderKanban, Gauge, GitPullRequestArrow, LogOut, Printer, Settings, Users, X,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { StoreProvider, useStore, type Vista } from './state/store';
import { supabase } from './state/persistencia';
import type { Rol } from './engine/types';
import { Chip, fecha } from './ui';
import { Gantt } from './views/Gantt';
import { Recursos } from './views/Recursos';
import { Hitos } from './views/Hitos';
import { KPIs } from './views/KPIs';
import { Cambios } from './views/Cambios';
import { TableroCambios, TableroProyecto } from './views/Tableros';
import { Proyectos } from './views/Proyectos';
import { Informe } from './views/Informe';
import { Admin } from './views/Admin';

const NAV: { grupo: string; items: { v: Vista; t: string; i: ReactNode }[] }[] = [
  { grupo: 'Tableros', items: [
    { v: 'tablero-proyecto', t: 'Seguimiento del proyecto', i: <Gauge size={17} /> },
    { v: 'tablero-cambios', t: 'Gestión del cambio', i: <BarChart3 size={17} /> },
  ] },
  { grupo: 'Planificación', items: [
    { v: 'proyectos', t: 'Proyectos', i: <FolderKanban size={17} /> },
    { v: 'gantt', t: 'Carta Gantt', i: <CalendarRange size={17} /> },
    { v: 'recursos', t: 'Recursos y costos', i: <Users size={17} /> },
    { v: 'hitos', t: 'Hitos', i: <Flag size={17} /> },
  ] },
  { grupo: 'Control', items: [
    { v: 'kpis', t: 'KPI', i: <ClipboardList size={17} /> },
    { v: 'cambios', t: 'Solicitudes de cambio', i: <GitPullRequestArrow size={17} /> },
    { v: 'informe', t: 'Informe imprimible', i: <FileText size={17} /> },
  ] },
];

function Contenido() {
  const { vista } = useStore();
  switch (vista) {
    case 'proyectos': return <Proyectos />;
    case 'gantt': return <Gantt />;
    case 'recursos': return <Recursos />;
    case 'hitos': return <Hitos />;
    case 'kpis': return <KPIs />;
    case 'cambios': return <Cambios />;
    case 'tablero-proyecto': return <TableroProyecto />;
    case 'tablero-cambios': return <TableroCambios />;
    case 'informe': return <Informe />;
    case 'admin': return <Admin />;
  }
}

function PanelImpacto() {
  const { impacto, cerrarImpacto } = useStore();
  useEffect(() => {
    if (!impacto) return;
    const t = setTimeout(cerrarImpacto, 8000);
    return () => clearTimeout(t);
  }, [impacto, cerrarImpacto]);
  if (!impacto) return null;
  return (
    <div className="impacto" key={impacto.id}>
      <div className="cab"><b>Impacto: {impacto.titulo}</b><button className="icono-btn" style={{ marginLeft: 'auto', color: '#fff' }} onClick={cerrarImpacto}><X size={16} /></button></div>
      <ul>{impacto.lineas.map((l, i) => <li key={i} className={l.tipo}><span className="punto" />{l.texto}</li>)}</ul>
    </div>
  );
}

function Estructura({ onSalir }: { onSalir?: () => void }) {
  const { vista, setVista, datos, proyectoId, setProyectoId, rol, setRolLocal, modo, sync, errorSync, usuario, esAdmin, calc } = useStore();
  const p = datos.proyectos.find((x) => x.id === proyectoId);
  return (
    <div className="app">
      <aside className="lateral no-imprimir">
        <div className="marca">
          <div className="logo"><CalendarRange size={19} /></div>
          <div><b>GestorGPS</b><span>Planificación, seguimiento y cambio</span></div>
        </div>
        {NAV.map((g) => (
          <div key={g.grupo}>
            <div className="nav-grupo">{g.grupo}</div>
            {g.items.map((it) => (
              <button key={it.v} className={`nav-item ${vista === it.v ? 'activo' : ''}`} onClick={() => setVista(it.v)}>{it.i}{it.t}</button>
            ))}
          </div>
        ))}
        {esAdmin && <><div className="nav-grupo">Sistema</div><button className={`nav-item ${vista === 'admin' ? 'activo' : ''}`} onClick={() => setVista('admin')}><Settings size={17} />Administración</button></>}
        <div className="pie">Grupo 10 · Gestión de Proyectos de Software · Duoc UC</div>
      </aside>
      <div className="principal">
        <header className="barra no-imprimir">
          <select className="entrada" style={{ width: 'auto', maxWidth: 380, fontWeight: 600 }} value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
            {datos.proyectos.map((x) => <option key={x.id} value={x.id}>{x.codigo} · {x.nombre}</option>)}
          </select>
          {p && <span className="peq muted">Corte: <b>{fecha(p.fechaCorte)}</b></span>}
          {calc && calc.alertas.filter((a) => a.gravedad === 'alta').length > 0 && <Chip color="rojo">{calc.alertas.filter((a) => a.gravedad === 'alta').length} alertas altas</Chip>}
          <span className="espacio" />
          <Chip color={sync === 'error' ? 'rojo' : sync === 'guardando' ? 'amarillo' : 'verde'}>
            {modo === 'supabase' ? (sync === 'guardando' ? 'Guardando…' : sync === 'error' ? 'Error al guardar' : 'Sincronizado en tiempo real') : 'Modo local'}
          </Chip>
          {errorSync && <span className="peq" style={{ color: 'var(--crit)' }} title={errorSync}>⚠</span>}
          {modo === 'local' ? (
            <select className="entrada" style={{ width: 'auto' }} value={rol} onChange={(e) => setRolLocal(e.target.value as Rol)}>
              <option value="admin">Rol: Administrador</option>
              <option value="usuario">Rol: Usuario de proyecto</option>
            </select>
          ) : (
            <Chip color={rol === 'admin' ? 'morado' : 'azul'}>{usuario} · {rol === 'admin' ? 'Administrador' : 'Usuario'}</Chip>
          )}
          <button className="btn chico" onClick={() => window.print()} title="Imprimir esta vista"><Printer size={14} /></button>
          {onSalir && <button className="btn chico" onClick={onSalir} title="Cerrar sesión"><LogOut size={14} /></button>}
        </header>
        <main className="contenido">
          <div className="solo-impresion" style={{ marginBottom: 8 }}><b>{p?.codigo} · {p?.nombre}</b> — fecha de corte {fecha(p?.fechaCorte)}</div>
          <Contenido />
        </main>
      </div>
      <PanelImpacto />
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const entrar = async () => {
    if (!supabase) return;
    setCargando(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: clave });
    if (error) setError(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message);
    setCargando(false);
  };
  return (
    <div className="login">
      <div className="caja">
        <div className="fila"><div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(150deg,#7a5cf5,#5cc8e0)', display: 'grid', placeItems: 'center', color: '#fff' }}><CalendarRange size={20} /></div><div><b style={{ fontSize: 17 }}>GestorGPS</b><div className="peq muted">Planificación, seguimiento y gestión del cambio</div></div></div>
        <div className="campo"><label>Correo</label><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoFocus /></div>
        <div className="campo"><label>Contraseña</label><input value={clave} onChange={(e) => setClave(e.target.value)} type="password" onKeyDown={(e) => e.key === 'Enter' && void entrar()} /></div>
        {error && <div className="alerta alta">{error}</div>}
        <button className="btn prim" style={{ justifyContent: 'center', padding: '9px' }} onClick={() => void entrar()} disabled={cargando || !email || !clave}>{cargando ? 'Ingresando…' : 'Ingresar'}</button>
        <div className="peq muted">Roles: administrador y usuario de proyecto.</div>
      </div>
    </div>
  );
}

export default function App() {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [rol, setRol] = useState<Rol | null>(null);
  const [nombre, setNombre] = useState<string | null>(null);
  const [listo, setListo] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSesion(data.session); setListo(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !sesion) return;
    supabase.from('perfiles').select('rol,nombre,email').eq('id', sesion.user.id).maybeSingle().then(({ data }) => {
      setRol((data?.rol as Rol) ?? 'usuario');
      setNombre(data?.nombre || data?.email || sesion.user.email || null);
    });
  }, [sesion]);

  if (!listo) return <div className="cargando">Cargando…</div>;
  if (supabase && !sesion) return <Login />;
  if (supabase && !rol) return <div className="cargando">Cargando perfil…</div>;
  return (
    <StoreProvider rolSesion={rol} usuarioSesion={nombre}>
      <Estructura onSalir={supabase ? () => void supabase!.auth.signOut() : undefined} />
    </StoreProvider>
  );
}
