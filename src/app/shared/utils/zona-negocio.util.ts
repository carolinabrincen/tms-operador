/**
 * Fechas y horas en la ZONA DEL NEGOCIO (America/Mexico_City), no en la del teléfono. Un operador puede traer el
 * celular con otra zona (o con la hora mal puesta); lo que ve en pantalla siempre es la hora del negocio.
 * Las fechas viajan como ISO 8601 UTC. PURO (solo Intl). Misma idea que shared/utils/zona-negocio.util.ts del
 * frontend de oficina.
 */

export const ZONA_NEGOCIO = 'America/Mexico_City';
export const TEXTO_ZONA_NEGOCIO = 'hora del centro de México';

const dos = (n: number) => String(n).padStart(2, '0');

interface Partes {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

const formateadores = new Map<string, Intl.DateTimeFormat>();

function formateador(zona: string): Intl.DateTimeFormat {
  let f = formateadores.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formateadores.set(zona, f);
  }
  return f;
}

function partesEnZona(ms: number, zona: string): Partes {
  const p: Record<string, string> = {};
  for (const x of formateador(zona).formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p['year'], m: +p['month'], d: +p['day'], h: +p['hour'] % 24, mi: +p['minute'], s: +p['second'] };
}

/** ISO → milisegundos. Sin zona en el texto = UTC (así guarda el servidor). Vacío o inválido = null. */
export function msDeIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const conZona = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const ms = Date.parse(conZona);
  return Number.isFinite(ms) ? ms : null;
}

function partes(iso: string | null | undefined, zona: string): Partes | null {
  const ms = msDeIso(iso);
  return ms == null ? null : partesEnZona(ms, zona);
}

/** ISO UTC → "23/11/2026" (día del negocio); '' si no hay o es inválido. */
export function fechaNegocio(iso: string | null | undefined, zona = ZONA_NEGOCIO): string {
  const p = partes(iso, zona);
  return p ? `${dos(p.d)}/${dos(p.m)}/${p.y}` : '';
}

/** ISO UTC → "14:05" (hora del negocio, 24 h); '' si no hay o es inválido. */
export function horaNegocio(iso: string | null | undefined, zona = ZONA_NEGOCIO): string {
  const p = partes(iso, zona);
  return p ? `${dos(p.h)}:${dos(p.mi)}` : '';
}

/** ISO UTC → "23/11/2026 14:05" con la hora del negocio; '' si no hay o es inválido. */
export function fechaHoraNegocio(iso: string | null | undefined, zona = ZONA_NEGOCIO): string {
  const p = partes(iso, zona);
  return p ? `${dos(p.d)}/${dos(p.m)}/${p.y} ${dos(p.h)}:${dos(p.mi)}` : '';
}

/** ISO UTC → "2026-11-23" (clave del día del negocio, para agrupar o comparar); '' si no hay o es inválido. */
export function diaNegocio(iso: string | null | undefined, zona = ZONA_NEGOCIO): string {
  const p = partes(iso, zona);
  return p ? `${p.y}-${dos(p.m)}-${dos(p.d)}` : '';
}

/**
 * Texto corto para una cita o un reporte: "Hoy 14:05", "Mañana 07:00", "Ayer 22:10" o "25/11/2026 09:30", comparando
 * días del negocio (no del teléfono). '' si no hay o es inválido.
 */
export function cuandoNegocio(iso: string | null | undefined, ahora: Date = new Date(), zona = ZONA_NEGOCIO): string {
  const dia = diaNegocio(iso, zona);
  if (!dia) return '';
  const hoyMs = ahora.getTime();
  const unDia = 24 * 60 * 60 * 1000;
  const hora = horaNegocio(iso, zona);
  const hoy = diaNegocio(new Date(hoyMs).toISOString(), zona);
  if (dia === hoy) return `Hoy ${hora}`;
  // Mediodía UTC del día del negocio ± 1 día: evita errores en el borde de la medianoche.
  const [y, m, d] = hoy.split('-').map(Number);
  const mediodia = Date.UTC(y, m - 1, d, 12);
  if (dia === diaNegocio(new Date(mediodia + unDia).toISOString(), 'UTC')) return `Mañana ${hora}`;
  if (dia === diaNegocio(new Date(mediodia - unDia).toISOString(), 'UTC')) return `Ayer ${hora}`;
  return fechaHoraNegocio(iso, zona);
}

/** Ahora como ISO UTC sin milisegundos ("2026-11-23T20:05:37Z"): así se registra la hora de un reporte. */
export function ahoraIsoUtc(ahora: Date = new Date()): string {
  return ahora.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
