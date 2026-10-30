// Caso de prueba: proyecto "Plataforma de Gestión Operativa – Impacto Eventos" (Caso 2).
// 5 etapas (ciclo de vida PMBOK), 12 actividades, 20 subactividades, dependencias FS/SS/FF/SF,
// 5 profesionales, 6 tipos de recurso, 6 hitos, 8 KPI de proyecto e hitos, 12 KPI de cambio y 5 solicitudes.

import type { Actividad, Asignacion, Cambio, Datos, Dependencia, Hito, KPI, Medicion, Proyecto, Recurso, TipoDep } from '../engine/types';
import { calcular, crearLineaBase } from '../engine/calculo';
import { aplicarAcciones, nuevoId } from '../engine/cambios';

export function crearSemilla(): Datos {
  const pid = nuevoId();
  const proyecto: Proyecto = {
    id: pid,
    codigo: 'IE-2026',
    nombre: 'Plataforma de Gestión Operativa – Impacto Eventos',
    descripcion:
      'Plataforma integral para la operación de Impacto Eventos: catálogo y reserva de recursos, trazabilidad de los 4.800 activos, control de cambios en terreno, costos por evento e integración con el ERP, con visibilidad en tiempo real para el Directorio.',
    responsable: 'Camila Fuentes (Jefa de Proyecto)',
    fechaInicio: '2026-03-02',
    fechaTerminoPlan: '2026-10-30',
    presupuesto: 225_000_000,
    estado: 'En ejecución',
    fechaCorte: '2026-06-12',
    feriados: [
      { fecha: '2026-04-03', descripcion: 'Viernes Santo' },
      { fecha: '2026-05-01', descripcion: 'Día del Trabajo' },
      { fecha: '2026-05-21', descripcion: 'Día de las Glorias Navales' },
      { fecha: '2026-06-29', descripcion: 'San Pedro y San Pablo' },
      { fecha: '2026-07-16', descripcion: 'Virgen del Carmen' },
      { fecha: '2026-09-18', descripcion: 'Fiestas Patrias' },
      { fecha: '2026-10-12', descripcion: 'Encuentro de Dos Mundos' },
    ],
  };

  // ----- Estructura: [código, nombre, nivel, duración, responsable, avance, descripción]
  type Fila = [string, string, Actividad['nivel'], number, string, number, string];
  const filas: Fila[] = [
    ['1', 'Iniciación', 'etapa', 0, 'Camila Fuentes', 0, 'Constitución formal del proyecto'],
    ['1.1', 'Acta de constitución del proyecto', 'actividad', 0, 'Camila Fuentes', 0, 'Charter aprobado por la Gerencia General'],
    ['1.1.1', 'Levantamiento de antecedentes', 'subactividad', 5, 'Matías Soto', 100, 'Revisión del caso, procesos actuales y restricciones'],
    ['1.1.2', 'Elaboración y aprobación del Project Charter', 'subactividad', 5, 'Camila Fuentes', 100, 'Charter, objetivos, alcance, supuestos y restricciones'],
    ['1.2', 'Registro y análisis de interesados', 'actividad', 4, 'Camila Fuentes', 100, 'Matriz de interesados y estrategia de gestión'],
    ['2', 'Planificación', 'etapa', 0, 'Camila Fuentes', 0, 'Requisitos, diseño y plan del proyecto'],
    ['2.1', 'Requisitos de la solución', 'actividad', 0, 'Matías Soto', 0, 'Requisitos funcionales y no funcionales'],
    ['2.1.1', 'Catálogo de requisitos', 'subactividad', 8, 'Matías Soto', 100, 'Entrevistas con las gerencias y priorización'],
    ['2.1.2', 'Especificación funcional', 'subactividad', 8, 'Matías Soto', 100, 'Historias de usuario y procesos TO-BE'],
    ['2.1.3', 'Línea base de requisitos aprobada', 'subactividad', 5, 'Camila Fuentes', 100, 'Acta de aprobación del alcance funcional'],
    ['2.2', 'Arquitectura y diseño', 'actividad', 0, 'Javiera Pérez', 0, 'Arquitectura, integraciones y experiencia de usuario'],
    ['2.2.1', 'Arquitectura de la solución', 'subactividad', 10, 'Javiera Pérez', 100, 'Componentes, modelo de datos e integraciones ERP y QR'],
    ['2.2.2', 'Prototipo UX/UI validado', 'subactividad', 12, 'Tomás Rivas', 100, 'Prototipo navegable validado con usuarios clave'],
    ['3', 'Ejecución', 'etapa', 0, 'Camila Fuentes', 0, 'Construcción de los módulos de la plataforma'],
    ['3.1', 'Módulo Comercial y Proveedores', 'actividad', 0, 'Tomás Rivas', 0, 'Cotizaciones rápidas sin doble reserva'],
    ['3.1.1', 'Repositorio de proveedores', 'subactividad', 10, 'Matías Soto', 100, '140 proveedores con tarifas versionadas'],
    ['3.1.2', 'Catálogo y validador de disponibilidad', 'subactividad', 16, 'Javiera Pérez', 100, 'Catálogo único y bloqueo de reservas duplicadas'],
    ['3.1.3', 'Motor de cotizaciones', 'subactividad', 16, 'Tomás Rivas', 40, 'Cotización en menos de 48 horas'],
    ['3.2', 'Módulo de Inventario', 'actividad', 0, 'Javiera Pérez', 0, 'Trazabilidad de los 4.800 activos'],
    ['3.2.1', 'Base de activos depurada y etiquetada', 'subactividad', 10, 'Matías Soto', 100, 'Depuración, código único y etiquetas QR'],
    ['3.2.2', 'Trazabilidad y despacho de activos', 'subactividad', 15, 'Javiera Pérez', 100, 'Ubicación, despacho y devolución por evento'],
    ['3.3', 'Módulo de Terreno y Personal', 'actividad', 0, 'Tomás Rivas', 0, 'Asignación de personal y control de cambios en terreno'],
    ['3.3.1', 'Asignación de personal con certificaciones', 'subactividad', 8, 'Matías Soto', 100, 'Bloqueo de asignaciones sin certificación'],
    ['3.3.2', 'Bitácora y valorización de cambios en terreno', 'subactividad', 12, 'Tomás Rivas', 30, 'Registro auditable con aprobación y costo'],
    ['3.4', 'Integración ERP y Dashboard', 'actividad', 0, 'Javiera Pérez', 0, 'Cierre financiero y visibilidad ejecutiva'],
    ['3.4.1', 'Conector API–ERP', 'subactividad', 12, 'Javiera Pérez', 0, 'Integración sin modificar el ERP'],
    ['3.4.2', 'Panel de control del Directorio', 'subactividad', 6, 'Tomás Rivas', 0, 'Cinco vistas solicitadas por el Directorio'],
    ['4', 'Supervisión y control', 'etapa', 0, 'Valentina Muñoz', 0, 'Aseguramiento de calidad y aceptación'],
    ['4.1', 'Pruebas técnicas', 'actividad', 0, 'Valentina Muñoz', 0, 'Pruebas de integración y rendimiento'],
    ['4.1.1', 'Pruebas de integración', 'subactividad', 10, 'Valentina Muñoz', 0, 'Módulos y conector ERP funcionando en conjunto'],
    ['4.1.2', 'Pruebas de rendimiento', 'subactividad', 5, 'Valentina Muñoz', 0, '11 eventos simultáneos y 600 personas'],
    ['4.2', 'Pruebas de aceptación de usuarios (UAT)', 'actividad', 8, 'Camila Fuentes', 0, 'Validación con productores, bodega, comercial y finanzas'],
    ['5', 'Cierre', 'etapa', 0, 'Camila Fuentes', 0, 'Puesta en producción y cierre formal'],
    ['5.1', 'Puesta en producción', 'actividad', 0, 'Javiera Pérez', 0, 'Capacitación y Go-Live antes de noviembre'],
    ['5.1.1', 'Capacitación de usuarios', 'subactividad', 8, 'Matías Soto', 0, 'Capacitación por perfil y manuales'],
    ['5.1.2', 'Despliegue (Go-Live)', 'subactividad', 2, 'Javiera Pérez', 0, 'Paso a producción y migración final'],
    ['5.2', 'Acta de cierre y lecciones aprendidas', 'actividad', 4, 'Camila Fuentes', 0, 'Aceptación final y lecciones aprendidas'],
  ];

  const porCodigo = new Map<string, Actividad>();
  const actividades: Actividad[] = filas.map(([codigo, nombre, nivel, duracion, responsable, avance, descripcion], i) => {
    const padre = codigo.includes('.') ? codigo.slice(0, codigo.lastIndexOf('.')) : null;
    const a: Actividad = {
      id: nuevoId(),
      proyectoId: pid,
      parentId: padre ? porCodigo.get(padre)!.id : null,
      codigo,
      nombre,
      descripcion,
      nivel,
      responsable,
      duracion,
      inicioMinimo: null,
      inicioReal: null,
      finReal: null,
      avance,
      costoReal: 0,
      orden: i,
    };
    porCodigo.set(codigo, a);
    return a;
  });
  const A = (c: string) => porCodigo.get(c)!.id;

  // ----- Dependencias [predecesora, sucesora, tipo, desfase]
  const defs: [string, string, TipoDep, number][] = [
    ['1.1.1', '1.1.2', 'FS', 0],
    ['1.1.1', '1.2', 'SS', 2],
    ['1.2', '2.1.1', 'FS', 0],
    ['1.1.2', '2.1.1', 'FS', 0],
    ['2.1.1', '2.1.2', 'FS', 0],
    ['2.1.2', '2.1.3', 'FS', 0],
    ['2.1.2', '2.2.1', 'SS', 5],
    ['2.2.1', '2.2.2', 'SS', 3],
    ['2.1.3', '2.2.2', 'FF', 0],
    ['2.1.3', '3.1.1', 'FS', 0],
    ['2.2.1', '3.1.1', 'FS', 0],
    ['3.1.1', '3.1.2', 'FS', 0],
    ['3.1.2', '3.1.3', 'FS', 0],
    ['2.2.2', '3.1.3', 'FS', 0],
    ['2.1.3', '3.2.1', 'FS', 0],
    ['3.2.1', '3.2.2', 'FS', 0],
    ['3.2.2', '3.3.1', 'FS', 0],
    ['3.3.1', '3.3.2', 'FS', 0],
    ['3.1.3', '3.4.1', 'FS', 0],
    ['3.3.2', '3.4.1', 'FS', 0],
    ['3.4.1', '3.4.2', 'FS', 0],
    ['3.4.2', '4.1.1', 'FS', 0],
    ['4.1.1', '4.1.2', 'FS', 0],
    ['4.1.2', '4.2', 'FS', 0],
    ['4.2', '5.1.1', 'FS', 0],
    ['5.1.1', '5.1.2', 'FS', -2],
    ['5.1.2', '5.2', 'FS', 3],
    ['5.1.2', '5.2', 'SF', 5],
  ];
  const dependencias: Dependencia[] = defs.map(([p, s, tipo, desfase]) => ({ id: nuevoId(), proyectoId: pid, predId: A(p), sucId: A(s), tipo, desfase }));

  // ----- Recursos
  const R = (tipo: Recurso['tipo'], nombre: string, detalle: string, valor: number, horasSemana = 0, unidad = '', periodo = ''): Recurso => ({
    id: nuevoId(), proyectoId: pid, tipo, nombre, detalle, valor, horasSemana, unidad, periodo,
  });
  const pm = R('profesional', 'Camila Fuentes', 'Jefa de Proyecto', 32_000, 45);
  const an = R('profesional', 'Matías Soto', 'Analista Funcional', 24_000, 45);
  const be = R('profesional', 'Javiera Pérez', 'Desarrolladora Backend', 27_000, 45);
  const fe = R('profesional', 'Tomás Rivas', 'Desarrollador Frontend', 25_000, 45);
  const qa = R('profesional', 'Valentina Muñoz', 'Ingeniera QA', 22_000, 45);
  const fs = R('tipo_profesional', 'Desarrollador Fullstack externo', 'Desarrollo de software', 1_150_000, 0, 'persona', 'semana');
  const lic = R('licencia', 'Conector API del ERP', 'Licencia de integración del proveedor del ERP', 8_500_000, 0, 'licencia', 'anual');
  const carga = R('licencia', 'Herramienta de pruebas de carga', 'Software de pruebas de rendimiento', 450_000, 0, 'licencia', 'mensual');
  const etiq = R('material', 'Etiquetas QR para activos', 'Etiqueta adhesiva resistente', 180, 0, 'unidad');
  const cloud = R('equipamiento', 'Infraestructura cloud', 'Servidores y base de datos productivos', 1_250_000, 0, 'mes');
  const note = R('equipamiento', 'Arriendo de notebooks', 'Equipos para el equipo de desarrollo', 95_000, 0, 'equipo-mes');
  const capac = R('otro', 'Servicio de capacitación presencial', 'Sesiones por perfil y manuales impresos', 5_500_000, 0, 'servicio');
  const recursos = [pm, an, be, fe, qa, fs, lic, carga, etiq, cloud, note, capac];

  const asig: [string, Recurso, number][] = [
    ['1.1.1', pm, 30], ['1.1.1', an, 30], ['1.1.2', pm, 40], ['1.2', pm, 15], ['1.2', an, 20],
    ['2.1.1', an, 40], ['2.1.1', pm, 10], ['2.1.2', an, 40], ['2.1.3', pm, 20], ['2.1.3', an, 20],
    ['2.2.1', be, 40], ['2.2.2', fe, 40],
    ['3.1.1', an, 30], ['3.1.1', note, 10], ['3.1.2', be, 25], ['3.1.2', fs, 2], ['3.1.3', fe, 25], ['3.1.3', fs, 2], ['3.1.3', qa, 10],
    ['3.2.1', an, 25], ['3.2.1', etiq, 4800], ['3.2.2', be, 30], ['3.2.2', fs, 2],
    ['3.3.1', an, 30], ['3.3.1', fe, 20], ['3.3.2', fe, 20], ['3.3.2', be, 15],
    ['3.4.1', be, 40], ['3.4.1', fs, 1], ['3.4.1', lic, 1], ['3.4.2', fe, 40], ['3.4.2', fs, 1], ['3.4.2', cloud, 2],
    ['4.1.1', qa, 40], ['4.1.1', be, 15], ['4.1.1', fs, 1], ['4.1.2', qa, 40], ['4.1.2', carga, 1],
    ['4.2', qa, 30], ['4.2', an, 30], ['4.2', pm, 15],
    ['5.1.1', an, 35], ['5.1.1', capac, 1], ['5.1.2', be, 40], ['5.1.2', fe, 20], ['5.1.2', cloud, 3],
    ['5.2', pm, 30],
  ];
  const asignaciones: Asignacion[] = asig.map(([c, r, n]) => ({
    id: nuevoId(), proyectoId: pid, actividadId: A(c), recursoId: r.id,
    horasSemana: r.tipo === 'profesional' ? n : 0, cantidad: r.tipo === 'profesional' ? 0 : n,
  }));

  // ----- Hitos (fechas comprometidas = línea base)
  const hitoDefs: [string, string, string[], string, boolean][] = [
    ['H1', 'Project Charter aprobado', ['1.1.2'], 'Charter firmado por la Gerencia General', true],
    ['H2', 'Línea base de requisitos aprobada', ['2.1.3'], 'Acta firmada por las gerencias Comercial, Operaciones y Finanzas', true],
    ['H3', 'Diseño de la solución aprobado', ['2.2.1', '2.2.2'], 'Arquitectura revisada y prototipo validado por usuarios clave', true],
    ['H4', 'Módulos comercial e inventario operativos', ['3.1.3', '3.2.2'], 'Cotización < 48 h y trazabilidad del 100 % de los activos en ambiente QA', false],
    ['H5', 'Pruebas de aceptación aprobadas', ['4.2'], 'Acta UAT firmada sin defectos críticos', false],
    ['H6', 'Go-Live (paso a producción)', ['5.1.2'], 'Sistema operativo antes del congelamiento de noviembre', false],
  ];
  const responsablesHito = ['Camila Fuentes', 'Matías Soto', 'Javiera Pérez', 'Javiera Pérez', 'Valentina Muñoz', 'Camila Fuentes'];
  const hitos: Hito[] = hitoDefs.map(([codigo, nombre, acts, criterios, aceptado], i) => ({
    id: nuevoId(), proyectoId: pid, codigo, nombre, descripcion: nombre, responsable: responsablesHito[i],
    fechaComprometida: '', fechaReal: null, criterios, evidencia: aceptado ? 'Acta firmada en el repositorio del proyecto' : '', aceptado,
    actividadIds: acts.map(A),
  }));

  // ----- KPI
  const K = (codigo: string, nombre: string, categoria: KPI['categoria'], ambito: KPI['ambito'], formula: string, unidad: string, sentido: KPI['sentido'], meta: number, tolerancia: number, objetivo: string, justificacion: string, extra: Partial<KPI> = {}): KPI => ({
    id: nuevoId(), proyectoId: pid, codigo, nombre, objetivo, ambito, categoria, formula, unidad, meta, metaMax: null, sentido, tolerancia,
    periodicidad: 'Semanal', fuente: 'Cálculo automático del sistema', responsable: categoria === 'cambio' ? 'Comité de cambios' : 'Camila Fuentes',
    valorManual: null, hitoId: null, adicional: false, justificacion, ...extra,
  });
  const kpis: KPI[] = [
    K('KP01', 'Avance del proyecto', 'proyecto', 'proyecto', 'trabajo_completado / trabajo_total * 100', '%', 'mayor', 45, 10, 'Medir el progreso del trabajo total', 'Avance físico ponderado por duración (guía).'),
    K('KP02', 'Cumplimiento de hitos', 'proyecto', 'hito', 'hitos_cumplidos_plazo / hitos_vencidos_o_completados * 100', '%', 'mayor', 90, 20, 'Medir si los hitos se logran en la fecha comprometida', 'Los hitos son los puntos de control del Directorio.'),
    K('KP03', 'Desviación de costos', 'proyecto', 'proyecto', '(costo_real - costo_planificado_fecha) / costo_planificado_fecha * 100', '%', 'menor', 5, 5, 'Controlar el gasto contra lo planificado a la fecha', 'Prioridad de Finanzas: proteger el presupuesto de $225M.'),
    K('KP04', 'Actividades atrasadas', 'proyecto', 'actividad', 'actividades_atrasadas / actividades_evaluadas * 100', '%', 'menor', 10, 10, 'Detectar atrasos temprano', 'Alerta temprana antes del congelamiento de noviembre.'),
    K('KP05', 'Utilización de profesionales', 'proyecto', 'proyecto', 'horas_asignadas / horas_disponibles * 100', '%', 'rango', 25, 10, 'Uso de la capacidad del equipo', 'Bajo 25 % hay capacidad ociosa; sobre 85 % hay riesgo de sobrecarga.', { metaMax: 85 }),
    K('KP06', 'Cumplimiento de actividades', 'proyecto', 'actividad', 'actividades_terminadas_plazo / actividades_terminadas * 100', '%', 'mayor', 85, 10, 'Medir el cumplimiento de plazos de las actividades terminadas', 'Complementa el avance con la calidad del cumplimiento.'),
    K('KP07', 'Índice de desempeño del cronograma (SPI)', 'proyecto', 'proyecto', 'valor_ganado / costo_planificado_fecha', 'índice', 'mayor', 0.95, 0.1, 'Comparar trabajo ganado con trabajo planificado', 'KPI adicional del equipo: valor ganado (EVM).', { adicional: true }),
    K('KP08', 'Atraso del hito Go-Live', 'proyecto', 'hito', 'H6_atraso_dias', 'días hábiles', 'menor', 0, 5, 'Proteger la fecha de paso a producción', 'Desde noviembre no se permiten cambios de alto impacto.', { adicional: true }),
    K('KC01', 'Tasa de aprobación de cambios', 'cambio', 'cambio', 'cambios_aprobados / cambios_decididos * 100', '%', 'rango', 50, 15, 'Equilibrio entre control y flexibilidad', 'Muy baja frena el negocio; muy alta indica falta de control de alcance.', { metaMax: 85 }),
    K('KC02', 'Tiempo promedio de aprobación', 'cambio', 'cambio', 'dias_promedio_aprobacion', 'días', 'menor', 10, 5, 'Rapidez de decisión del comité', 'Los clientes cambian requerimientos durante la producción.'),
    K('KC03', 'Cambios atrasados', 'cambio', 'cambio', 'cambios_atrasados / max(cambios_abiertos, 1) * 100', '%', 'menor', 0, 25, 'Cumplimiento de fechas comprometidas', 'Alerta de cambios fuera de plazo (guía, tablero 2).'),
    K('KC04', 'Impacto de los cambios en el presupuesto', 'cambio', 'cambio', 'impacto_costo_cambios / presupuesto * 100', '%', 'menor', 5, 3, 'Controlar el efecto acumulado de los cambios', 'Hubo 41 eventos con margen menor por cambios no controlados.'),
    K('KC05', 'Impacto de los cambios en el plazo', 'cambio', 'cambio', 'impacto_plazo_cambios', 'días hábiles', 'menor', 10, 5, 'Controlar días agregados por cambios', 'Protege la fecha de Go-Live.'),
    K('KC06', 'Implementación en plazo', 'cambio', 'cambio', 'cambios_cerrados_plazo / cambios_cerrados * 100', '%', 'mayor', 80, 20, 'Cambios cerrados a tiempo', 'Mide la capacidad de ejecutar lo aprobado.'),
    K('KC07', 'Efectividad del cambio', 'cambio', 'cambio', 'cambios_exitosos / cambios_cerrados * 100', '%', 'mayor', 80, 10, 'Cambios que lograron su objetivo', 'Paso 7 del flujo: evaluación y seguimiento.'),
    K('KC08', 'Adopción del cambio', 'cambio', 'cambio', 'adopcion_promedio', '%', 'mayor', 80, 15, 'Uso real de lo implementado', 'Paso 10: adoptar el cambio en la cultura de la empresa.'),
    K('KC09', 'Cumplimiento de etapas del flujo', 'cambio', 'cambio', 'pasos_completados / pasos_esperados * 100', '%', 'mayor', 90, 15, 'Avance de los cambios aprobados según los 10 pasos', 'Muestra si los cambios avanzan al ritmo comprometido.'),
    K('KC10', 'Cambios de riesgo alto abiertos', 'cambio', 'cambio', 'cambios_riesgo_alto_abiertos', 'cambios', 'menor', 0, 1, 'Exposición a riesgos por cambios en curso', 'KPI adicional: concentra la atención del comité en lo más riesgoso.', { adicional: true }),
    K('KC11', 'Desviación de costo de los cambios', 'cambio', 'cambio', '(costo_real_cambios - impacto_costo_cambios) / impacto_costo_cambios * 100', '%', 'menor', 10, 10, 'Precisión de las estimaciones de cambios', 'KPI adicional: evalúa la calidad de la evaluación de impacto (paso 2).', { adicional: true }),
    K('KC12', 'Tiempo promedio de implementación', 'cambio', 'cambio', 'dias_promedio_implementacion', 'días', 'menor', 30, 10, 'Rapidez desde la aprobación hasta el cierre', 'KPI adicional: complementa el tiempo de aprobación.', { adicional: true }),
  ];

  // ----- Solicitudes de cambio
  const hist = (pasos: [number, Cambio['estado'], string, string][]) => pasos.map(([paso, estado, fecha, nota]) => ({ paso, estado, fecha, usuario: 'Camila Fuentes', nota }));
  const accion = (tipo: 'duracion' | 'recurso' | 'presupuesto', codigo: string | null, delta: number, recurso: Recurso | null = null) => ({
    id: nuevoId(), tipo, actividadId: codigo ? A(codigo) : null, recursoId: recurso?.id ?? null, delta, aplicada: false, aplicadaEn: null,
  });
  const base = { proyectoId: pid, fechaReal: null, resultado: '', exitoso: null, adopcion: 0, accionesCorrectivas: '', costoReal: 0 };
  const cambios: Cambio[] = [
    {
      ...base, id: nuevoId(), codigo: 'CC-01', titulo: 'Agregar vista de eventos en ejecución al panel del Directorio',
      solicitante: 'Directorio', fecha: '2026-04-06', descripcion: 'Incorporar una vista que muestre en tiempo real los eventos en ejecución y sus compromisos.',
      justificacion: 'El Directorio necesita conocer en cualquier momento la situación de los eventos en curso.',
      tipo: 'Alcance', prioridad: 'Media', urgente: false, importante: true, riesgo: 'Bajo', impacto: '+2 días en el panel del Directorio; costo menor.',
      responsable: 'Tomás Rivas', estado: 'Cerrado', paso: 10, fechaComprometida: '2026-05-29', fechaReal: '2026-05-20',
      costoEstimado: 1_200_000, costoReal: 1_150_000, resultado: 'Vista incorporada al diseño del panel y validada con el Directorio.', exitoso: true, adopcion: 90,
      accionesCorrectivas: 'Se ajustó el filtro por fecha a pedido del Directorio.',
      acciones: [accion('duracion', '3.4.2', 2)],
      historial: hist([
        [1, 'Abierto', '2026-04-06', 'Solicitud registrada'], [2, 'En evaluación', '2026-04-08', 'Impacto: 2 días y $1,2M'],
        [3, 'En evaluación', '2026-04-10', 'Riesgo bajo'], [4, 'Aprobado', '2026-04-14', 'Aprobado por la Gerencia General'],
        [5, 'Aprobado', '2026-04-16', 'Comunicado al equipo y al Directorio'], [6, 'En implementación', '2026-04-20', 'Incluido en el diseño del panel'],
        [7, 'En implementación', '2026-05-04', 'Seguimiento semanal'], [8, 'En implementación', '2026-05-08', 'Resultados comunicados'],
        [9, 'En implementación', '2026-05-12', 'Ajuste de filtros'], [10, 'Cerrado', '2026-05-20', 'Adoptado por el Directorio'],
      ]),
    },
    {
      ...base, id: nuevoId(), codigo: 'CC-02', titulo: 'Exportar listas de acreditación a la app QR externa',
      solicitante: 'Gerente de Operaciones', fecha: '2026-05-11', descripcion: 'Generar un archivo con el personal acreditado por evento para cargarlo en la app QR del proveedor externo.',
      justificacion: 'Evita digitar dos veces las acreditaciones; la app QR no se puede modificar.',
      tipo: 'Tecnología', prioridad: 'Alta', urgente: true, importante: true, riesgo: 'Medio', impacto: '+4 días en el conector y un desarrollador externo adicional.',
      responsable: 'Javiera Pérez', estado: 'En implementación', paso: 6, fechaComprometida: '2026-07-31',
      costoEstimado: 2_400_000, costoReal: 900_000, adopcion: 40,
      acciones: [accion('duracion', '3.4.1', 4), accion('recurso', '3.4.1', 1, fs)],
      historial: hist([
        [1, 'Abierto', '2026-05-11', 'Solicitud registrada'], [2, 'En evaluación', '2026-05-14', 'Factible por exportación de archivo'],
        [3, 'En evaluación', '2026-05-19', 'Riesgo medio: formato del proveedor'], [4, 'Aprobado', '2026-05-22', 'Aprobado'],
        [5, 'Aprobado', '2026-05-26', 'Comunicado a Operaciones'], [6, 'En implementación', '2026-06-08', 'En desarrollo'],
      ]),
    },
    {
      ...base, id: nuevoId(), codigo: 'CC-03', titulo: 'Pruebas de rendimiento para eventos de 800 personas',
      solicitante: 'Gerente Comercial', fecha: '2026-06-01', descripcion: 'Ampliar las pruebas de carga para eventos que crecen de 500 a 800 asistentes.',
      justificacion: 'Los clientes aumentan los asistentes durante la producción del evento.',
      tipo: 'Alcance', prioridad: 'Alta', urgente: false, importante: true, riesgo: 'Alto', impacto: '+3 días de pruebas y más horas de QA.',
      responsable: 'Valentina Muñoz', estado: 'Aprobado', paso: 4, fechaComprometida: '2026-06-10',
      costoEstimado: 1_600_000,
      acciones: [accion('duracion', '4.1.2', 3), accion('recurso', '4.1.2', 5, qa)],
      historial: hist([
        [1, 'Abierto', '2026-06-01', 'Solicitud registrada'], [2, 'En evaluación', '2026-06-04', 'Impacto evaluado'],
        [3, 'En evaluación', '2026-06-09', 'Riesgo alto: infraestructura'], [4, 'Aprobado', '2026-06-12', 'Aprobado con condiciones'],
      ]),
    },
    {
      ...base, id: nuevoId(), codigo: 'CC-04', titulo: 'Portal de autoservicio para proveedores',
      solicitante: 'Gerente Comercial', fecha: '2026-05-18', descripcion: 'Portal web para que los 140 proveedores actualicen sus tarifas.',
      justificacion: 'Reducir el trabajo de digitación del área comercial.',
      tipo: 'Alcance', prioridad: 'Media', urgente: false, importante: false, riesgo: 'Alto', impacto: '+15 días en el módulo comercial; fuera del alcance aprobado.',
      responsable: 'Camila Fuentes', estado: 'Rechazado', paso: 3, fechaComprometida: '2026-06-15', fechaReal: '2026-05-28',
      costoEstimado: 9_000_000, resultado: 'Rechazado: exclusión del alcance; se evaluará en una fase 2.',
      acciones: [accion('duracion', '3.1.3', 15)],
      historial: hist([
        [1, 'Abierto', '2026-05-18', 'Solicitud registrada'], [2, 'En evaluación', '2026-05-21', 'No factible antes de noviembre'],
        [3, 'En evaluación', '2026-05-25', 'Riesgo alto para la fecha de Go-Live'], [3, 'Rechazado', '2026-05-28', 'Rechazado por el comité'],
      ]),
    },
    {
      ...base, id: nuevoId(), codigo: 'CC-05', titulo: 'Firma digital del cliente en la bitácora de cambios en terreno',
      solicitante: 'Gerente de Finanzas', fecha: '2026-06-03', descripcion: 'El cliente firma en el teléfono del productor cada cambio solicitado durante el evento.',
      justificacion: 'Hubo 41 eventos con margen menor por cambios sin autorización registrada.',
      tipo: 'Alcance', prioridad: 'Alta', urgente: true, importante: true, riesgo: 'Medio', impacto: '+5 días en la bitácora de terreno y 20 h/semana de frontend.',
      responsable: 'Tomás Rivas', estado: 'En evaluación', paso: 3, fechaComprometida: '2026-08-28',
      costoEstimado: 3_800_000,
      acciones: [accion('duracion', '3.3.2', 5), accion('recurso', '3.3.2', 20, fe)],
      historial: hist([
        [1, 'Abierto', '2026-06-03', 'Solicitud registrada'], [2, 'En evaluación', '2026-06-05', 'Factible con librería de firma'],
        [3, 'En evaluación', '2026-06-10', 'Riesgo medio: afecta la ruta crítica'],
      ]),
    },
  ];

  let datos: Datos = { proyectos: [proyecto], actividades, dependencias, recursos, asignaciones, hitos, kpis, mediciones: [], cambios, lineasBase: [] };

  // ----- Línea base al inicio (antes de los cambios)
  // la línea base se calcula con el plan original, sin avance registrado
  const sinAvance = {
    ...datos,
    proyectos: datos.proyectos.map((p) => ({ ...p, fechaCorte: '2026-03-01' })),
    actividades: datos.actividades.map((a) => ({ ...a, avance: 0 })),
  };
  let calc = calcular(sinAvance, pid)!;
  const lb = crearLineaBase(calc, 'Línea base aprobada en el kick-off', '2026-03-16', nuevoId());
  datos = { ...datos, lineasBase: [lb] };
  datos = {
    ...datos,
    hitos: datos.hitos.map((h) => {
      const fin = h.actividadIds.map((id) => lb.actividades[id]?.fin).filter(Boolean).sort().slice(-1)[0];
      return { ...h, fechaComprometida: fin };
    }),
  };

  // ----- Aplicar los cambios aprobados al plan (trazabilidad)
  for (const c of datos.cambios) {
    if (['Aprobado', 'En implementación', 'Cerrado'].includes(c.estado)) {
      const aprob = c.historial.find((h) => h.estado === 'Aprobado')!;
      datos = aplicarAcciones(datos, c.id, aprob.fecha);
    }
  }

  // ----- Fechas y costos reales de lo ejecutado
  calc = calcular(datos, pid)!;
  const factores: Record<string, number> = { '1.1.1': 1, '1.1.2': 1.05, '1.2': 0.95, '2.1.1': 1.08, '2.1.2': 1.04, '2.1.3': 1, '2.2.1': 1.1, '2.2.2': 1.06, '3.1.1': 0.97, '3.1.2': 1.12, '3.1.3': 1.1, '3.2.1': 1.02, '3.2.2': 1.18, '3.3.1': 1.05, '3.3.2': 1 };
  const retrasoReal: Record<string, number> = { '2.2.2': 2, '3.1.2': 1, '3.2.2': 1, '3.3.1': 2 };
  datos = {
    ...datos,
    actividades: datos.actividades.map((a) => {
      const p = calc.prog.porId.get(a.id);
      if (!p || calc.prog.hijos.has(a.id) || a.avance === 0) return a;
      const cp = calc.costoPlan.get(a.id) ?? 0;
      const f = factores[a.codigo] ?? 1;
      const finReal = a.avance >= 100 ? calc.cal.fecha(calc.cal.indiceDesde(p.fin) + (retrasoReal[a.codigo] ?? 0)) : null;
      return { ...a, inicioReal: p.inicio, finReal, costoReal: Math.round((cp * a.avance * f) / 100) };
    }),
    hitos: datos.hitos.map((h) => (h.aceptado ? { ...h, fechaReal: null } : h)),
  };

  // ----- Mediciones históricas de los KPI (fin de abril, mayo y junio) a partir del valor actual
  calc = calcular(datos, pid)!;
  const mediciones: Medicion[] = [];
  const fechasHist = ['2026-03-31', '2026-04-30', '2026-05-29'];
  for (const k of datos.kpis) {
    const v = calc.kpis.get(k.id)?.valor;
    if (v === null || v === undefined) continue;
    fechasHist.forEach((fecha, i) => {
      const deriva = (3 - i) * (k.sentido === 'menor' ? -0.08 : 0.06);
      const ruido = ((k.codigo.charCodeAt(3) + i * 7) % 5) / 100;
      const valor = Math.round(v * (1 - deriva + ruido) * 100) / 100;
      mediciones.push({ id: nuevoId(), proyectoId: pid, kpiId: k.id, fecha, valor });
    });
  }
  return { ...datos, mediciones };
}
