import { Fragment, useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useStore } from '../state/store';
import { supabase } from '../state/persistencia';
import { Chip, Encabezado, Tarjeta } from '../ui';

interface Perfil { id: string; email: string; nombre: string; rol: 'admin' | 'usuario' }

export function Admin() {
  const { modo, restablecer, esAdmin, datos } = useStore();
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('perfiles').select('*').order('email');
    if (error) setError(error.message);
    else setPerfiles((data ?? []) as Perfil[]);
  };
  useEffect(() => { void cargar(); }, []);

  const cambiarRol = async (p: Perfil, rol: Perfil['rol']) => {
    if (!supabase) return;
    const { error } = await supabase.from('perfiles').update({ rol }).eq('id', p.id);
    if (error) setError(error.message);
    else void cargar();
  };

  if (!esAdmin) return <div className="vacio">Solo el administrador puede ver esta sección.</div>;
  const conteo = { actividades: datos.actividades.length, dependencias: datos.dependencias.length, recursos: datos.recursos.length, asignaciones: datos.asignaciones.length, hitos: datos.hitos.length, kpis: datos.kpis.length, cambios: datos.cambios.length, mediciones: datos.mediciones.length };

  return (
    <div>
      <Encabezado titulo="Administración" sub="Usuarios, roles y datos del caso de prueba" />
      <div className="grid g2">
        <Tarjeta titulo="Usuarios y roles">
          {modo === 'local' ? (
            <p className="peq muted">Modo local (sin base de datos): el rol se elige en la barra superior para probar ambos perfiles.</p>
          ) : (
            <>
              <table className="tabla">
                <thead><tr><th>Usuario</th><th>Rol</th><th /></tr></thead>
                <tbody>
                  {perfiles.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nombre || p.email}<div className="peq muted">{p.email}</div></td>
                      <td><Chip color={p.rol === 'admin' ? 'morado' : 'azul'}>{p.rol === 'admin' ? 'Administrador' : 'Usuario de proyecto'}</Chip></td>
                      <td className="num"><select className="entrada" style={{ width: 160 }} value={p.rol} onChange={(e) => void cambiarRol(p, e.target.value as Perfil['rol'])}><option value="admin">Administrador</option><option value="usuario">Usuario de proyecto</option></select></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {error && <div className="alerta alta">{error}</div>}
            </>
          )}
          <div className="sep" />
          <div className="peq">
            <b>Administrador:</b> crea y edita proyectos, actividades, dependencias, recursos, hitos y KPI; aprueba o rechaza cambios; define la línea base.<br />
            <b>Usuario de proyecto:</b> consulta todo, registra avance, fechas y costos reales, y crea solicitudes de cambio.
          </div>
        </Tarjeta>
        <Tarjeta titulo="Datos del sistema">
          <div className="datos-calc">
            {Object.entries(conteo).map(([k, v]) => <Fragment key={k}><span>{k}</span><b>{v}</b></Fragment>)}
          </div>
          <p className="peq muted">Persistencia: {modo === 'supabase' ? 'Supabase (PostgreSQL) con sincronización en tiempo real' : 'almacenamiento local del navegador'}.</p>
          <button className="btn peligro" onClick={() => confirm('Se borrarán todos los datos y se cargará de nuevo el caso de prueba de Impacto Eventos. ¿Continuar?') && void restablecer()}>
            <RotateCcw size={14} /> Restablecer caso de prueba
          </button>
        </Tarjeta>
      </div>
    </div>
  );
}
