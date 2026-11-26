/**
 * Incidencias abiertas en "Mi viaje" y "Ya continué" (contrato M1, secciones 2 y 7). PURO.
 *
 * La lista de abiertas la manda el servidor (`salida.incidenciasAbiertas`, también las de la oficina). Mientras el
 * servidor no refleje lo que el operador ya hizo en el teléfono, la app lo adelanta:
 *  - un "Ya continué" en cola: la tarjeta dice "Pendiente de enviar" y no ofrece el botón otra vez;
 *  - un "Ya continué" ya recibido (terminada o ya terminada): la tarjeta se quita;
 *  - una incidencia reportada desde la app que aún no llega a la lista: aparece de inmediato (sin botón, porque todavía
 *    no tiene el id con que se termina).
 * "Reflejado" = el envío ocurrió antes de la última lectura de la asignación (relojes del mismo teléfono).
 */
import { CODIGOS_TERMINO } from '../../core/api/operador-api';
import { IsoUtc, Salida, TipoIncidencia } from '../../core/api/operador-api.modelos';
import { ReporteLocal } from '../../core/reportes/reporte-local';
import { cuentaComoHecho } from './cola-reportes.util';
import { diaNegocio, fechaNegocio, horaNegocio, msDeIso } from './zona-negocio.util';

export interface TarjetaIncidencia {
  clave: string;
  tipo: TipoIncidencia;
  ocurrioEn: IsoUtc;
  nota: string | null;
  /** El id con que se termina; null si la incidencia aún no llega a la oficina (reportada desde este teléfono). */
  incidenciaId: string | null;
  /**
   * abierta: se puede tocar "Ya continué".
   * termino-pendiente: "Ya continué" está en la cola del teléfono.
   * incidencia-pendiente: la incidencia misma se reportó desde este teléfono y aún no está en la lista del servidor.
   */
  estado: 'abierta' | 'termino-pendiente' | 'incidencia-pendiente';
  /** Estado local del reporte de la incidencia (solo incidencia-pendiente): pendiente o enviado. */
  estadoReporte: string | null;
  /** El último "Ya continué" no fue aceptado: por qué. */
  error: string | null;
}

/**
 * ¿Ya lo refleja la asignación? Pendiente nunca; enviado solo si se envió ANTES de la última lectura (en el mismo
 * segundo no se sabe cuál fue primero: se toma como no reflejado).
 */
function reflejado(r: ReporteLocal, actualizadaEn: IsoUtc | null): boolean {
  if (r.estado === 'pendiente') return false;
  const enviado = msDeIso(r.ultimoIntentoEn);
  const leida = msDeIso(actualizadaEn);
  return enviado != null && leida != null && enviado < leida;
}

export function tarjetasIncidencias(salida: Salida | null, reportes: readonly ReporteLocal[], actualizadaEn: IsoUtc | null): TarjetaIncidencia[] {
  if (!salida) return [];
  const tarjetas: TarjetaIncidencia[] = [];

  for (const a of salida.incidenciasAbiertas ?? []) {
    const terminos = reportes
      .filter((r) => r.reporte.tipo === 'termino' && r.reporte.incidenciaId === a.id)
      .sort((x, y) => y.creadoEn.localeCompare(x.creadoEn));
    const ultimo = terminos[0];
    const base = { clave: a.id, tipo: a.tipo, ocurrioEn: a.ocurrioEn, nota: a.nota, incidenciaId: a.id, estadoReporte: null };
    if (!ultimo) {
      tarjetas.push({ ...base, estado: 'abierta', error: null });
    } else if (ultimo.estado === 'pendiente') {
      tarjetas.push({ ...base, estado: 'termino-pendiente', error: null });
    } else if (ultimo.estado === 'rechazado') {
      tarjetas.push({ ...base, estado: 'abierta', error: ultimo.error });
    } else if (reflejado(ultimo, actualizadaEn)) {
      // El servidor la sigue dando por abierta después de terminarla (p. ej. la oficina anuló el estatus que la terminó).
      tarjetas.push({ ...base, estado: 'abierta', error: null });
    }
    // Recibido y aún no reflejado: ya terminó (terminada o ya terminada), se quita.
  }

  const viajes = new Set(salida.viajes.map((v) => v.id));
  // La misma incidencia ya en la lista del servidor (mismo tipo y misma hora): no se repite.
  const delServidor = new Set((salida.incidenciasAbiertas ?? []).map((a) => `${a.tipo}|${msDeIso(a.ocurrioEn)}`));
  for (const r of reportes) {
    const rep = r.reporte;
    if (rep.tipo !== 'incidencia' || !viajes.has(rep.viajeId) || !cuentaComoHecho(r) || reflejado(r, actualizadaEn)) continue;
    if (delServidor.has(`${rep.incidencia}|${msDeIso(rep.ocurrioEn)}`)) continue;
    tarjetas.push({
      clave: rep.id,
      tipo: rep.incidencia,
      ocurrioEn: rep.ocurrioEn,
      nota: rep.nota,
      incidenciaId: null,
      estado: 'incidencia-pendiente',
      estadoReporte: r.estado,
      error: null,
    });
  }

  return tarjetas.sort((a, b) => (msDeIso(a.ocurrioEn) ?? 0) - (msDeIso(b.ocurrioEn) ?? 0) || a.clave.localeCompare(b.clave));
}

/** "desde 2:07 p. m." (hoy, en el negocio) o "desde el 24 nov, 2:07 p. m.". */
export function textoDesde(ocurrioEn: IsoUtc, ahora: Date = new Date()): string {
  const hora = horaNegocio(ocurrioEn);
  if (!hora) return '';
  if (diaNegocio(ocurrioEn) === diaNegocio(ahora.toISOString())) return `desde ${hora}`;
  return `desde el ${fechaNegocio(ocurrioEn, undefined, ahora)}, ${hora}`;
}

/** Un texto de usted para cada código de error de la sección 7. Otro código: el mensaje del servidor (ya es de usted). */
export const MENSAJE_ERROR_TERMINO: Readonly<Record<string, string>> = {
  [CODIGOS_TERMINO.invalido]: 'La oficina no reconoció qué incidencia terminó. Actualice Mi viaje e intente de nuevo.',
  [CODIGOS_TERMINO.eventoInvalido]: 'La oficina no aceptó la nota o la ubicación. Intente de nuevo con una nota más corta.',
  [CODIGOS_TERMINO.horaInvalida]:
    'La hora de término no es válida: no puede ser antes de la incidencia ni estar adelantada. Revise la hora de su teléfono.',
  [CODIGOS_TERMINO.noEncontrada]: 'Esa incidencia ya no está entre las de su salida. Actualice Mi viaje.',
  [CODIGOS_TERMINO.salidaCerrada]: 'La salida ya se cerró: la incidencia ya no se termina desde la app. La oficina puede terminarla.',
  [CODIGOS_TERMINO.claveDuplicada]: 'El aviso chocó con otro ya enviado. Toque “Ya continué” otra vez.',
};

export function mensajeErrorTermino(codigo: string | null, mensajeServidor: string | null): string {
  return (codigo && MENSAJE_ERROR_TERMINO[codigo]) || mensajeServidor || 'La oficina no aceptó el aviso de que ya continuó.';
}
