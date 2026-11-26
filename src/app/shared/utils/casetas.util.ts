/**
 * Próxima caseta de un tramo de la hoja de ruta (contrato M2, sección 1). PURO.
 * Las casetas vienen por nombre y en el orden en que se cruzan; NUNCA con importe. El operador marca "Ya la pasé" y la
 * app muestra la siguiente; lo que lleva pasado se recuerda en el teléfono (CasetasService).
 */
import { HojaRuta, PlazaCobroHoja, TramoHoja } from '../../core/api/operador-api-m2.modelos';
import { Viaje } from '../../core/api/operador-api.modelos';

export interface EstadoCasetas {
  total: number;
  /** Cuántas lleva pasadas (0..total). */
  pasadas: number;
  /** La que sigue; null = ya no quedan ("Sin casetas pendientes"). */
  proxima: PlazaCobroHoja | null;
  /** Número de la próxima (1..total); igual a `total` si ya no quedan. */
  n: number;
  /** Todas, en el orden en que se cruzan. */
  lista: PlazaCobroHoja[];
}

/** null si el tramo no tiene casetas (no se muestra nada de casetas). */
export function estadoCasetas(plazas: readonly PlazaCobroHoja[] | null | undefined, pasadas: number): EstadoCasetas | null {
  const lista = [...(plazas ?? [])].sort((a, b) => a.orden - b.orden);
  if (!lista.length) return null;
  const p = Math.max(0, Math.min(Math.trunc(pasadas) || 0, lista.length));
  return { total: lista.length, pasadas: p, proxima: lista[p] ?? null, n: Math.min(p + 1, lista.length), lista };
}

/** El tramo de la hoja que corresponde a un viaje: por folio (cargados) o, si no trae folio, por orden. */
export function tramoDeViaje(hoja: HojaRuta | null, v: Viaje | null): TramoHoja | null {
  if (!hoja || !v) return null;
  return hoja.itinerario.find((t) => t.folio && t.folio === v.folio) ?? hoja.itinerario.find((t) => !t.folio && t.orden === v.orden) ?? null;
}

/** "Hoja de ruta · próxima caseta: Fortín", "Hoja de ruta · sin casetas pendientes" o solo "Hoja de ruta". */
export function textoRenglonHoja(e: EstadoCasetas | null): string {
  if (!e) return 'Hoja de ruta';
  return e.proxima ? `Hoja de ruta · próxima caseta: ${e.proxima.nombre}` : 'Hoja de ruta · sin casetas pendientes';
}
