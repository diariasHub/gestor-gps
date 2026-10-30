// Genera supabase/semilla.sql con el caso de prueba Impacto Eventos.
import { writeFileSync } from 'node:fs';
import { crearSemilla } from '../src/data/semilla';
import { ORDEN, TABLAS, aFila } from '../src/state/persistencia';

const d = crearSemilla();
let sql = '-- Caso de prueba: Impacto Eventos (generado desde src/data/semilla.ts)\nbegin;\n';
for (const c of [...ORDEN].reverse()) sql += `delete from public.${TABLAS[c]};\n`;
for (const c of ORDEN) {
  const filas = (d[c] as unknown as Record<string, unknown>[]).map(aFila);
  if (!filas.length) continue;
  const cols = Object.keys(filas[0]);
  const json = JSON.stringify(filas).replace(/'/g, "''");
  sql += `insert into public.${TABLAS[c]} (${cols.join(', ')})\n  select ${cols.join(', ')} from jsonb_populate_recordset(null::public.${TABLAS[c]}, '${json}'::jsonb);\n`;
}
sql += 'commit;\n';
writeFileSync('supabase/semilla.sql', sql);
console.log('ok', sql.length);
