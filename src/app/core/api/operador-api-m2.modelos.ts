/**
 * Modelos de M2 (docs/contrato-app-operador-m2.md): hoja de ruta y evidencias (fotos).
 *
 * REGLA: nunca tarifas, importes, flete, casetas en pesos, diésel, costos ni pagos. Esos campos no existen aquí y no
 * deben agregarse: la traducción de la API real arma cada objeto campo por campo (lista blanca) y las pruebas de guarda
 * revisan los datos de ejemplo y la traducción.
 */
import { IsoUtc, MotivoTramoVacio, PuntoGps } from './operador-api.modelos';

// ---------------------------------------------------------------- Hoja de ruta (contrato M2, sección 1)

/** "Municipio, Estado" o el texto del tramo; dirección y descripción solo si la ubicación de la ruta está completa. */
export interface LugarHoja {
  lugar: string;
  direccion: string | null;
  descripcion: string | null;
}

export interface TiempoHoja {
  horas: number;
  minutos: number;
}

/** Tipos de parada autorizada (nunca las de solo trazado). */
export const TIPOS_PARADA = ['Descanso', 'CambioChofer', 'CargaDiesel', 'Resguardo', 'Otro'] as const;
export type TipoParada = (typeof TIPOS_PARADA)[number];

export interface ParadaHoja {
  orden: number;
  tipo: TipoParada;
  referencia: string | null;
  notas: string | null;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
}

/** Caseta por nombre y autopista, en el orden en que se cruza. SIN monto. */
export interface PlazaCobroHoja {
  orden: number;
  nombre: string;
  autopista: string | null;
}

export interface RutaHoja {
  nombre: string | null;
  km: number | null;
  tiempo: TiempoHoja | null;
  paradas: ParadaHoja[];
  plazasCobro: PlazaCobroHoja[];
  /** Liga de Google Maps (solo https). null si no vino o no es segura. */
  ligaMapa: string | null;
}

export interface TramoHoja {
  orden: number;
  tipo: 'cargado' | 'vacio';
  folio: string | null;
  cliente: string | null;
  origen: LugarHoja;
  destino: LugarHoja;
  citaCarga: IsoUtc | null;
  citaDescarga: IsoUtc | null;
  producto: string | null;
  /** true = "MATERIAL PELIGROSO". null en vacíos. */
  materialPeligroso: boolean | null;
  toneladasProgramadas: number | null;
  referencia: string | null;
  notas: string | null;
  /** Solo vacíos: valor del backend; en pantalla se traduce como en M1. */
  motivo: MotivoTramoVacio | null;
  motivoNota: string | null;
  km: number | null;
  /** null si el tramo no tiene ruta. */
  ruta: RutaHoja | null;
}

export interface HojaRuta {
  folio: string;
  generadaEn: IsoUtc;
  empresa: string;
  telefonoEmpresa: string | null;
  /** Tráfico 24 h. */
  telefonoTrafico: string | null;
  salidaProgramada: IsoUtc | null;
  /** Solo fecha ("2026-11-27"), sin hora. */
  finEstimado: string | null;
  notas: string | null;
  operador: { nombre: string; licenciaTipo: string | null; licenciaNumero: string | null };
  unidad: {
    numeroEconomico: string;
    placas: string | null;
    configuracion: string | null;
    remolques: { numeroEconomico: string; placas: string | null }[];
  };
  /** En el orden de la salida; los viajes cancelados no aparecen. */
  itinerario: TramoHoja[];
  kmPlaneados: number | null;
  tiempoEstimado: TiempoHoja | null;
}

// ---------------------------------------------------------------- Evidencias (contrato M2, sección 2)

/** Valores del backend; en pantalla se traducen (ETIQUETA_EVIDENCIA). */
export const TIPOS_EVIDENCIA = ['Remision', 'CartaPorteFirmada', 'Sellos', 'TicketBascula', 'AcuseRecibido', 'Dano', 'Otro'] as const;
export type TipoEvidencia = (typeof TIPOS_EVIDENCIA)[number];

/** Lo que acompaña a la foto en POST api/operador/evidencias (multipart). */
export interface DatosEvidencia {
  /** Lo genera el teléfono al tomar la foto: reenviar el mismo id con la misma foto no duplica. */
  id: string;
  /** Un viaje CARGADO de su salida. */
  viajeId: string;
  tipo: TipoEvidencia;
  /** Obligatoria con Otro. Hasta 150 caracteres. */
  descripcion: string | null;
  /** Hasta 500 caracteres. */
  nota: string | null;
  /** Reporte suyo de esa salida al que queda ligada (p. ej. el Descargado). */
  reporteId: string | null;
  /** Cuándo se tomó (no más de 10 min en el futuro). */
  tomadaEn: IsoUtc | null;
  /** Igual que en los reportes de M1; null = sin permiso o sin GPS (la foto se envía igual). */
  ubicacion: PuntoGps | null;
}

/** 201 (nueva) o 200 (reintento con el mismo id y la misma foto). */
export interface AcuseEvidencia {
  id: string;
  recibidaEn: IsoUtc;
  /** "Recibida: Acuse de recibido." */
  mensaje: string | null;
}

/** POST evidencias/estado. Las que no llegaron no aparecen (hay que reenviarlas). */
export interface EstadoRemotoEvidencia {
  id: string;
  estado: 'recibida' | 'anulada';
  /** Solo anulada: "La oficina anuló la evidencia: <motivo>". */
  motivo: string | null;
}

/** Evidencia vigente de un viaje (GET evidencias?viajeId=): las suyas y las que subió la oficina. */
export interface EvidenciaViaje {
  id: string;
  viajeId: string;
  tipo: TipoEvidencia;
  descripcion: string | null;
  nota: string | null;
  contentType: string | null;
  tamanoBytes: number | null;
  subidaEn: IsoUtc;
  tomadaEn: IsoUtc | null;
  /** Las de la oficina NO se descargan (404): solo se avisa que existen. */
  autor: 'operador' | 'oficina';
}
