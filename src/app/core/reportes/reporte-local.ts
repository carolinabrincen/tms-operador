import { IsoUtc, ReporteOperador, ResultadoReporte } from '../api/operador-api.modelos';

/**
 * Estado de un reporte EN EL TELÉFONO:
 *  - pendiente: guardado en el teléfono, falta enviarlo (sin señal o el servidor no respondió).
 *  - enviado: el servidor lo recibió (estatus aplicado, incidencia registrada, o recibido sin efecto).
 *  - por-confirmar: espera a la oficina (hito, o intermedio que saltaría un hito).
 *  - confirmado: la oficina capturó ese hito.
 *  - descartado: la oficina descartó el reporte (con su motivo en `mensaje`).
 *  - rechazado: el servidor no lo aceptó (400, 404, 409). No se reintenta: "No aceptado".
 */
export type EstadoReporteLocal = 'pendiente' | 'enviado' | 'por-confirmar' | 'confirmado' | 'descartado' | 'rechazado';

/** Registro de la cola (IndexedDB). Solo `reporte` viaja al servidor; lo demás es del teléfono. */
export interface ReporteLocal {
  /** = reporte.id (llave en IndexedDB). */
  id: string;
  /** Dueño del reporte: en un teléfono compartido solo se ven y se envían los del operador con sesión. */
  operadorId: string;
  reporte: ReporteOperador;
  /** Texto para mostrar sin necesidad de tener el viaje a la mano ("Viaje 2 · Apodaca → Saltillo"). */
  resumen: string;
  estado: EstadoReporteLocal;
  /** Último resultado que dio el servidor (null mientras no se envía o si fue rechazado). */
  resultado: ResultadoReporte | null;
  /** Último `mensaje` del servidor (acuse o estado): se muestra tal cual. */
  mensaje: string | null;
  creadoEn: IsoUtc;
  intentos: number;
  ultimoIntentoEn: IsoUtc | null;
  enviadoEn: IsoUtc | null;
  confirmadoEn: IsoUtc | null;
  /** Último error al enviar (para mostrar). null si no hubo. */
  error: string | null;
}
