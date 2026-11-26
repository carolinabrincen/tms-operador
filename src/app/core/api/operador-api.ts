import { InjectionToken } from '@angular/core';
import { AcuseEvidencia, DatosEvidencia, EstadoRemotoEvidencia, EvidenciaViaje, HojaRuta } from './operador-api-m2.modelos';
import {
  AcuseReporte,
  AcuseTerminoIncidencia,
  AsignacionOperador,
  EstadoRemotoReporte,
  ReporteOperador,
  SesionOperador,
  TerminoIncidencia,
} from './operador-api.modelos';

/**
 * ÚNICA puerta a la API del operador. Dos implementaciones, elegidas por environment.fuenteDatos:
 *  - OperadorApiEjemplo ('ejemplo'): en memoria.
 *  - OperadorApiHttp ('api'): la API real según los contratos M1 (sesión, viaje, reportes) y M2 (hoja de ruta, evidencias).
 *
 * Las credenciales (token y refresh) las maneja cada implementación por dentro: nunca salen de ella, ni a pantallas
 * ni a la consola. Errores: toda implementación rechaza con ErrorApiOperador, para que la cola sepa qué hacer.
 */
export interface OperadorApi {
  /** true mientras se usen datos de ejemplo: la app muestra el aviso "Datos de ejemplo". */
  readonly esEjemplo: boolean;

  /** Celular a 10 dígitos y PIN de 6 dígitos asignado por la oficina. El PIN no se guarda en ningún lado. */
  iniciarSesion(celular: string, pin: string): Promise<SesionOperador>;

  /** Renueva la sesión con el refresh guardado. Rechaza con 'sesion' si ya no sirve (hay que pedir el PIN). */
  renovarSesion(): Promise<void>;

  /** Cierra la sesión en el teléfono: borra token y refresh. */
  cerrarSesion(): Promise<void>;

  /** Salida activa del operador con sus viajes, estatus actual e historial. Solo lo suyo. */
  obtenerAsignacion(): Promise<AsignacionOperador>;

  /**
   * Envía un reporte de estatus o de incidencia. IDEMPOTENTE por reporte.id: reenviar el mismo id devuelve el acuse
   * actual, sin duplicar. Un estatus que quedó atrás se recibe "sin-efecto" (el viaje no retrocede).
   */
  enviarReporte(reporte: ReporteOperador): Promise<AcuseReporte>;

  /** Estado actual de reportes ya enviados. Los ids que el servidor no conozca no se devuelven. */
  consultarReportes(ids: string[]): Promise<EstadoRemotoReporte[]>;

  /**
   * "Ya continué": termina una incidencia abierta de su salida activa (sección 7). IDEMPOTENTE por termino.id. Si ya
   * estaba terminada, el acuse dice 'ya-terminada' (no es un error).
   */
  terminarIncidencia(termino: TerminoIncidencia): Promise<AcuseTerminoIncidencia>;

  // ------------------------------------------------------------ M2

  /** Hoja de ruta de su salida activa; null sin salida activa. Nunca lleva importes. */
  obtenerHojaRuta(): Promise<HojaRuta | null>;

  /**
   * Sube una foto (ya reducida) de un viaje cargado. IDEMPOTENTE por datos.id con la misma foto; el mismo id con otra
   * foto rechaza con 'id-duplicado' (hay que generar otro id).
   */
  subirEvidencia(foto: Blob, datos: DatosEvidencia): Promise<AcuseEvidencia>;

  /** Estado de fotos ya subidas (recibida o anulada). Las que no llegaron no se devuelven: hay que reenviarlas. */
  consultarEvidencias(ids: string[]): Promise<EstadoRemotoEvidencia[]>;

  /** Evidencias vigentes de un viaje: las suyas y las de la oficina (estas solo como aviso, sin archivo). */
  evidenciasDeViaje(viajeId: string): Promise<EvidenciaViaje[]>;

  /** Archivo de una foto SUYA. null si el servidor no la da (404: de la oficina, anulada o ajena); no es un error. */
  archivoEvidencia(id: string): Promise<Blob | null>;
}

export const OPERADOR_API = new InjectionToken<OperadorApi>('OPERADOR_API');

/**
 * Tipos de error (contrato M1, tabla 3.2):
 *  - sin-conexion: no hubo respuesta (sin señal, servidor inalcanzable). Se reintenta solo.
 *  - servidor: el servidor falló (5xx, 503 en mantenimiento). Se reintenta con espera creciente.
 *  - limite: demasiadas peticiones (429). Se reintenta más tarde; en el acceso: esperar 15 minutos.
 *  - sesion: credenciales inválidas, sesión vencida que no se pudo renovar, o sin acceso (403). Pedir el PIN.
 *  - rechazado: el servidor no acepta el reporte o la foto (400, 404, 409). No se reintenta: "No aceptado".
 *  - id-duplicado: ese id ya lo usó otro operador (reporte) o se usó con otra foto (evidencia) (409). Generar otro id
 *    y reenviar.
 */
export type TipoErrorApi = 'sin-conexion' | 'servidor' | 'limite' | 'sesion' | 'rechazado' | 'id-duplicado';

export class ErrorApiOperador extends Error {
  constructor(
    readonly tipo: TipoErrorApi,
    mensaje: string,
    /** `codigo` del ProblemDetails, si vino (p. ej. DESPACHO_EVENTO_HORA_INVALIDA). */
    readonly codigo: string | null = null,
    readonly status: number | null = null,
  ) {
    super(mensaje);
    this.name = 'ErrorApiOperador';
  }
}

/** Cualquier error → ErrorApiOperador. Lo que no se reconoce se trata como falla de conexión (se reintenta). */
export function comoErrorApi(error: unknown): ErrorApiOperador {
  if (error instanceof ErrorApiOperador) return error;
  return new ErrorApiOperador('sin-conexion', 'No hubo respuesta del servidor.');
}

/** Código del contrato para un reporte con la hora del teléfono en el futuro. */
export const CODIGO_HORA_INVALIDA = 'DESPACHO_EVENTO_HORA_INVALIDA';

/** Códigos de error al terminar una incidencia (contrato M1, sección 7). */
export const CODIGOS_TERMINO = {
  invalido: 'OPERADOR_REPORTE_INVALIDO',
  eventoInvalido: 'DESPACHO_EVENTO_INVALIDO',
  horaInvalida: 'DESPACHO_EVENTO_HORA_INVALIDA',
  noEncontrada: 'OPERADOR_INCIDENCIA_NO_ENCONTRADA',
  salidaCerrada: 'OPERADOR_SALIDA_CERRADA',
  claveDuplicada: 'DESPACHO_EVENTO_CLAVE_DUPLICADA',
} as const;

/** Códigos de error de evidencias (contrato M2, 2.1). */
export const CODIGOS_EVIDENCIA = {
  claveDuplicada: 'VIAJE_EVIDENCIA_CLAVE_DUPLICADA',
  viajeNoEncontrado: 'OPERADOR_VIAJE_NO_ENCONTRADO',
  salidaCerrada: 'OPERADOR_SALIDA_CERRADA',
  estadoInvalido: 'VIAJE_EVIDENCIA_ESTADO_INVALIDO',
  archivoInvalido: 'VIAJE_EVIDENCIA_ARCHIVO_INVALIDO',
  demasiadoGrande: 'VIAJE_EVIDENCIA_DEMASIADO_GRANDE',
  limite: 'VIAJE_EVIDENCIA_LIMITE',
  invalida: 'VIAJE_EVIDENCIA_INVALIDA',
} as const;
