// Calendario laboral: lunes a viernes, excluyendo feriados del proyecto.
// Las actividades se calculan en "índices de día hábil" desde el inicio del proyecto.

const DIA = 86400000;

export function parseISO(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function toISO(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

export function addDiasCalendario(s: string, n: number): string {
  return toISO(parseISO(s) + n * DIA);
}

export function diasCalendario(a: string, b: string): number {
  return Math.round((parseISO(b) - parseISO(a)) / DIA);
}

export function esFinDeSemana(t: number): boolean {
  const d = new Date(t).getUTCDay();
  return d === 0 || d === 6;
}

export class Calendario {
  private dias: string[] = []; // índice -> fecha hábil
  private indice = new Map<string, number>(); // fecha hábil -> índice
  private feriados: Set<string>;
  readonly inicio: string;

  constructor(inicio: string, feriados: string[], capacidad = 1500) {
    this.feriados = new Set(feriados);
    // el índice 0 es el primer día hábil desde la fecha de inicio
    let t = parseISO(inicio);
    while (this.dias.length < capacidad) {
      if (this.esHabil(t)) {
        const iso = toISO(t);
        this.indice.set(iso, this.dias.length);
        this.dias.push(iso);
      }
      t += DIA;
    }
    this.inicio = this.dias[0];
  }

  esHabil(t: number): boolean {
    return !esFinDeSemana(t) && !this.feriados.has(toISO(t));
  }

  esFeriado(iso: string): boolean {
    return this.feriados.has(iso);
  }

  /** Fecha del día hábil número i (puede ser negativo: se calcula hacia atrás). */
  fecha(i: number): string {
    if (i >= 0 && i < this.dias.length) return this.dias[i];
    if (i < 0) {
      let t = parseISO(this.dias[0]);
      let k = 0;
      while (k > i) {
        t -= DIA;
        if (this.esHabil(t)) k--;
      }
      return toISO(t);
    }
    return this.dias[this.dias.length - 1];
  }

  /** Índice del primer día hábil igual o posterior a la fecha dada. */
  indiceDesde(iso: string): number {
    const exacto = this.indice.get(iso);
    if (exacto !== undefined) return exacto;
    let t = parseISO(iso);
    if (t < parseISO(this.dias[0])) {
      // antes del inicio: contamos hacia atrás
      let k = 0;
      let u = parseISO(this.dias[0]);
      while (u > t) {
        u -= DIA;
        if (this.esHabil(u)) k--;
      }
      return k;
    }
    for (let n = 0; n < 15; n++) {
      t += DIA;
      const j = this.indice.get(toISO(t));
      if (j !== undefined) return j;
    }
    return this.dias.length - 1;
  }

  /** Índice del último día hábil igual o anterior a la fecha dada. */
  indiceHasta(iso: string): number {
    const exacto = this.indice.get(iso);
    if (exacto !== undefined) return exacto;
    let t = parseISO(iso);
    for (let n = 0; n < 15; n++) {
      t -= DIA;
      const j = this.indice.get(toISO(t));
      if (j !== undefined) return j;
    }
    return this.indiceDesde(iso) - 1;
  }

  /** Días hábiles entre dos fechas, ambas inclusive. */
  habilesEntre(a: string, b: string): number {
    return this.indiceHasta(b) - this.indiceDesde(a) + 1;
  }
}
