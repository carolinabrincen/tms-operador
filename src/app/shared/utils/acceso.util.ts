/** Validación del acceso del operador: celular (10 dígitos) y PIN numérico que asigna la oficina. PURO. */

export const PIN_MIN = 4;
export const PIN_MAX = 8;

/**
 * Deja solo los dígitos del celular. Acepta espacios, guiones, paréntesis y la lada de país (+52 / 52 / 521) que a
 * veces se pega desde los contactos: "+52 1 (81) 1234-5678" → "8112345678".
 */
export function normalizarCelular(texto: string | null | undefined): string {
  const digitos = (texto ?? '').replace(/\D/g, '');
  if (digitos.length === 13 && digitos.startsWith('521')) return digitos.slice(3);
  if (digitos.length === 12 && digitos.startsWith('52')) return digitos.slice(2);
  return digitos;
}

/** null si el celular es válido; si no, el mensaje que se muestra (de "usted"). */
export function mensajeCelular(texto: string | null | undefined): string | null {
  if (!(texto ?? '').trim()) return 'Escriba su número de celular.';
  if (/[^\d\s()+-]/.test(texto ?? '')) return 'El celular solo lleva números.';
  const n = normalizarCelular(texto).length;
  if (n !== 10) return `El celular debe tener 10 dígitos (lleva ${n}).`;
  return null;
}

/** null si el PIN es válido; si no, el mensaje. El PIN no se normaliza: se usa tal cual se escribió. */
export function mensajePin(pin: string | null | undefined): string | null {
  const p = pin ?? '';
  if (!p) return 'Escriba su PIN.';
  if (!/^\d+$/.test(p)) return 'El PIN solo lleva números.';
  if (p.length < PIN_MIN || p.length > PIN_MAX) return `El PIN tiene de ${PIN_MIN} a ${PIN_MAX} números.`;
  return null;
}

/** Últimos 4 dígitos del celular normalizado, para mostrar "•••• 5678" ("8112345678" → "5678"). */
export function terminacionCelular(celular: string): string {
  return normalizarCelular(celular).slice(-4);
}
