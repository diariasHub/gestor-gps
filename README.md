# GestorGPS · Planificación, seguimiento y gestión del cambio

Aplicación web del **Proyecto Integrador 2** del ramo Gestión de Proyectos de Software (Duoc UC) — Grupo 10: Raúl Olguín y Diego Arias.
Caso de prueba: **Impacto Eventos** (Plataforma de Gestión Operativa).

## Funcionalidades
- **Proyectos:** creación, edición, cierre y calendario laboral (feriados de Chile).
- **Carta Gantt editable:** jerarquía etapa → actividad → subactividad (1, 1.1, 1.1.1), dependencias FS/SS/FF/SF con desfases, ruta crítica, holguras, línea base, arrastrar para mover o cambiar duración.
- **Recursos y costos:** profesionales, tipos de profesional, licencias, materiales, equipamiento y otros; carga semanal y sobreasignaciones.
- **Hitos:** asociación de actividades y criterios de cumplimiento, estado (en plazo, con atraso, vencido, en riesgo).
- **KPI configurables:** fórmula, meta, sentido, tolerancia y semáforo; historial de mediciones.
- **Gestión del cambio:** flujo de 10 pasos, matriz de Eisenhower, simulación del impacto antes de aprobar y trazabilidad de las modificaciones al plan.
- **Tableros** de seguimiento del proyecto y de gestión del cambio, e **informe ejecutivo imprimible**.
- **Roles:** administrador y usuario de proyecto. Sincronización en tiempo real entre usuarios.

## Tecnología
React 19 + TypeScript + Vite · Recharts · Supabase (PostgreSQL, autenticación, RLS y tiempo real) · Vercel.

## Ejecutar en local
```bash
npm install
npm run dev        # sin variables de entorno funciona en modo local (datos en el navegador)
npm test           # pruebas del motor de cálculo
```
Para usar Supabase, crear `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

## Base de datos
- `supabase/esquema.sql`: tablas, llaves foráneas, políticas RLS y publicación de tiempo real.
- `supabase/semilla.sql`: caso de prueba Impacto Eventos (se regenera con `npx tsx scripts/generar-semilla-sql.ts`).
