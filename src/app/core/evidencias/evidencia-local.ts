import { DatosEvidencia } from '../api/operador-api-m2.modelos';
import { IsoUtc } from '../api/operador-api.modelos';

/**
 * Estado de una foto EN EL TELÉFONO:
 *  - pendiente: guardada en el teléfono, falta subirla (sin señal o el servidor no respondió).
 *  - enviada: el servidor dio su acuse (201 o 200).
 *  - recibida: el servidor confirma que la tiene vigente (evidencias/estado).
 *  - anulada: la oficina la anuló (con su motivo en `mensaje`). La app no anula.
 *  - rechazada: el servidor no la aceptó (400, 404, 409). No se reintenta: "No aceptada".
 */
export type EstadoEvidenciaLocal = 'pendiente' | 'enviada' | 'recibida' | 'anulada' | 'rechazada';

/** Registro de la cola de fotos (IndexedDB). Solo `datos` y la foto viajan al servidor; lo demás es del teléfono. */
export interface EvidenciaLocal {
  /** = datos.id (llave en IndexedDB). */
  id: string;
  /** Dueño: en un teléfono compartido solo se ven y se envían las del operador con sesión. */
  operadorId: string;
  datos: DatosEvidencia;
  /** Texto para mostrar sin tener el viaje a la mano ("Viaje 2 · Cargado · Apodaca → Saltillo"). */
  resumen: string;
  /**
   * La foto ya reducida (JPEG). Se guarda como bytes (no Blob) porque así IndexedDB la conserva igual en todos los
   * navegadores. Se borra cuando ya no hace falta reenviarla (recibida o anulada) para no llenar el teléfono.
   */
  foto: ArrayBuffer | null;
  tipoContenido: string;
  tamanoBytes: number;
  estado: EstadoEvidenciaLocal;
  /** Último mensaje del servidor: acuse ("Recibida: …") o motivo de anulación. Se muestra tal cual. */
  mensaje: string | null;
  creadoEn: IsoUtc;
  intentos: number;
  ultimoIntentoEn: IsoUtc | null;
  enviadaEn: IsoUtc | null;
  /** Último error al subir (para mostrar). null si no hubo. */
  error: string | null;
}
