/**
 * Traduce un error HTTP de la API del operador a ErrorApiOperador, por status y `codigo` (contrato M1, tabla 3.2, y M2,
 * sección 2.1).
 * PURO. Los mensajes son para el operador: nunca incluyen el PIN ni los tokens (el cuerpo de la petición no se toca).
 */
import { CODIGOS_EVIDENCIA, CODIGO_HORA_INVALIDA, ErrorApiOperador } from '../operador-api';

/** De dónde vino el error: cambia el mensaje de 401 y 429. */
export type ContextoPeticion = 'login' | 'renovar' | 'general';

export const CODIGO_CLAVE_DUPLICADA = 'DESPACHO_EVENTO_CLAVE_DUPLICADA';
export const CODIGO_SIN_ACCESO = 'OPERADOR_SIN_ACCESO';

export const MENSAJES = {
  sinConexion: 'Sin conexión con la oficina.',
  credenciales: 'Celular o PIN incorrectos.',
  demasiadosIntentos: 'Demasiados intentos. Espere 15 minutos y vuelva a intentar.',
  limite: 'La oficina recibió demasiadas peticiones. Se reintenta en un momento.',
  sesionTerminada: 'Su sesión terminó. Entre de nuevo con su PIN.',
  sinAcceso: 'Ya no tiene acceso a la aplicación. Llame a la oficina.',
  horaInvalida: 'La hora de su teléfono está adelantada. Corríjala y vuelva a reportar.',
  rechazado: 'La oficina no aceptó el reporte.',
  servidor: 'La oficina no responde en este momento.',
  mantenimiento: 'La cuenta está en mantenimiento. Se reintenta más tarde.',
} as const;

/**
 * ProblemDetails `{ title, status, detail, codigo? }`. `detail` es para mostrar; `codigo` para decidir. Los 400 de regla
 * de evidencias (M2) llegan como `{ status, message, codigo }`: `message` hace las veces de `detail`.
 */
export interface ProblemDetails {
  title?: unknown;
  status?: unknown;
  detail?: unknown;
  message?: unknown;
  codigo?: unknown;
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export function clasificarError(status: number, cuerpo: unknown, contexto: ContextoPeticion): ErrorApiOperador {
  const pd = (cuerpo && typeof cuerpo === 'object' ? cuerpo : {}) as ProblemDetails;
  const codigo = texto(pd.codigo);
  const detail = texto(pd.detail) ?? texto(pd.message);
  const err = (tipo: ErrorApiOperador['tipo'], mensaje: string) => new ErrorApiOperador(tipo, mensaje, codigo, status || null);

  // Sin respuesta (sin señal, CORS, certificado, servidor apagado).
  if (!status) return err('sin-conexion', MENSAJES.sinConexion);

  if (status === 429) return err('limite', contexto === 'general' ? MENSAJES.limite : MENSAJES.demasiadosIntentos);

  if (status === 401) {
    if (contexto === 'login') return err('sesion', MENSAJES.credenciales);
    return err('sesion', MENSAJES.sesionTerminada);
  }
  if (status === 403) return err('sesion', codigo === CODIGO_SIN_ACCESO ? MENSAJES.sinAcceso : MENSAJES.sesionTerminada);

  if (status === 409 && codigo === CODIGO_CLAVE_DUPLICADA) return err('id-duplicado', detail ?? 'Ese id de reporte ya existe.');
  if (status === 409 && codigo === CODIGOS_EVIDENCIA.claveDuplicada) return err('id-duplicado', detail ?? 'Ese id de foto ya se usó con otra foto.');
  if (status === 400 && codigo === CODIGO_HORA_INVALIDA) return err('rechazado', MENSAJES.horaInvalida);
  if (status === 400 || status === 404 || status === 409) return err('rechazado', detail ?? MENSAJES.rechazado);

  if (status === 503) return err('servidor', MENSAJES.mantenimiento);
  if (status >= 500 || status === 408) return err('servidor', MENSAJES.servidor);

  // Otro 4xx no previsto en el contrato: no se reintenta en bucle.
  return err('rechazado', detail ?? MENSAJES.rechazado);
}
