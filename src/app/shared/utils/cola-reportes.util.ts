/**
 * Reglas de la cola de reportes del teléfono. PURO: el servicio solo guarda, envía y aplica estas funciones.
 *
 * Ciclo: pendiente → (enviado | por-confirmar | confirmado | descartado | rechazado). Después, el estado que dé el
 * servidor manda: un "enviado" puede volverse "sin efecto" (la oficina lo anuló) o "descartado"; un "por confirmar",
 * "confirmado"; y un "confirmado", "sin efecto" si la oficina anula el hito (el operador puede volver a reportarlo,
 * con otro id). Un reporte nace "pendiente" y se guarda ANTES de intentar enviarlo; si falla por conexión o por el
 * servidor sigue pendiente y se reintenta; si el servidor lo rechaza no se reintenta.
 */
import {
  AcuseReporte,
  AcuseTerminoIncidencia,
  EnvioOperador,
  EstadoRemotoReporte,
  IsoUtc,
  ResultadoReporte,
  ResultadoTermino,
} from '../../core/api/operador-api.modelos';
import { TipoErrorApi } from '../../core/api/operador-api';
import { EstadoReporteLocal, ReporteLocal } from '../../core/reportes/reporte-local';

export const ETIQUETA_ESTADO_REPORTE: Readonly<Record<EstadoReporteLocal, string>> = {
  pendiente: 'Pendiente de enviar',
  enviado: 'Enviado',
  'por-confirmar': 'Pendiente de confirmar por oficina',
  confirmado: 'Confirmado',
  descartado: 'Descartado por oficina',
  rechazado: 'No aceptado',
};

/** Qué estado local corresponde a lo que respondió el servidor. */
export const ESTADO_POR_RESULTADO: Readonly<Record<ResultadoReporte | ResultadoTermino, EstadoReporteLocal>> = {
  aplicado: 'enviado',
  registrado: 'enviado',
  'sin-efecto': 'enviado',
  'por-confirmar': 'por-confirmar',
  confirmado: 'confirmado',
  descartado: 'descartado',
  // "Ya continué": terminada o ya terminada, las dos cuentan como hecho (sin error).
  terminada: 'enviado',
  'ya-terminada': 'enviado',
};

/** Esperas entre reintentos cuando el servidor falla (s): 5, 15, 30, 60 y luego cada 2 min. */
const ESPERAS_S = [5, 15, 30, 60, 120];

export function retrasoReintentoMs(intentos: number): number {
  const i = Math.min(Math.max(intentos, 1), ESPERAS_S.length) - 1;
  return ESPERAS_S[i] * 1000;
}

/** Hora del hecho de un envío: la del reporte o, en un término, la hora en que terminó la incidencia. */
export function horaDelEnvio(e: EnvioOperador): IsoUtc {
  return e.tipo === 'termino' ? e.terminadaEn : e.ocurrioEn;
}

export function crearReporteLocal(reporte: EnvioOperador, operadorId: string, resumen: string, ahora: IsoUtc): ReporteLocal {
  return {
    id: reporte.id,
    operadorId,
    reporte,
    resumen,
    estado: 'pendiente',
    resultado: null,
    mensaje: null,
    creadoEn: ahora,
    intentos: 0,
    ultimoIntentoEn: null,
    enviadoEn: null,
    confirmadoEn: null,
    error: null,
  };
}

/** ¿Este reporte cuenta como algo que el operador ya hizo? No: rechazados, descartados ni recibidos sin efecto. */
export function cuentaComoHecho(r: { estado: string; resultado?: ResultadoReporte | ResultadoTermino | null }): boolean {
  return r.estado !== 'rechazado' && r.estado !== 'descartado' && r.resultado !== 'sin-efecto';
}

/** Pendientes de ese operador, en el orden en que se crearon (se envían en orden). */
export function porEnviar(reportes: readonly ReporteLocal[], operadorId: string): ReporteLocal[] {
  return reportes
    .filter((r) => r.operadorId === operadorId && r.estado === 'pendiente')
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn) || a.id.localeCompare(b.id));
}

/**
 * Reportes cuyo estado aún puede cambiar en el servidor, lo más reciente primero, hasta `max` (el contrato acepta 200
 * ids por consulta):
 *  - enviados y por confirmar (la oficina confirma, anula o descarta);
 *  - confirmados de un viaje de la salida ACTIVA (`viajesActivos`): la oficina puede anular un hito ya confirmado y
 *    el reporte pasa a "sin efecto". Cerrada o cancelada la salida, ya no se preguntan.
 * Un "sin efecto" ya no cambia: no se pregunta.
 */
export function porConsultar(
  reportes: readonly ReporteLocal[],
  operadorId: string,
  viajesActivos: ReadonlySet<string> = new Set(),
  max = 200,
): ReporteLocal[] {
  return reportes
    .filter(
      (r) =>
        r.operadorId === operadorId &&
        r.reporte.tipo !== 'termino' && // el acuse de un término es definitivo (no hay estado que consultar)
        r.resultado !== 'sin-efecto' &&
        (r.estado === 'enviado' || r.estado === 'por-confirmar' || (r.estado === 'confirmado' && viajesActivos.has(r.reporte.viajeId))),
    )
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
    .slice(0, max);
}

function conResultado(r: ReporteLocal, resultado: ResultadoReporte | ResultadoTermino, mensaje: string | null, confirmadoEn: IsoUtc | null, ahora: IsoUtc): ReporteLocal {
  const estado = ESTADO_POR_RESULTADO[resultado];
  return {
    ...r,
    estado,
    resultado,
    mensaje: mensaje ?? (resultado === 'sin-efecto' ? 'Recibido sin cambiar el estatus del viaje.' : null),
    // Solo un confirmado tiene hora de confirmación; si la oficina anuló el hito, vuelve a null (contrato 3.1).
    confirmadoEn: estado === 'confirmado' ? (confirmadoEn ?? r.confirmadoEn ?? ahora) : null,
  };
}

export function conEnvioExitoso(r: ReporteLocal, acuse: AcuseReporte | AcuseTerminoIncidencia, ahora: IsoUtc): ReporteLocal {
  return {
    ...conResultado(r, acuse.resultado, acuse.mensaje, null, ahora),
    intentos: r.intentos + 1,
    ultimoIntentoEn: ahora,
    enviadoEn: acuse.recibidoEn || ahora,
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

/** El mismo reporte con otro id (409: ese id lo usó otro operador). Sigue pendiente para reenviarse. */
export function conNuevoId(r: ReporteLocal, id: string): ReporteLocal {
  return { ...r, id, reporte: { ...r.reporte, id }, estado: 'pendiente', error: null };
}

/** Aplica el estado que dice el servidor. Sin cambios = el mismo objeto. */
export function conEstadoRemoto(r: ReporteLocal, remoto: EstadoRemotoReporte, ahora: IsoUtc): ReporteLocal {
  if (r.estado === 'pendiente' || r.estado === 'rechazado') return r;
  if (remoto.resultado === r.resultado && (remoto.mensaje ?? null) === r.mensaje) return r;
  return conResultado(r, remoto.resultado, remoto.mensaje, remoto.confirmadoEn, ahora);
}

/** Lo más reciente primero (por hora del reporte). */
export function ordenarRecientes(reportes: readonly ReporteLocal[]): ReporteLocal[] {
  return [...reportes].sort((a, b) => horaDelEnvio(b.reporte).localeCompare(horaDelEnvio(a.reporte)) || b.creadoEn.localeCompare(a.creadoEn));
}

/** "Falta enviar 1 reporte" / "Faltan enviar 3 reportes". */
export function textoPendientes(n: number): string {
  return n === 1 ? 'Falta enviar 1 reporte' : `Faltan enviar ${n} reportes`;
}

/** Nombres de incidencia del paso 2 (ejemplo) → los del backend (P10 a). */
const INCIDENCIA_ANTERIOR: Readonly<Record<string, string>> = {
  DetenidoParador: 'DetenidoEnParador',
  FallaMecanica: 'IncidenciaMecanica',
  RetenInspeccion: 'RetenOInspeccion',
  DesvioRuta: 'DesvioDeRuta',
};

/**
 * Registro leído del teléfono → ReporteLocal de esta versión, o null si no sirve. Traduce lo guardado por versiones
 * anteriores (paso 2: `aviso` en vez de `resultado`/`mensaje`, nombres de incidencia viejos). Descarta el paso 1.
 */
export function normalizarReporteLocal(x: unknown): ReporteLocal | null {
  const r = x as (ReporteLocal & { aviso?: string | null }) | null;
  if (!r || typeof r.id !== 'string' || typeof r.operadorId !== 'string' || !r.reporte) return null;
  if (r.reporte.tipo === 'termino') {
    const t = r.reporte;
    if (typeof t.incidenciaId !== 'string' || typeof t.terminadaEn !== 'string') return null;
    return { ...r, resultado: r.resultado ?? null, mensaje: r.mensaje ?? null };
  }
  if (r.reporte.tipo !== 'estatus' && r.reporte.tipo !== 'incidencia') return null;
  if (typeof r.reporte.viajeId !== 'string' || typeof r.reporte.ocurrioEn !== 'string') return null;
  const { aviso, ...resto } = r;
  let reporte = r.reporte;
  if (reporte.tipo === 'incidencia' && INCIDENCIA_ANTERIOR[reporte.incidencia]) {
    reporte = { ...reporte, incidencia: INCIDENCIA_ANTERIOR[reporte.incidencia] as typeof reporte.incidencia };
  }
  return {
    ...resto,
    reporte,
    resultado: r.resultado ?? (aviso ? 'sin-efecto' : null),
    mensaje: r.mensaje ?? aviso ?? null,
  };
}
