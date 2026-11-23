/**
 * Contraste entre dos colores según WCAG 2.x. PURO.
 * 4.5:1 es el mínimo AA para texto normal; aquí se pide 7:1 (AAA) para leer a pleno sol.
 */

export const CONTRASTE_MINIMO_SOL = 7;

function canal(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa de "#RRGGBB". */
export function luminancia(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`Color inválido: ${hex}`);
  const [r, g, b] = m.slice(1).map((x) => canal(parseInt(x, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste (1 a 21). */
export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}
