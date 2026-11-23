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

export interface Viaje {
  id: string;
  folio: string;
  cliente: string;
  origen: string;
  destino: string;
  citaCarga: IsoUtc | null;
  citaDescarga: IsoUtc | null;
  producto: string;
  toneladasProgramadas: number | null;
  referencia: string | null;
  notas: string | null;
}

export interface TramoVacio {
  tipo: 'vacio';
  id: string;
  /** 1, 2, 3…: el orden en que se recorre. */
  orden: number;
  origen: string;
  destino: string;
  notas: string | null;
}

export interface TramoCargado {
  tipo: 'cargado';
  id: string;
  orden: number;
  viaje: Viaje;
}

export type Tramo = TramoVacio | TramoCargado;

export interface Despacho {
  id: string;
  folio: string;
  unidad: Unidad;
  /** En el orden en que se recorren. */
  tramos: Tramo[];
  notas: string | null;
}

export const MOTIVOS_MOVIMIENTO_VACIO = ['Posicionamiento', 'Carga de combustible', 'Taller', 'Otro'] as const;
export type MotivoMovimientoVacio = (typeof MOTIVOS_MOVIMIENTO_VACIO)[number];

/** Movimiento de la unidad en vacío que NO pertenece a un viaje. */
export interface MovimientoVacio {
  id: string;
  folio: string;
  motivo: MotivoMovimientoVacio;
  unidad: Unidad;
  origen: string;
  destino: string;
  programadoPara: IsoUtc | null;
  notas: string | null;
}

/** Lo que el operador tiene asignado ahora. Solo lo suyo. */
export interface AsignacionOperador {
  /** null = no tiene despacho activo. */
  despacho: Despacho | null;
  movimientosVacio: MovimientoVacio[];
}

// ---------------------------------------------------------------- Reportes de avance

/** Avances que puede reportar. Un reporte NO cambia el estado del viaje: la oficina lo confirma. */
export type TipoAvance = 'sali' | 'llegue-cargar' | 'cargado' | 'llegue-descargar' | 'entregado' | 'llegue' | 'termine';

/** Sobre qué se reporta. */
export type ObjetivoReporte =
  | { tipo: 'tramo'; despachoId: string; tramoId: string; viajeId: string | null }
  | { tipo: 'movimiento'; movimientoId: string };

export interface PuntoGps {
  lat: number;
  lng: number;
  /** Precisión en metros que informó el teléfono. */
  precisionM: number | null;
  tomadoEn: IsoUtc;
}

/** Lo que se envía. El id lo genera el teléfono: reenviar el mismo id NO debe duplicar el reporte. */
export interface ReporteAvance {
  id: string;
  objetivo: ObjetivoReporte;
  avance: TipoAvance;
  /** Cuándo ocurrió (hora del teléfono al reportar, en UTC). */
  ocurrioEn: IsoUtc;
  /** null = sin permiso o sin señal de GPS. El reporte se envía igual. */
  ubicacion: PuntoGps | null;
  nota: string | null;
}

/** Respuesta del servidor al recibir un reporte (también al recibirlo repetido). */
export interface AcuseReporte {
  id: string;
  recibidoEn: IsoUtc;
  confirmado: boolean;
}

/** Estado de un reporte del lado del servidor. */
export interface EstadoRemotoReporte {
  id: string;
  confirmado: boolean;
  confirmadoEn: IsoUtc | null;
}
