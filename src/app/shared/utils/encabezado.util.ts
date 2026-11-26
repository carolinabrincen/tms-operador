/** Barra superior de Mi viaje: nombre corto y estado real de la cola. PURO. */

/** Partículas que no cuentan como nombre ni apellido ("de", "del", "la"…). */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'van', 'von']);

/**
 * "Luis Alberto Santos García" → "Luis Santos"; "Luis Santos García" → "Luis Santos"; "Luis Santos" igual.
 * Primer nombre y primer apellido (con 4 partes o más se supone que las dos primeras son nombres). Las partículas se
 * quedan con la palabra que sigue: "Luis Alberto de la Fuente García" → "Luis de la Fuente".
 */
export function nombreCorto(nombre: string | null | undefined): string {
  const partes: string[] = [];
  let pendiente = '';
  for (const p of (nombre ?? '').trim().split(/\s+/).filter(Boolean)) {
    if (PARTICULAS.has(p.toLowerCase())) {
      pendiente += `${p} `;
    } else {
      partes.push(pendiente + p);
      pendiente = '';
    }
  }
  if (pendiente && partes.length) partes[partes.length - 1] += ` ${pendiente.trim()}`;
  if (partes.length <= 2) return partes.join(' ');
  return `${partes[0]} ${partes.length >= 4 ? partes[2] : partes[1]}`;
}

export type ClaseSenal = 'con-senal' | 'enviando' | 'sin-senal';

export interface EstadoSenal {
  clase: ClaseSenal;
  texto: string;
}

/**
 * Lo que dice la barra: "Con señal · todo enviado", "Enviando…", "Con señal · 2 por enviar" (esperando reintento o el
 * lapso para deshacer), "Sin señal · 2 por enviar" o "Sin señal · todo enviado". Cuenta reportes y fotos.
 */
export function estadoSenal(enLinea: boolean, porEnviar: number, enviando: boolean): EstadoSenal {
  const resto = porEnviar > 0 ? `${porEnviar} por enviar` : 'todo enviado';
  if (!enLinea) return { clase: 'sin-senal', texto: `Sin señal · ${resto}` };
  if (enviando && porEnviar > 0) return { clase: 'enviando', texto: 'Enviando…' };
  return { clase: 'con-senal', texto: `Con señal · ${resto}` };
}
