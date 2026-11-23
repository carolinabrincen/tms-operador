/**
 * Modelos de la app del operador (lado app). NO son el contrato de la API real, que aún no existe: cuando llegue, su
 * implementación de OperadorApi traducirá lo que mande el servidor a estas formas.
 *
 * REGLA: el operador NUNCA ve tarifas, ingresos, costos, utilidad ni pagos. Esos campos no existen aquí y no deben
 * agregarse (la prueba de operador-api-ejemplo.spec.ts lo verifica sobre los datos de ejemplo).
 */

/** Fecha-hora ISO 8601 en UTC ("2026-11-23T20:05:00Z"). En pantalla se muestra con la hora del negocio. */
export type IsoUtc = string;

export interface SesionOperador {
  operadorId: string;
  nombre: string;
  /** Últimos 4 dígitos del celular, solo para mostrar ("•••• 4321"). */
  celularTerminacion: string;
  /** Token que entregue el servidor. En el ejemplo es un texto falso. El PIN nunca se guarda. */
  token: string;
}

export interface Unidad {
  /** Número económico de la unidad ("T-104"). */
  numeroEconomico: string;
  placas: string;
  /** Configuración vehicular ("T3-S2 · Tractocamión con semirremolque"). */
  configuracion: string;
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
export type EstatusCargado = (typeof ESTATUS_CARGADO)[number];

/** EnPatio y EnTaller son alternativas del mismo paso (llegada). */
export const ESTATUS_VACIO = ['Asignado', 'EnTransitoVacio', 'EnPatio', 'EnTaller', 'Cerrado'] as const;
export type EstatusVacio = (typeof ESTATUS_VACIO)[number];

export type EstatusViaje = EstatusCargado | EstatusVacio;

/** Quién puso un estatus. */
export type Autor = 'operador' | 'oficina';

export const MOTIVOS_TRAMO_VACIO = ['Posicionamiento', 'Carga de combustible', 'Taller', 'Otro'] as const;
export type MotivoTramoVacio = (typeof MOTIVOS_TRAMO_VACIO)[number];

export const TIPOS_INCIDENCIA = ['DetenidoParador', 'FallaMecanica', 'RetenInspeccion', 'DesvioRuta', 'Otro'] as const;
export type TipoIncidencia = (typeof TIPOS_INCIDENCIA)[number];

/** Lo ya ocurrido en un viaje, según el servidor. */
export type EventoViaje =
  | { tipo: 'estatus'; estatus: EstatusViaje; ocurrioEn: IsoUtc; autor: Autor; reporteId: string | null }
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

export interface ViajeVacio extends ViajeBase {
  tipo: 'vacio';
  estatus: EstatusVacio;
  /** En orden. El motivo del último decide si "Llegué" es EnPatio o EnTaller. */
  tramos: TramoVacio[];
}

export type Viaje = ViajeCargado | ViajeVacio;

/** La salida de la unidad: uno o varios viajes, en orden. (En oficina, el despacho es el inicio del viaje.) */
export interface Salida {
  id: string;
  folio: string;
  unidad: Unidad;
  viajes: Viaje[];
  notas: string | null;
}

/** Lo que el operador tiene asignado ahora. Solo lo suyo. */
export interface AsignacionOperador {
  /** null = no tiene salida asignada. */
  salida: Salida | null;
}

// ---------------------------------------------------------------- Reportes del operador

export interface PuntoGps {
  lat: number;
  lng: number;
  /** Precisión en metros que informó el teléfono. */
  precisionM: number | null;
  tomadoEn: IsoUtc;
}

interface ReporteBase {
  /** Lo genera el teléfono: reenviar el mismo id NO debe duplicar el reporte. */
  id: string;
  viajeId: string;
  /** Cuándo ocurrió (hora del teléfono al reportar, en UTC). */
  ocurrioEn: IsoUtc;
  /** null = sin permiso o sin señal de GPS. El reporte se envía igual. */
  ubicacion: PuntoGps | null;
  nota: string | null;
}

/** El operador reporta que el viaje llegó a ese estatus. Solo hacia adelante. */
export interface ReporteEstatus extends ReporteBase {
  tipo: 'estatus';
  estatus: EstatusViaje;
}

/** Incidencia en el camino. No cambia el estatus del viaje. */
export interface ReporteIncidencia extends ReporteBase {
  tipo: 'incidencia';
  incidencia: TipoIncidencia;
}

export type ReporteOperador = ReporteEstatus | ReporteIncidencia;

/**
 * Qué hizo el servidor con un reporte:
 *  - aplicado: estatus intermedio aplicado al momento.
 *  - por-confirmar: hito (Documentado, Descargado) que espera a la oficina.
 *  - confirmado: la oficina confirmó el hito.
 *  - registrado: incidencia guardada.
 *  - sin-efecto: recibido, pero el viaje ya iba igual o más adelante (p. ej. la oficina avanzó); el estatus no cambió.
 */
export type ResultadoReporte = 'aplicado' | 'por-confirmar' | 'confirmado' | 'registrado' | 'sin-efecto';

/** Respuesta al recibir un reporte (también al recibirlo repetido). */
export interface AcuseReporte {
  id: string;
  recibidoEn: IsoUtc;
  resultado: ResultadoReporte;
  /** Explicación para el operador (sobre todo en sin-efecto). */
  mensaje: string | null;
}

/** Estado actual de un reporte en el servidor. */
export interface EstadoRemotoReporte {
  id: string;
  resultado: ResultadoReporte;
  confirmadoEn: IsoUtc | null;
}
