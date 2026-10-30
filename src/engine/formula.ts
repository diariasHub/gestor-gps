// Evaluador seguro de fórmulas para KPI configurables.
// Soporta números, variables, + - * / ^, paréntesis y funciones min, max, abs, redondear, si.
// No usa eval(): la fórmula se analiza con un parser descendente recursivo.

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenizar(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: 'num', v: parseFloat(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_áéíóúñÁÉÍÓÚÑ]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_áéíóúñÁÉÍÓÚÑ]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/^(),<>='.includes(c)) {
      // operadores de comparación de dos caracteres
      const dos = src.slice(i, i + 2);
      if (['<=', '>=', '=='].includes(dos)) { out.push({ t: 'op', v: dos }); i += 2; continue; }
      out.push({ t: 'op', v: c });
      i++;
      continue;
    }
    throw new Error(`Carácter no válido: "${c}"`);
  }
  return out;
}

export class ErrorFormula extends Error {}

export function evaluarFormula(formula: string, vars: Record<string, number | null>): number | null {
  const toks = tokenizar(formula);
  let p = 0;
  let nulo = false;
  const ver = () => toks[p];
  const comer = (v?: string) => {
    const t = toks[p];
    if (!t || (v && t.v !== v)) throw new ErrorFormula(`Se esperaba "${v ?? 'expresión'}"`);
    p++;
    return t;
  };

  const funciones: Record<string, (args: number[]) => number> = {
    min: (a) => Math.min(...a),
    max: (a) => Math.max(...a),
    abs: (a) => Math.abs(a[0]),
    redondear: (a) => Math.round(a[0] * 10 ** (a[1] ?? 0)) / 10 ** (a[1] ?? 0),
    si: (a) => (a[0] ? a[1] : a[2] ?? 0),
  };

  function comparacion(): number {
    let v = suma();
    const t = ver();
    if (t && t.t === 'op' && ['<', '>', '<=', '>=', '=='].includes(t.v as string)) {
      p++;
      const w = suma();
      switch (t.v) {
        case '<': v = v < w ? 1 : 0; break;
        case '>': v = v > w ? 1 : 0; break;
        case '<=': v = v <= w ? 1 : 0; break;
        case '>=': v = v >= w ? 1 : 0; break;
        case '==': v = v === w ? 1 : 0; break;
      }
    }
    return v;
  }
  function suma(): number {
    let v = producto();
    while (ver() && ver().t === 'op' && (ver().v === '+' || ver().v === '-')) {
      const op = comer().v;
      const w = producto();
      v = op === '+' ? v + w : v - w;
    }
    return v;
  }
  function producto(): number {
    let v = potencia();
    while (ver() && ver().t === 'op' && (ver().v === '*' || ver().v === '/')) {
      const op = comer().v;
      const w = potencia();
      if (op === '/') {
        if (w === 0) { nulo = true; v = 0; } else v = v / w;
      } else v = v * w;
    }
    return v;
  }
  function potencia(): number {
    const b = unario();
    if (ver() && ver().v === '^') { comer(); return b ** potencia(); }
    return b;
  }
  function unario(): number {
    if (ver() && ver().v === '-') { comer(); return -unario(); }
    if (ver() && ver().v === '+') { comer(); return unario(); }
    return primario();
  }
  function primario(): number {
    const t = ver();
    if (!t) throw new ErrorFormula('Fórmula incompleta');
    if (t.t === 'num') { p++; return t.v; }
    if (t.v === '(') { comer('('); const v = comparacion(); comer(')'); return v; }
    if (t.t === 'id') {
      p++;
      const nombre = t.v as string;
      if (ver() && ver().v === '(') {
        const f = funciones[nombre.toLowerCase()];
        if (!f) throw new ErrorFormula(`Función desconocida: ${nombre}`);
        comer('(');
        const args: number[] = [];
        if (ver() && ver().v !== ')') {
          args.push(comparacion());
          while (ver() && ver().v === ',') { comer(','); args.push(comparacion()); }
        }
        comer(')');
        return f(args);
      }
      if (!(nombre in vars)) throw new ErrorFormula(`Variable desconocida: ${nombre}`);
      const v = vars[nombre];
      if (v === null || v === undefined || Number.isNaN(v)) { nulo = true; return 0; }
      return v;
    }
    throw new ErrorFormula(`Símbolo inesperado: ${t.v}`);
  }

  const resultado = comparacion();
  if (p < toks.length) throw new ErrorFormula(`Símbolo inesperado: ${toks[p].v}`);
  if (nulo || !Number.isFinite(resultado)) return null;
  return resultado;
}

/** Valida una fórmula sin datos reales; devuelve el mensaje de error o null si es válida. */
export function validarFormula(formula: string, nombresVariables: string[]): string | null {
  try {
    const vars: Record<string, number> = {};
    for (const n of nombresVariables) vars[n] = 1;
    evaluarFormula(formula, vars);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
