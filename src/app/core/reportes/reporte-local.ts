import { IsoUtc, ReporteOperador } from '../api/operador-api.modelos';

/**
 * Estado de un reporte EN EL TELÉFONO:
 *  - pendiente: guardado en el teléfono, falta enviarlo (sin señal o el servidor no respondió).
 *  - enviado: el servidor lo recibió (estatus intermedio ya aplicado, o incidencia registrada).
 *  - por-confirmar: hito (Documentado, Descargado) recibido; espera a que la oficina lo confirme.
 *  - confirmado: la oficina confirmó el hito.
 *  - rechazado: el servidor no lo aceptó (no se reintenta; el operador debe avisar a la oficina).
 */
export type EstadoReporteLocal = 'pendiente' | 'enviado' | 'por-confirmar' | 'confirmado' | 'rechazado';

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
  creadoEn: IsoUtc;
  intentos: number;
  ultimoIntentoEn: IsoUtc | null;
  enviadoEn: IsoUtc | null;
  confirmadoEn: IsoUtc | null;
  /** Último error al enviar (para mostrar). null si no hubo. */
  error: string | null;
  /** Recibido pero sin efecto (el viaje ya iba igual o más adelante): explicación para el operador. */
  aviso: string | null;
}
