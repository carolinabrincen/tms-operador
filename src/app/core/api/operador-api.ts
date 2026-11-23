import { InjectionToken } from '@angular/core';
import { AcuseReporte, AsignacionOperador, EstadoRemotoReporte, ReporteAvance, SesionOperador } from './operador-api.modelos';

/**
 * ÚNICA puerta a la API del operador. Hoy solo existe la implementación de EJEMPLO (en memoria). Cuando llegue el
 * contrato se agrega OperadorApiHttp (sin tocar pantallas ni servicios) y se elige en provideOperadorApi().
 *
 * Errores: toda implementación rechaza con ErrorApiOperador, para que la cola sepa si reintentar.
 */
export interface OperadorApi {
  /** true mientras se usen datos de ejemplo: la app muestra el aviso "Datos de ejemplo". */
  readonly esEjemplo: boolean;

  /** Celular a 10 dígitos y PIN asignado por la oficina. El PIN no se guarda en ningún lado. */
  iniciarSesion(celular: string, pin: string): Promise<SesionOperador>;

  /** Despacho activo y movimientos en vacío del operador con sesión. Solo lo suyo. */
  obtenerAsignacion(): Promise<AsignacionOperador>;

  /** Envía un reporte. IDEMPOTENTE por reporte.id: reenviar el mismo id devuelve el mismo acuse, sin duplicar. */
  enviarReporte(reporte: ReporteAvance): Promise<AcuseReporte>;

  /** Estado de reportes ya enviados (¿los confirmó la oficina?). Los ids que el servidor no conozca no se devuelven. */
  consultarReportes(ids: string[]): Promise<EstadoRemotoReporte[]>;
}

export const OPERADOR_API = new InjectionToken<OperadorApi>('OPERADOR_API');

/**
 * Tipos de error:
 *  - sin-conexion: no hubo respuesta (sin señal, servidor inalcanzable). Se reintenta solo.
 *  - servidor: el servidor falló (5xx, tiempo agotado). Se reintenta con espera creciente.
 *  - sesion: credenciales inválidas o sesión vencida. Hay que volver a entrar.
 *  - rechazado: el servidor no acepta el reporte (datos inválidos). No se reintenta: se muestra al operador.
 */
export type TipoErrorApi = 'sin-conexion' | 'servidor' | 'sesion' | 'rechazado';

export class ErrorApiOperador extends Error {
  constructor(
    readonly tipo: TipoErrorApi,
    mensaje: string,
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
