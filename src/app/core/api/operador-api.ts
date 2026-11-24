import { InjectionToken } from '@angular/core';
import { AcuseReporte, AsignacionOperador, EstadoRemotoReporte, ReporteOperador, SesionOperador } from './operador-api.modelos';

/**
 * ÚNICA puerta a la API del operador. Dos implementaciones, elegidas por environment.fuenteDatos:
 *  - OperadorApiEjemplo ('ejemplo'): en memoria.
 *  - OperadorApiHttp ('api'): la API real según el contrato M1.
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
}

export const OPERADOR_API = new InjectionToken<OperadorApi>('OPERADOR_API');

/**
 * Tipos de error (contrato M1, tabla 3.2):
 *  - sin-conexion: no hubo respuesta (sin señal, servidor inalcanzable). Se reintenta solo.
 *  - servidor: el servidor falló (5xx, 503 en mantenimiento). Se reintenta con espera creciente.
 *  - limite: demasiadas peticiones (429). Se reintenta más tarde; en el acceso: esperar 15 minutos.
 *  - sesion: credenciales inválidas, sesión vencida que no se pudo renovar, o sin acceso (403). Pedir el PIN.
 *  - rechazado: el servidor no acepta el reporte (400, 404, 409). No se reintenta: "No aceptado".
 *  - id-duplicado: ese id de reporte ya lo usó otro operador (409). Generar otro id y reenviar.
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
