/**
 * ¿La hora del teléfono está bien? PURO.
 *
 * Los reportes llevan la hora del teléfono (contrato M1). El servidor rechaza una hora más de 10 minutos en el futuro
 * (DESPACHO_EVENTO_HORA_INVALIDA). La app compara la hora del teléfono con `recibidoEn` de cada acuse (hora del
 * servidor) y avisa desde los 5 minutos de diferencia, antes de que empiecen los rechazos.
 */
import { msDeIso } from './zona-negocio.util';

export const LIMITE_SERVIDOR_MS = 10 * 60_000;
export const UMBRAL_AVISO_RELOJ_MS = 5 * 60_000;

/** Diferencia teléfono − servidor en ms (positivo = el teléfono va adelantado). null si la hora del servidor no sirve. */
export function desfaseMs(horaTelefono: Date, horaServidorIso: string | null | undefined): number | null {
  const servidor = msDeIso(horaServidorIso);
  return servidor == null ? null : horaTelefono.getTime() - servidor;
}

/** Mensaje para el operador, o null si la hora está bien. `rechazada` = el servidor ya rechazó un reporte por la hora. */
export function mensajeReloj(desfase: number | null, rechazada = false): string | null {
  const corrija = 'Corríjala en los ajustes del teléfono (fecha y hora automáticas).';
  if (desfase != null && Math.abs(desfase) >= UMBRAL_AVISO_RELOJ_MS) {
    const minutos = Math.round(Math.abs(desfase) / 60_000);
    if (desfase > 0) {
      return `La hora de su teléfono está adelantada unos ${minutos} minutos. ${corrija} Si pasa de 10 minutos, la oficina no acepta sus reportes.`;
    }
    return `La hora de su teléfono está atrasada unos ${minutos} minutos. ${corrija} Sus reportes quedarían con la hora equivocada.`;
  }
  if (rechazada) return `La oficina no aceptó un reporte porque la hora de su teléfono está adelantada. ${corrija}`;
  return null;
}
