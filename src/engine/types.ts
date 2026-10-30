// Modelo de datos del sistema de planificación, seguimiento y gestión del cambio.
// Todas las fechas se guardan como texto ISO "AAAA-MM-DD".

export type Rol = 'admin' | 'usuario';

export type EstadoProyecto = 'Planificado' | 'En ejecución' | 'Suspendido' | 'Terminado';

export interface Feriado {
  fecha: string;
  descripcion: string;
}

export interface Proyecto {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  responsable: string;
  fechaInicio: string;
  fechaTerminoPlan: string; // fecha comprometida de término
  presupuesto: number;
  estado: EstadoProyecto;
  fechaCorte: string; // fecha de control (status date) para medir avance y atrasos
  feriados: Feriado[];
}

export type Nivel = 'etapa' | 'actividad' | 'subactividad';

export interface Actividad {
  id: string;
  proyectoId: string;
  parentId: string | null;
  codigo: string;
  nombre: string;
  descripcion: string;
  nivel: Nivel;
  responsable: string;
  duracion: number; // días hábiles (solo actividades sin hijos)
  inicioMinimo: string | null; // restricción "no comenzar antes de"
  inicioReal: string | null;
  finReal: string | null;
  avance: number; // 0 - 100
  costoReal: number;
  orden: number;
}

export type TipoDep = 'FS' | 'SS' | 'FF' | 'SF';

export interface Dependencia {
  id: string;
  proyectoId: string;
  predId: string;
  sucId: string;
  tipo: TipoDep;
  desfase: number; // días hábiles, positivo (espera) o negativo (adelanto)
}

export type TipoRecurso =
  | 'profesional'
  | 'tipo_profesional'
  | 'licencia'
  | 'material'
  | 'equipamiento'
  | 'otro';

export interface Recurso {
  id: string;
  proyectoId: string;
  tipo: TipoRecurso;
  nombre: string;
  detalle: string; // especialidad, categoría, software, unidad o descripción
  valor: number; // valor hora | tarifa semanal | costo unitario
  horasSemana: number; // horas disponibles por semana (profesionales)
  unidad: string;
  periodo: string;
}

export interface Asignacion {
  id: string;
  proyectoId: string;
  actividadId: string;
  recursoId: string;
  horasSemana: number; // profesionales
  cantidad: number; // resto de recursos
}

export interface Hito {
  id: string;
  proyectoId: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  responsable: string;
  fechaComprometida: string;
  fechaReal: string | null;
  criterios: string;
  evidencia: string;
  aceptado: boolean;
  actividadIds: string[];
}

export type Sentido = 'mayor' | 'menor' | 'rango';
export type Ambito = 'proyecto' | 'etapa' | 'actividad' | 'hito' | 'cambio';

export interface KPI {
  id: string;
  proyectoId: string;
  codigo: string;
  nombre: string;
  objetivo: string;
  ambito: Ambito;
  categoria: 'proyecto' | 'cambio';
  formula: string;
  unidad: string;
  meta: number;
  metaMax: number | null; // solo sentido "rango"
  sentido: Sentido;
  tolerancia: number; // margen para semáforo amarillo
  periodicidad: string;
  fuente: string;
  responsable: string;
  valorManual: number | null; // medición manual cuando no hay fuente automática
  hitoId: string | null;
  adicional: boolean; // KPI adicional definido por el equipo
  justificacion: string;
}

export interface Medicion {
  id: string;
  proyectoId: string;
  kpiId: string;
  fecha: string;
  valor: number;
}

export type EstadoCambio =
  | 'Abierto'
  | 'En evaluación'
  | 'Aprobado'
  | 'Rechazado'
  | 'En implementación'
  | 'Cerrado';

export type TipoCambio = 'Alcance' | 'Tiempo' | 'Costo' | 'Recurso' | 'Tecnología' | 'Organización';
export type Prioridad = 'Baja' | 'Media' | 'Alta' | 'Crítica';
export type NivelRiesgo = 'Bajo' | 'Medio' | 'Alto' | 'Crítico';

export interface AccionCambio {
  id: string;
  tipo: 'duracion' | 'recurso' | 'presupuesto';
  actividadId: string | null;
  recursoId: string | null;
  delta: number; // días (duración), horas/semana o cantidad (recurso), pesos (presupuesto)
  aplicada: boolean;
  aplicadaEn: string | null;
}

export interface RegistroPaso {
  paso: number;
  estado: EstadoCambio;
  fecha: string;
  usuario: string;
  nota: string;
}

export interface Cambio {
  id: string;
  proyectoId: string;
  codigo: string;
  titulo: string;
  solicitante: string;
  fecha: string;
  descripcion: string;
  justificacion: string;
  tipo: TipoCambio;
  prioridad: Prioridad;
  urgente: boolean;
  importante: boolean;
  riesgo: NivelRiesgo;
  impacto: string;
  responsable: string;
  estado: EstadoCambio;
  paso: number; // 1 a 10
  fechaComprometida: string;
  fechaReal: string | null;
  costoEstimado: number;
  costoReal: number;
  resultado: string;
  exitoso: boolean | null;
  adopcion: number; // 0 - 100
  accionesCorrectivas: string;
  acciones: AccionCambio[];
  historial: RegistroPaso[];
}

export interface LineaBase {
  id: string;
  proyectoId: string;
  fecha: string;
  motivo: string;
  actividades: Record<string, { inicio: string; fin: string; costo: number; duracion: number }>;
  fin: string;
  costoTotal: number;
}

export interface Datos {
  proyectos: Proyecto[];
  actividades: Actividad[];
  dependencias: Dependencia[];
  recursos: Recurso[];
  asignaciones: Asignacion[];
  hitos: Hito[];
  kpis: KPI[];
  mediciones: Medicion[];
  cambios: Cambio[];
  lineasBase: LineaBase[];
}

export const PASOS_CAMBIO = [
  'Identificar la necesidad del cambio',
  'Analizar y evaluar la realización del cambio',
  'Evaluación de los riesgos',
  'Planificación',
  'Comunicación del cambio',
  'Implementación del cambio',
  'Evaluación y seguimiento del plan de trabajo',
  'Comunicación de los resultados a corto plazo',
  'Generar las acciones correctivas',
  'Adoptar el cambio en la cultura de la empresa',
] as const;

/** Estado que corresponde a cada paso del flujo (paso 1..10). */
export function estadoDePaso(paso: number): EstadoCambio {
  if (paso <= 1) return 'Abierto';
  if (paso <= 3) return 'En evaluación';
  if (paso <= 5) return 'Aprobado';
  if (paso <= 9) return 'En implementación';
  return 'Cerrado';
}

export const TIPOS_RECURSO: Record<TipoRecurso, { etiqueta: string; valor: string; detalle: string; cantidad: string }> = {
  profesional: { etiqueta: 'Profesionales', valor: 'Valor hora', detalle: 'Especialidad', cantidad: 'Horas/semana' },
  tipo_profesional: { etiqueta: 'Tipo de profesional', valor: 'Tarifa semanal', detalle: 'Categoría', cantidad: 'Cantidad requerida' },
  licencia: { etiqueta: 'Licencias', valor: 'Costo por licencia', detalle: 'Software', cantidad: 'Cantidad' },
  material: { etiqueta: 'Materiales', valor: 'Valor unitario', detalle: 'Descripción', cantidad: 'Cantidad' },
  equipamiento: { etiqueta: 'Equipamiento', valor: 'Costo de uso/arriendo', detalle: 'Equipo', cantidad: 'Cantidad' },
  otro: { etiqueta: 'Otros', valor: 'Costo', detalle: 'Descripción', cantidad: 'Cantidad' },
};
