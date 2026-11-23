/**
 * Reglas de la cola de reportes del teléfono. PURO: el servicio solo guarda, envía y aplica estas funciones.
 *
 * Ciclo: pendiente → (enviado | por-confirmar | confirmado | rechazado); por-confirmar → confirmado.
 * Un reporte nace "pendiente" y se guarda ANTES de intentar enviarlo; si falla por conexión o por el servidor sigue
 * pendiente y se reintenta; si el servidor lo rechaza no se reintenta.
 */
import { AcuseReporte, EstadoRemotoReporte, IsoUtc, ReporteOperador, ResultadoReporte } from '../../core/api/operador-api.modelos';
import { TipoErrorApi } from '../../core/api/operador-api';
import { EstadoReporteLocal, ReporteLocal } from '../../core/reportes/reporte-local';

export const ETIQUETA_ESTADO_REPORTE: Readonly<Record<EstadoReporteLocal, string>> = {
  pendiente: 'Pendiente de enviar',
  enviado: 'Enviado',
  'por-confirmar': 'Pendiente de confirmar por oficina',
  confirmado: 'Confirmado',
  rechazado: 'No aceptado',
};

/** Qué estado local corresponde a lo que respondió el servidor. */
export const ESTADO_POR_RESULTADO: Readonly<Record<ResultadoReporte, EstadoReporteLocal>> = {
  aplicado: 'enviado',
  registrado: 'enviado',
  'sin-efecto': 'enviado',
  'por-confirmar': 'por-confirmar',
  confirmado: 'confirmado',
};

/** Esperas entre reintentos cuando el servidor falla (s): 5, 15, 30, 60 y luego cada 2 min. */
const ESPERAS_S = [5, 15, 30, 60, 120];

export function retrasoReintentoMs(intentos: number): number {
  const i = Math.min(Math.max(intentos, 1), ESPERAS_S.length) - 1;
  return ESPERAS_S[i] * 1000;
}

export function crearReporteLocal(reporte: ReporteOperador, operadorId: string, resumen: string, ahora: IsoUtc): ReporteLocal {
  return {
    id: reporte.id,
    operadorId,
    reporte,
    resumen,
    estado: 'pendiente',
    creadoEn: ahora,
    intentos: 0,
    ultimoIntentoEn: null,
    enviadoEn: null,
    confirmadoEn: null,
    error: null,
    aviso: null,
  };
}

/** Pendientes de ese operador, en el orden en que se crearon (se envían en orden). */
export function porEnviar(reportes: readonly ReporteLocal[], operadorId: string): ReporteLocal[] {
  return reportes
    .filter((r) => r.operadorId === operadorId && r.estado === 'pendiente')
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn) || a.id.localeCompare(b.id));
}

/** Hitos de ese operador que esperan la confirmación de la oficina. */
export function porConfirmar(reportes: readonly ReporteLocal[], operadorId: string): ReporteLocal[] {
  return reportes.filter((r) => r.operadorId === operadorId && r.estado === 'por-confirmar');
}

export function conEnvioExitoso(r: ReporteLocal, acuse: AcuseReporte, ahora: IsoUtc): ReporteLocal {
  const estado = ESTADO_POR_RESULTADO[acuse.resultado];
  return {
    ...r,
    estado,
    intentos: r.intentos + 1,
    ultimoIntentoEn: ahora,
    enviadoEn: acuse.recibidoEn || ahora,
    confirmadoEn: estado === 'confirmado' ? (r.confirmadoEn ?? ahora) : r.confirmadoEn,
    error: null,
    aviso: acuse.resultado === 'sin-efecto' ? (acuse.mensaje ?? 'Recibido sin cambiar el estatus del viaje.') : null,
  };
}

/** Falla al enviar: rechazado = definitivo; cualquier otra = sigue pendiente (se reintenta). */
export function conFallaEnvio(r: ReporteLocal, tipo: TipoErrorApi, mensaje: string, ahora: IsoUtc): ReporteLocal {
  return {
    ...r,
    estado: tipo === 'rechazado' ? 'rechazado' : 'pendiente',
    intentos: r.intentos + 1,
    ultimoIntentoEn: ahora,
    error: mensaje,
  };
}

/** Aplica lo que dice el servidor. Solo de por-confirmar a confirmado (nunca hacia atrás). */
export function conEstadoRemoto(r: ReporteLocal, remoto: EstadoRemotoReporte, ahora: IsoUtc): ReporteLocal {
  if (r.estado !== 'por-confirmar' || remoto.resultado !== 'confirmado') return r;
  return { ...r, estado: 'confirmado', confirmadoEn: remoto.confirmadoEn ?? ahora };
}

/** Lo más reciente primero (por hora del reporte). */
export function ordenarRecientes(reportes: readonly ReporteLocal[]): ReporteLocal[] {
  return [...reportes].sort((a, b) => b.reporte.ocurrioEn.localeCompare(a.reporte.ocurrioEn) || b.creadoEn.localeCompare(a.creadoEn));
}

/** "Falta enviar 1 reporte" / "Faltan enviar 3 reportes". */
export function textoPendientes(n: number): string {
  return n === 1 ? 'Falta enviar 1 reporte' : `Faltan enviar ${n} reportes`;
}

/** ¿Lo guardado parece un registro válido de esta versión de la app? (descarta formatos viejos o dañados) */
export function esReporteLocalValido(x: unknown): x is ReporteLocal {
  const r = x as ReporteLocal | null;
  return (
    !!r &&
    typeof r.id === 'string' &&
    typeof r.operadorId === 'string' &&
    !!r.reporte &&
    (r.reporte.tipo === 'estatus' || r.reporte.tipo === 'incidencia') &&
    typeof r.reporte.viajeId === 'string' &&
    typeof r.reporte.ocurrioEn === 'string'
  );
}
