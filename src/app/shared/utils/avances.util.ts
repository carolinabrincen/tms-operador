/**
 * Avances que reporta el operador y "qué le toca". PURO.
 *
 * Un reporte NO cambia el estado del viaje (eso lo confirma la oficina). Lo que aquí se calcula es solo una guía para
 * la pantalla: el tramo que toca es el primero, en orden, del que el operador todavía no reporta "Terminé".
 */
import { Despacho, MovimientoVacio, ObjetivoReporte, TipoAvance, Tramo } from '../../core/api/operador-api.modelos';

export const AVANCES_VIAJE: readonly TipoAvance[] = ['sali', 'llegue-cargar', 'cargado', 'llegue-descargar', 'entregado', 'termine'];
export const AVANCES_VACIO: readonly TipoAvance[] = ['sali', 'llegue', 'termine'];

export const ETIQUETA_AVANCE: Readonly<Record<TipoAvance, string>> = {
  sali: 'Salí',
  'llegue-cargar': 'Llegué a cargar',
  cargado: 'Cargado',
  'llegue-descargar': 'Llegué a descargar',
  entregado: 'Entregado',
  llegue: 'Llegué',
  termine: 'Terminé',
};

/** Lo mínimo de un reporte que se necesita para calcular avances (sirve para ReporteLocal). */
export interface ReporteParaAvance {
  reporte: { objetivo: ObjetivoReporte; avance: TipoAvance; ocurrioEn: string };
  /** Los rechazados no cuentan como hechos. */
  estado: string;
}

/** Tramo cargado (viaje): los 6 avances. Tramo vacío o movimiento en vacío: Salí, Llegué, Terminé. */
export function avancesDeTramo(tramo: Tramo): readonly TipoAvance[] {
  return tramo.tipo === 'cargado' ? AVANCES_VIAJE : AVANCES_VACIO;
}

/** Llave estable del objetivo, para agrupar reportes: "tramo:<id>" o "movimiento:<id>". */
export function claveObjetivo(objetivo: ObjetivoReporte): string {
  return objetivo.tipo === 'tramo' ? `tramo:${objetivo.tramoId}` : `movimiento:${objetivo.movimientoId}`;
}

export function objetivoDeTramo(despacho: Despacho, tramo: Tramo): ObjetivoReporte {
  return { tipo: 'tramo', despachoId: despacho.id, tramoId: tramo.id, viajeId: tramo.tipo === 'cargado' ? tramo.viaje.id : null };
}

export function objetivoDeMovimiento(movimiento: MovimientoVacio): ObjetivoReporte {
  return { tipo: 'movimiento', movimientoId: movimiento.id };
}

/** Reportes válidos (no rechazados) de un objetivo, del más antiguo al más reciente. */
export function reportesDelObjetivo<T extends ReporteParaAvance>(reportes: readonly T[], objetivo: ObjetivoReporte): T[] {
  const clave = claveObjetivo(objetivo);
  return reportes
    .filter((r) => r.estado !== 'rechazado' && claveObjetivo(r.reporte.objetivo) === clave)
    .sort((a, b) => a.reporte.ocurrioEn.localeCompare(b.reporte.ocurrioEn));
}

export function estaTerminado(reportes: readonly ReporteParaAvance[]): boolean {
  return reportes.some((r) => r.reporte.avance === 'termine');
}

/**
 * Siguiente avance sugerido: el que sigue al más avanzado ya reportado. null si ya reportó "Terminé".
 * Si reportó fuera de orden (p. ej. "Cargado" sin "Llegué a cargar"), sigue al más avanzado.
 */
export function siguienteAvance(secuencia: readonly TipoAvance[], reportes: readonly ReporteParaAvance[]): TipoAvance | null {
  if (estaTerminado(reportes)) return null;
  let mayor = -1;
  for (const r of reportes) mayor = Math.max(mayor, secuencia.indexOf(r.reporte.avance));
  return secuencia[mayor + 1] ?? null;
}

/** Último reporte de ese avance (para mostrar "✓ Hoy 14:05"). */
export function ultimoDeAvance<T extends ReporteParaAvance>(reportes: readonly T[], avance: TipoAvance): T | null {
  let ultimo: T | null = null;
  for (const r of reportes) if (r.reporte.avance === avance) ultimo = r;
  return ultimo;
}

/** Tramo que toca: el primero, en orden, sin "Terminé" reportado. null si todos están terminados o no hay tramos. */
export function tramoQueToca(despacho: Despacho, reportes: readonly ReporteParaAvance[]): Tramo | null {
  const ordenados = [...despacho.tramos].sort((a, b) => a.orden - b.orden);
  return ordenados.find((t) => !estaTerminado(reportesDelObjetivo(reportes, objetivoDeTramo(despacho, t)))) ?? null;
}

export function origenDestino(tramo: Tramo): { origen: string; destino: string } {
  return tramo.tipo === 'cargado' ? { origen: tramo.viaje.origen, destino: tramo.viaje.destino } : { origen: tramo.origen, destino: tramo.destino };
}

/** "Tramo 2 · Cargado · Monterrey → Saltillo". */
export function tituloTramo(tramo: Tramo): string {
  const { origen, destino } = origenDestino(tramo);
  return `Tramo ${tramo.orden} · ${tramo.tipo === 'cargado' ? 'Cargado' : 'Vacío'} · ${origen} → ${destino}`;
}

/** "Movimiento en vacío · Carga de combustible · Patio → Gasolinera". */
export function tituloMovimiento(m: MovimientoVacio): string {
  return `Movimiento en vacío · ${m.motivo} · ${m.origen} → ${m.destino}`;
}
