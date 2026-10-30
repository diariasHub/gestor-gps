-- GestorGPS · Esquema de base de datos (Supabase / PostgreSQL)
-- Ejecutar completo en el editor SQL del proyecto. Es idempotente: se puede volver a correr.

-- ============ Perfiles y roles ============
create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nombre text not null default '',
  rol text not null default 'usuario' check (rol in ('admin', 'usuario')),
  created_at timestamptz not null default now()
);

-- Crea el perfil automáticamente al registrar un usuario
create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre, rol)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nombre', ''), coalesce(new.raw_user_meta_data ->> 'rol', 'usuario'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil();

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin');
$$;

-- ============ Planificación ============
create table if not exists public.proyectos (
  id text primary key,
  codigo text not null unique,
  nombre text not null,
  descripcion text not null default '',
  responsable text not null default '',
  fecha_inicio date not null,
  fecha_termino_plan date not null,
  presupuesto numeric not null default 0 check (presupuesto >= 0),
  estado text not null default 'Planificado' check (estado in ('Planificado', 'En ejecución', 'Suspendido', 'Terminado')),
  fecha_corte date not null,
  feriados jsonb not null default '[]',
  created_at timestamptz not null default now(),
  check (fecha_termino_plan > fecha_inicio)
);

create table if not exists public.actividades (
  id text primary key,
  proyecto_id text not null references public.proyectos (id) on delete cascade,
  parent_id text references public.actividades (id) on delete cascade,
  codigo text not null,
  nombre text not null,
  descripcion text not null default '',
  nivel text not null check (nivel in ('etapa', 'actividad', 'subactividad')),
  responsable text not null default '',
  duracion integer not null default 0 check (duracion >= 0),
  inicio_minimo date,
  inicio_real date,
  fin_real date,
  avance numeric not null default 0 check (avance between 0 and 100),
  costo_real numeric not null default 0 check (costo_real >= 0),
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.dependencias (
  id text primary key,
  proyecto_id text not null references public.proyectos (id) on delete cascade,
  pred_id text not null references public.actividades (id) on delete cascade,
  suc_id text not null references public.actividades (id) on delete cascade,
  tipo text not null check (tipo in ('FS', 'SS', 'FF', 'SF')),
  desfase integer not null default 0,
  created_at timestamptz not null default now(),
  check (pred_id <> suc_id)
);

create table if not exists public.recursos (
  id text primary key,
  proyecto_id text not null references public.proyectos (id) on delete cascade,
  tipo text not null check (tipo in ('profesional', 'tipo_profesional', 'licencia', 'material', 'equipamiento', 'otro')),
  nombre text not null,
  detalle text not null default '',
  valor numeric not null default 0 check (valor >= 0),
  horas_semana numeric not null default 0 check (horas_semana >= 0),
  unidad text not null default '',
  periodo text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.asignaciones (
  id text primary key,
  proyecto_id text not null references public.proyectos (id) on delete cascade,
  actividad_id text not null references public.actividades (id) on delete cascade,
  -- restrict: no se puede eliminar un recurso que está asignado
  recurso_id text not null references public.recursos (id) on delete restrict,
  horas_semana numeric not null default 0 check (horas_semana >= 0),
  cantidad numeric not null default 0 check (cantidad >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.hitos (
  id text primary key,
  proyecto_id text not null references public.proyectos (id) on delete cascade,
  codigo text not null,
  nombre text not null,
  descripcion text not null default '',
  responsable text not null default '',
  fecha_comprometida date,
  fecha_real date,
  criterios text not null default '',
  evidencia text not null default '',
  aceptado boolean not null default false,
  actividad_ids jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- ============ Control ============
create table if not exists public.kpis (
  id text primary key,
  proyecto_id text not null references public.proyectos (id) on delete cascade,
  codigo text not null,
  nombre text not null,
  objetivo text not null default '',
  ambito text not null default 'proyecto',
  categoria text not null check (categoria in ('proyecto', 'cambio')),
  formula text not null default '',
  unidad text not null default '',
  meta numeric not null default 0,
  meta_max numeric,
  sentido text not null check (sentido in ('mayor', 'menor', 'rango')),
  tolerancia numeric not null default 0,
  periodicidad text not null default '',
  fuente text not null default '',
  responsable text not null default '',
  valor_manual numeric,
  hito_id text references public.hitos (id) on delete set null,
  adicional boolean not null default false,
  justificacion text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.mediciones (
  id text primary key,
  proyecto_id text not null references public.proyectos (id) on delete cascade,
  kpi_id text not null references public.kpis (id) on delete cascade,
  fecha date not null,
  valor numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cambios (
  id text primary key,
  proyecto_id text not null references public.proyectos (id) on delete cascade,
  codigo text not null,
  titulo text not null,
  solicitante text not null default '',
  fecha date not null,
  descripcion text not null default '',
  justificacion text not null default '',
  tipo text not null,
  prioridad text not null,
  urgente boolean not null default false,
  importante boolean not null default false,
  riesgo text not null,
  impacto text not null default '',
  responsable text not null default '',
  estado text not null check (estado in ('Abierto', 'En evaluación', 'Aprobado', 'Rechazado', 'En implementación', 'Cerrado')),
  paso integer not null default 1 check (paso between 1 and 10),
  fecha_comprometida date,
  fecha_real date,
  costo_estimado numeric not null default 0,
  costo_real numeric not null default 0,
  resultado text not null default '',
  exitoso boolean,
  adopcion numeric not null default 0 check (adopcion between 0 and 100),
  acciones_correctivas text not null default '',
  acciones jsonb not null default '[]',   -- modificaciones al plan con trazabilidad
  historial jsonb not null default '[]',  -- registro de cada paso del flujo
  created_at timestamptz not null default now()
);

create table if not exists public.lineas_base (
  id text primary key,
  proyecto_id text not null references public.proyectos (id) on delete cascade,
  fecha date not null,
  motivo text not null default '',
  actividades jsonb not null default '{}', -- fotografía de fechas, costos y duraciones
  fin date not null,
  costo_total numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ============ Seguridad (RLS) ============
-- Lectura: cualquier usuario autenticado. Crear y modificar: autenticados
-- (la interfaz restringe por rol). Eliminar: solo administradores.
alter table public.perfiles enable row level security;
drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles for select to authenticated using (true);
drop policy if exists perfiles_admin on public.perfiles;
create policy perfiles_admin on public.perfiles for update to authenticated using (public.es_admin()) with check (public.es_admin());

do $$
declare t text;
begin
  foreach t in array array['proyectos','actividades','dependencias','recursos','asignaciones','hitos','kpis','mediciones','cambios','lineas_base'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists leer on public.%I', t);
    execute format('create policy leer on public.%I for select to authenticated using (true)', t);
    execute format('drop policy if exists insertar on public.%I', t);
    execute format('create policy insertar on public.%I for insert to authenticated with check (true)', t);
    execute format('drop policy if exists actualizar on public.%I', t);
    execute format('create policy actualizar on public.%I for update to authenticated using (true) with check (true)', t);
    execute format('drop policy if exists eliminar on public.%I', t);
    execute format('create policy eliminar on public.%I for delete to authenticated using (public.es_admin())', t);
    -- tiempo real
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Índices para las consultas por proyecto
create index if not exists ix_act_proy on public.actividades (proyecto_id);
create index if not exists ix_dep_proy on public.dependencias (proyecto_id);
create index if not exists ix_asig_act on public.asignaciones (actividad_id);
create index if not exists ix_asig_rec on public.asignaciones (recurso_id);
create index if not exists ix_med_kpi on public.mediciones (kpi_id);
