/**
 * Modelos de la app del operador. Siguen el contrato M1 (docs/contrato-app-operador-m1.md): la implementación real
 * (OperadorApiHttp) traduce lo que manda el servidor a estas formas y la de ejemplo las produce igual.
 *
 * REGLA: el operador NUNCA ve tarifas, ingresos, costos, utilidad ni pagos. Esos campos no existen aquí y no deben
 * agregarse (las pruebas lo verifican sobre los datos de ejemplo y sobre la traducción de la API real).
 */

/** Fecha-hora ISO 8601 en UTC ("2026-11-23T20:05:00Z"). En pantalla se muestra con la hora del negocio. */
export type IsoUtc = string;

/**
 * Perfil del operador con sesión (se guarda en el teléfono para mostrar su nombre y filtrar su cola).
 * NO lleva el token ni el refresh: esos los guarda la implementación de la API aparte (IndexedDB) y nunca salen de ahí.
 * El PIN no se guarda en ningún lado.
 */
export interface SesionOperador {
  operadorId: string;
  nombre: string;
  /** Últimos 4 dígitos del celular, solo para mostrar ("•••• 4321"). */
  celularTerminacion: string;
}

export interface Unidad {
  /** Número económico de la unidad ("T-104"). */
  numeroEconomico: string;
  /** Las de la motriz; "" si no tiene. */
  placas: string;
  /** Etiqueta y composición del conjunto ("Sencillo 1 · Sencillo") o el tipo de la motriz. Se muestra tal cual. */
  configuracion: string;
  /** Números económicos de los arrastres (y dolly), en orden de posición. */
  remolques: string[];
}

// ---------------------------------------------------------------- Estatus del viaje (los mismos nombres que oficina)

export const ESTATUS_CARGADO = [
  'Asignado',
  'EnPosicionamiento',
  'EnPatioOrigen',
  'EnCarga',
  'Documentado',
  'EnTransito',
  'EnPatioDestino',
  'EnDescarga',
  'Descargado',
  'Cerrado',
] as const;
/** Además de la secuencia, la oficina puede cancelar un viaje dentro de una salida activa (contrato M1). */
export type EstatusCargado = (typeof ESTATUS_CARGADO)[number] | 'Cancelado';

/** EnPatio y EnTaller son alternativas del mismo paso (llegada). Cerrado solo lo usa el ejemplo. */
export const ESTATUS_VACIO = ['Asignado', 'EnTransitoVacio', 'EnPatio', 'EnTaller', 'Cerrado'] as const;
export type EstatusVacio = (typeof ESTATUS_VACIO)[number];

export type EstatusViaje = EstatusCargado | EstatusVacio;

/** Quién puso un estatus. */
export type Autor = 'operador' | 'oficina';

/** Valores del backend; en pantalla se traducen (ETIQUETA_MOTIVO). */
export const MOTIVOS_TRAMO_VACIO = ['Posicionamiento', 'CargaCombustible', 'Taller', 'Otro'] as const;
export type MotivoTramoVacio = (typeof MOTIVOS_TRAMO_VACIO)[number];

/** Valores del backend (P10 a); en pantalla se traducen (ETIQUETA_INCIDENCIA). */
export const TIPOS_INCIDENCIA = ['DetenidoEnParador', 'IncidenciaMecanica', 'RetenOInspeccion', 'DesvioDeRuta', 'Otro'] as const;
export type TipoIncidencia = (typeof TIPOS_INCIDENCIA)[number];

/** Lo ya ocurrido en un viaje, según el servidor. */
export type EventoViaje =
  | { tipo: 'estatus'; estatus: EstatusViaje; nota: string | null; ocurrioEn: IsoUtc; autor: Autor; reporteId: string | null }
  | { tipo: 'incidencia'; incidencia: TipoIncidencia; nota: string | null; ocurrioEn: IsoUtc; autor: Autor; reporteId: string | null };

interface ViajeBase {
  id: string;
  folio: string;
  /** 1, 2, 3…: orden dentro de la salida. */
  orden: number;
  notas: string | null;
  /** Historial de estatus e incidencias, del más antiguo al más reciente. */
  historial: EventoViaje[];
}

export interface ViajeCargado extends ViajeBase {
  tipo: 'cargado';
  estatus: EstatusCargado;
  cliente: string;
  origen: string;
  destino: string;
  citaCarga: IsoUtc | null;
  citaDescarga: IsoUtc | null;
  producto: string;
  toneladasProgramadas: number | null;
  referencia: string | null;
}

export interface TramoVacio {
  orden: number;
  motivo: MotivoTramoVacio;
  origen: string;
  destino: string;
}

/** Movimiento en vacío. En la API real su `id` es el id de la salida (los reportes van con ese id). */
export interface ViajeVacio extends ViajeBase {
  tipo: 'vacio';
  estatus: EstatusVacio;
  /** En orden. El motivo del último decide si "Llegué" es EnPatio o EnTaller. */
  tramos: TramoVacio[];
}

export type Viaje = ViajeCargado | ViajeVacio;

/**
 * Incidencia de la salida que sigue sin terminar (contrato M1, sección 2, migración 48): de sus viajes o sin viaje,
 * también las que registró la oficina. `id` es el que se manda para terminarla (sección 7).
 */
export interface IncidenciaAbierta {
  id: string;
  tipo: TipoIncidencia;
  ocurrioEn: IsoUtc;
  nota: string | null;
}

/** La salida de la unidad: uno o varios viajes, en orden. (En oficina, el despacho es el inicio del viaje.) */
export interface Salida {
  id: string;
  folio: string;
  unidad: Unidad;
  viajes: Viaje[];
  notas: string | null;
  /** De la más antigua a la más reciente; [] si no hay. Una copia guardada por una versión anterior puede no traerla. */
  incidenciasAbiertas: IncidenciaAbierta[];
}

/** Lo que el operador tiene asignado ahora. Solo lo suyo. */
export interface AsignacionOperador {
  /** null = no tiene salida activa (no hay "próximas", P9 a). */
  salida: Salida | null;
}

// ---------------------------------------------------------------- Reportes del operador

export interface PuntoGps {
  lat: number;
  lng: number;
  /** Precisión en metros que informó el teléfono (el servidor la guarda con 1 decimal). */
  precisionM: number | null;
  tomadoEn: IsoUtc;
}

interface ReporteBase {
  /** Lo genera el teléfono: reenviar el mismo id NO debe duplicar el reporte. */
  id: string;
  /** Un viaje de su salida, o el id de la salida si es un vacío. */
  viajeId: string;
  /** Cuándo ocurrió (hora del teléfono al reportar, en UTC). No más de 10 minutos en el futuro. */
  ocurrioEn: IsoUtc;
  /** null = sin permiso o sin señal de GPS. El reporte se envía igual. */
  ubicacion: PuntoGps | null;
  /** Hasta 500 caracteres. */
  nota: string | null;
}

/** El operador reporta que el viaje llegó a ese estatus. Solo hacia adelante. */
export interface ReporteEstatus extends ReporteBase {
  tipo: 'estatus';
  estatus: EstatusViaje;
}

/** Incidencia en el camino. No cambia el estatus del viaje. En "Otro" la nota es obligatoria. */
export interface ReporteIncidencia extends ReporteBase {
  tipo: 'incidencia';
  incidencia: TipoIncidencia;
}

export type ReporteOperador = ReporteEstatus | ReporteIncidencia;

/**
 * "Ya continué": el operador termina una incidencia abierta (contrato M1, sección 7). Va por la misma cola sin conexión
 * que los reportes, con su propio id (idempotente). `tipo` es solo de la app (no se manda).
 */
export interface TerminoIncidencia {
  tipo: 'termino';
  /** Lo genera el teléfono (distinto del de los reportes). Reenviar el mismo id no cambia nada. */
  id: string;
  /** El `id` de una de `incidenciasAbiertas`. */
  incidenciaId: string;
  /** Hora en que terminó (teléfono, UTC). No antes de la incidencia ni más de 10 minutos en el futuro. */
  terminadaEn: IsoUtc;
  ubicacion: PuntoGps | null;
  /** Hasta 500 caracteres. */
  nota: string | null;
}

/** Lo que viaja en la cola del teléfono: reportes de estatus e incidencias, y términos de incidencia. */
export type EnvioOperador = ReporteOperador | TerminoIncidencia;

/** terminada: este id la terminó. ya-terminada: ya estaba terminada (por usted, por un estatus o por la oficina). */
export type ResultadoTermino = 'terminada' | 'ya-terminada';

export interface AcuseTerminoIncidencia {
  id: string;
  incidenciaId: string;
  recibidoEn: IsoUtc;
  /** Con ya-terminada, la hora con que quedó terminada (no la que mandó la app). */
  terminadaEn: IsoUtc;
  resultado: ResultadoTermino;
  /** null con terminada; con ya-terminada explica quién la terminó (de usted). */
  mensaje: string | null;
}

/**
 * Qué hizo el servidor con un reporte (contrato M1, tabla 3.1):
 *  - aplicado: estatus intermedio aplicado al momento.
 *  - por-confirmar: hito (Documentado, Descargado), o intermedio que saltaría un hito: espera a la oficina.
 *  - confirmado: la oficina capturó ese hito.
 *  - registrado: incidencia guardada.
 *  - sin-efecto: recibido sin cambiar el estatus (la oficina ya iba igual o más adelante, viaje cancelado, salida
 *    cerrada) o la oficina lo anuló después de aplicarlo. `mensaje` explica cuál.
 *  - descartado: la oficina descartó el reporte (P11 a). `mensaje` trae el motivo.
 */
export type ResultadoReporte = 'aplicado' | 'por-confirmar' | 'confirmado' | 'registrado' | 'sin-efecto' | 'descartado';

/** Respuesta al recibir un reporte (también al recibirlo repetido). */
export interface AcuseReporte {
  id: string;
  recibidoEn: IsoUtc;
  resultado: ResultadoReporte;
  /** Explicación para el operador ("Recibido; la oficina lo confirma.", motivo de anulación o descarte…). */
  mensaje: string | null;
}

/** Estado actual de un reporte en el servidor. */
export interface EstadoRemotoReporte {
  id: string;
  resultado: ResultadoReporte;
  /** Solo con `confirmado`. */
  confirmadoEn: IsoUtc | null;
  mensaje: string | null;
}
