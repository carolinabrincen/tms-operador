/**
 * Tamaño del estatus en el bloque del paso actual. PURO.
 * 40 px si cabe en un renglón; si no, baja por pasos (36, 32) hasta 28 px; solo si ni así cabe, dos renglones a 28 px.
 * Los tamaños van en rem (16 px = 1rem) para respetar la letra grande del sistema.
 */

/** Pasos en rem: 40, 36, 32 y 28 px con la letra normal de 16 px. */
export const PASOS_ESTATUS_REM = [2.5, 2.25, 2, 1.75] as const;

/** Ancho aproximado de un carácter de Manrope 700 en "em" (si no se puede medir con la letra real). */
export const ANCHO_CARACTER_EM = 0.6;

/** Mide el ancho en px de `texto` a `tamanoPx`; null si no se puede medir (sin canvas). */
export type MedirTexto = (texto: string, tamanoPx: number) => number | null;

export interface TamanoEstatus {
  rem: number;
  /** true = ni a 28 px cabe en un renglón: se permiten dos. */
  dosRenglones: boolean;
}

/** Ancho estimado por longitud (con el ajuste de letra de -0.02em del estatus). */
export function anchoEstimado(texto: string, tamanoPx: number): number {
  return texto.length * (ANCHO_CARACTER_EM - 0.02) * tamanoPx;
}

/**
 * El tamaño más grande que cabe en `anchoDisponiblePx`. Sin ancho conocido (aún no se dibuja), 40 px.
 * `raizPx`: tamaño de 1rem en el teléfono (16 normalmente; más con la letra grande del sistema).
 */
export function tamanoEstatus(texto: string, anchoDisponiblePx: number | null, raizPx = 16, medir?: MedirTexto): TamanoEstatus {
  if (!anchoDisponiblePx || anchoDisponiblePx <= 0) return { rem: PASOS_ESTATUS_REM[0], dosRenglones: false };
  for (const rem of PASOS_ESTATUS_REM) {
    const px = rem * raizPx;
    const ancho = medir?.(texto, px) ?? anchoEstimado(texto, px);
    if (ancho <= anchoDisponiblePx) return { rem, dosRenglones: false };
  }
  return { rem: PASOS_ESTATUS_REM[PASOS_ESTATUS_REM.length - 1], dosRenglones: true };
}
