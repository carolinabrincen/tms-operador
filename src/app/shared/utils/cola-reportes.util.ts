/**
 * Reglas de la cola de reportes del teléfono. PURO: el servicio solo guarda, envía y aplica estas funciones.
 *
 * Ciclo: pendiente → (enviado | confirmado | rechazado); enviado → confirmado.
 * Un reporte nace "pendiente" y se guarda ANTES de intentar enviarlo; si falla por conexión o por el servidor sigue
 * pendiente y se reintenta; si el servidor lo rechaza no se reintenta.
 */
import { AcuseReporte, EstadoRemotoReporte, IsoUtc, ReporteAvance } from '../../core/api/operador-api.modelos';
import { TipoErrorApi } from '../../core/api/operador-api';
import { EstadoReporteLocal, ReporteLocal } from '../../core/reportes/reporte-local';

export const ETIQUETA_ESTADO_REPORTE: Readonly<Record<EstadoReporteLocal, string>> = {
  pendiente: 'Pendiente de enviar',
  enviado: 'Enviado',
  confirmado: 'Confirmado por oficina',
  rechazado: 'No aceptado',
};

/** Esperas entre reintentos cuando el servidor falla (s): 5, 15, 30, 60 y luego cada 2 min. */
const ESPERAS_S = [5, 15, 30, 60, 120];

export function retrasoReintentoMs(intentos: number): number {
  const i = Math.min(Math.max(intentos, 1), ESPERAS_S.length) - 1;
  return ESPERAS_S[i] * 1000;
}

export function crearReporteLocal(reporte: ReporteAvance, operadorId: string, resumen: string, ahora: IsoUtc): ReporteLocal {
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
  };
}

/** Pendientes de ese operador, en el orden en que se crearon (se envían en orden). */
export function porEnviar(reportes: readonly ReporteLocal[], operadorId: string): ReporteLocal[] {
  return reportes
    .filter((r) => r.operadorId === operadorId && r.estado === 'pendiente')
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn) || a.id.localeCompare(b.id));
}

/** Enviados (sin confirmar) de ese operador: a esos se les pregunta si la oficina ya confirmó. */
export function porConfirmar(reportes: readonly ReporteLocal[], operadorId: string): ReporteLocal[] {
  return reportes.filter((r) => r.operadorId === operadorId && r.estado === 'enviado');
}

export function conEnvioExitoso(r: ReporteLocal, acuse: AcuseReporte, ahora: IsoUtc): ReporteLocal {
  return {
    ...r,
    estado: acuse.confirmado ? 'confirmado' : 'enviado',
    intentos: r.intentos + 1,
    ultimoIntentoEn: ahora,
    enviadoEn: acuse.recibidoEn || ahora,
    confirmadoEn: acuse.confirmado ? (r.confirmadoEn ?? ahora) : r.confirmadoEn,
    error: null,
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

/** Aplica lo que dice el servidor. Solo sube de estado (nunca regresa un confirmado a enviado). */
export function conEstadoRemoto(r: ReporteLocal, remoto: EstadoRemotoReporte, ahora: IsoUtc): ReporteLocal {
  if (!remoto.confirmado || r.estado === 'confirmado' || r.estado === 'rechazado') return r;
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
