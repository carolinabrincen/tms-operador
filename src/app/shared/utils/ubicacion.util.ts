/** Ubicación del reporte. PURO. Nunca bloquea un reporte: sin permiso o sin señal, se envía sin punto. */
import { PuntoGps } from '../../core/api/operador-api.modelos';
import { ahoraIsoUtc } from './zona-negocio.util';

export const EXPLICACION_UBICACION =
  'Su ubicación se registra solo al reportar un avance y mientras tenga un viaje activo.';

/** Espera máxima por el GPS antes de guardar el reporte sin punto. */
export const ESPERA_GPS_MS = 6000;
/** Se acepta una posición tomada hace poco (ahorra batería y tiempo de espera). */
export const ANTIGUEDAD_MAXIMA_GPS_MS = 60_000;

export type EstadoPermisoUbicacion = 'concedido' | 'negado' | 'preguntar' | 'desconocido' | 'no-disponible';

export function estadoPermisoDe(state: string | null | undefined): EstadoPermisoUbicacion {
  switch (state) {
    case 'granted':
      return 'concedido';
    case 'denied':
      return 'negado';
    case 'prompt':
      return 'preguntar';
    default:
      return 'desconocido';
  }
}

/**
 * ¿Hay que explicar antes de pedir el permiso? Sí cuando el navegador va a preguntar; si no se sabe (iPhone sin
 * Permissions API), solo la primera vez.
 */
export function debeExplicar(estado: EstadoPermisoUbicacion, yaExplicado: boolean): boolean {
  if (estado === 'preguntar') return true;
  if (estado === 'desconocido') return !yaExplicado;
  return false;
}

/** Texto que acompaña la confirmación del reporte, según el permiso. */
export function textoUbicacionEnReporte(estado: EstadoPermisoUbicacion): string {
  switch (estado) {
    case 'concedido':
      return 'Se registrará su ubicación con este reporte.';
    case 'negado':
      return 'No dio permiso de ubicación: el reporte se envía sin ubicación.';
    case 'no-disponible':
      return 'Este teléfono no da la ubicación: el reporte se envía sin ubicación.';
    default:
      return 'Se pedirá su ubicación. Si no la da, el reporte se envía igual.';
  }
}

interface PosicionMinima {
  coords: { latitude: number; longitude: number; accuracy?: number | null };
  timestamp?: number;
}

/** Posición del navegador → PuntoGps (lat/lng a 6 decimales ≈ 10 cm; precisión en metros enteros). Inválida = null. */
export function puntoDePosicion(pos: PosicionMinima | null | undefined, ahora: Date = new Date()): PuntoGps | null {
  const lat = pos?.coords?.latitude;
  const lng = pos?.coords?.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const precision = pos!.coords.accuracy;
  const redondear = (n: number) => Math.round(n * 1e6) / 1e6;
  return {
    lat: redondear(lat),
    lng: redondear(lng),
    precisionM: typeof precision === 'number' && Number.isFinite(precision) ? Math.round(precision) : null,
    tomadoEn: ahoraIsoUtc(pos!.timestamp ? new Date(pos!.timestamp) : ahora),
  };
}
