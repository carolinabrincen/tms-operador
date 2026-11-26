/**
 * Tramo actual de la hoja de ruta y estado de cada tramo. PURO.
 *
 * El tramo actual es el del viaje que "Mi viaje" presenta como el que toca: MISMA regla (`viajeActivo`), con lo que el
 * operador ya reportó. El tramo de ese viaje se busca como en el renglón de Mi viaje (`tramoDeViaje`: por folio, o por
 * orden si el tramo no trae folio).
 */
import { HojaRuta, TramoHoja } from '../../core/api/operador-api-m2.modelos';
import { Salida } from '../../core/api/operador-api.modelos';
import { tramoDeViaje } from './casetas.util';
import { ReporteParaGuia, viajeActivo } from './estatus-viaje.util';

export type EstadoTramo = 'terminado' | 'actual' | 'siguiente' | 'pendiente';

export const ETIQUETA_ESTADO_TRAMO: Readonly<Record<EstadoTramo, string>> = {
  terminado: 'Terminado',
  actual: 'Actual',
  siguiente: 'Siguiente',
  pendiente: 'Pendiente',
};

/** Tramos en el orden de la salida. */
export function tramosEnOrden(hoja: HojaRuta | null): TramoHoja[] {
  return hoja ? [...hoja.itinerario].sort((a, b) => a.orden - b.orden) : [];
}

/**
 * Posición (0, 1, 2…) del tramo actual en `tramosEnOrden`, o null si no se sabe: sin asignación, sin viaje activo
 * (todos cerrados o cancelados) o si la hoja no trae el tramo de ese viaje.
 */
export function indiceTramoActual(
  hoja: HojaRuta | null,
  salida: Salida | null,
  reportes: readonly ReporteParaGuia[],
): number | null {
  const tramo = tramoDeViaje(hoja, viajeActivo(salida, reportes));
  if (!tramo) return null;
  const i = tramosEnOrden(hoja).indexOf(tramo);
  return i >= 0 ? i : null;
}

/**
 * Estado en palabras de cada tramo según su lugar respecto al actual: antes, Terminado; el actual; el que sigue,
 * Siguiente; los demás, Pendiente. Sin tramo actual: todos Terminado si la salida ya no tiene viaje activo
 * (`todoTerminado`), si no, todos Pendiente.
 */
export function estadoTramo(
  indice: number,
  actual: number | null,
  todoTerminado = false,
): EstadoTramo {
  if (actual == null) return todoTerminado ? 'terminado' : 'pendiente';
  if (indice < actual) return 'terminado';
  if (indice === actual) return 'actual';
  return indice === actual + 1 ? 'siguiente' : 'pendiente';
}

/** "Apodaca, N.L. → Saltillo, Coah." */
export function textoRecorrido(t: TramoHoja): string {
  return `${t.origen.lugar} → ${t.destino.lugar}`;
}
