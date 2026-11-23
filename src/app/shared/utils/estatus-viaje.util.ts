/**
 * Estatus del viaje y lo que el operador puede reportar. PURO.
 *
 * Reglas (Carolina, 23/11/2026):
 *  - Solo hacia adelante; se pueden saltar intermedios. Asignado y Cerrado no los pone el operador.
 *  - Documentado y Descargado son HITOS: quedan pendientes de confirmar por la oficina (ahí captura toneladas y estadía).
 *  - La oficina puede avanzar el viaje sin esperar al operador: la app guía desde el estatus más avanzado que conozca
 *    (el del servidor o lo que el operador ya reportó y no fue rechazado).
 */
import {
  ESTATUS_CARGADO,
  EstatusViaje,
  MotivoTramoVacio,
  ReporteOperador,
  Salida,
  Viaje,
  ViajeVacio,
} from '../../core/api/operador-api.modelos';

/** Nombre del estatus para pantalla. */
export const ETIQUETA_ESTATUS: Readonly<Record<EstatusViaje, string>> = {
  Asignado: 'Asignado',
  EnPosicionamiento: 'En camino a cargar',
  EnPatioOrigen: 'En patio de origen',
  EnCarga: 'Cargando',
  Documentado: 'Documentado',
  EnTransito: 'En tránsito',
  EnPatioDestino: 'En patio de destino',
  EnDescarga: 'Descargando',
  Descargado: 'Descargado',
  Cerrado: 'Cerrado',
  EnTransitoVacio: 'En tránsito (vacío)',
  EnPatio: 'En patio',
  EnTaller: 'En taller',
};

/** Texto del botón que pone cada estatus (lo que el operador "dice"). */
export const BOTON_ESTATUS: Readonly<Partial<Record<EstatusViaje, string>>> = {
  EnPosicionamiento: 'Voy a cargar',
  EnPatioOrigen: 'Llegué a cargar',
  EnCarga: 'Me están cargando',
  Documentado: 'Ya cargué y tengo documentos',
  EnTransito: 'Voy en camino a descargar',
  EnPatioDestino: 'Llegué a descargar',
  EnDescarga: 'Me están descargando',
  Descargado: 'Ya descargué',
  EnTransitoVacio: 'Salí',
  EnPatio: 'Llegué',
  EnTaller: 'Llegué al taller',
};

export const HITOS: ReadonlySet<EstatusViaje> = new Set<EstatusViaje>(['Documentado', 'Descargado']);

/** Estatus que el operador puede poner en un viaje cargado, en orden. */
export const PASOS_CARGADO: readonly EstatusViaje[] = ESTATUS_CARGADO.filter((e) => e !== 'Asignado' && e !== 'Cerrado');

export function esHito(e: EstatusViaje): boolean {
  return HITOS.has(e);
}

/** Posición del estatus en su secuencia (EnPatio y EnTaller comparten lugar). -1 si no pertenece al tipo de viaje. */
export function rango(tipo: Viaje['tipo'], e: EstatusViaje): number {
  if (tipo === 'cargado') return (ESTATUS_CARGADO as readonly string[]).indexOf(e);
  switch (e) {
    case 'Asignado':
      return 0;
    case 'EnTransitoVacio':
      return 1;
    case 'EnPatio':
    case 'EnTaller':
      return 2;
    case 'Cerrado':
      return 3;
    default:
      return -1;
  }
}

/** Motivo del último tramo de un viaje vacío. */
export function motivoUltimoTramo(v: ViajeVacio): MotivoTramoVacio | null {
  const ordenados = [...v.tramos].sort((a, b) => a.orden - b.orden);
  return ordenados.at(-1)?.motivo ?? null;
}

/** "Llegué" en vacío: EnTaller si el último tramo es a Taller; si no, EnPatio. */
export function llegadaVacio(v: ViajeVacio): 'EnPatio' | 'EnTaller' {
  return motivoUltimoTramo(v) === 'Taller' ? 'EnTaller' : 'EnPatio';
}

/** Estatus que el operador puede poner en este viaje, en orden. */
export function pasosOperador(v: Viaje): readonly EstatusViaje[] {
  return v.tipo === 'cargado' ? PASOS_CARGADO : ['EnTransitoVacio', llegadaVacio(v)];
}

/** ¿Puede el operador poner este estatus en este viaje (sin importar en cuál va)? */
export function esPasoDelOperador(v: Viaje, e: EstatusViaje): boolean {
  return pasosOperador(v).includes(e);
}

/** Texto del botón para ese estatus en ese viaje. */
export function textoBoton(e: EstatusViaje): string {
  return BOTON_ESTATUS[e] ?? ETIQUETA_ESTATUS[e];
}

/** Lo mínimo de un reporte local para calcular la guía (sirve con ReporteLocal). */
export interface ReporteParaGuia {
  reporte: ReporteOperador;
  estado: string;
  aviso: string | null;
}

/** ¿Este reporte cuenta como algo que el operador ya hizo? No cuentan los rechazados ni los recibidos sin efecto. */
function cuenta(r: ReporteParaGuia): boolean {
  return r.estado !== 'rechazado' && !r.aviso;
}

export interface Guia {
  /** Estatus desde el que se guía (el más avanzado conocido). */
  estatus: EstatusViaje;
  /** true = ese estatus aún no lo refleja el servidor (lo reportó el operador y está pendiente o por confirmar). */
  porReporte: boolean;
  /** Si viene de un reporte: su estado local (pendiente, por-confirmar…). */
  estadoReporte: string | null;
}

/** Estatus efectivo: el más avanzado entre el del servidor y lo que el operador ya reportó (y no fue rechazado). */
export function guia(v: Viaje, reportes: readonly ReporteParaGuia[]): Guia {
  let mejor: Guia = { estatus: v.estatus, porReporte: false, estadoReporte: null };
  let rangoMejor = rango(v.tipo, v.estatus);
  for (const r of reportes) {
    if (r.reporte.viajeId !== v.id || r.reporte.tipo !== 'estatus' || !cuenta(r)) continue;
    const k = rango(v.tipo, r.reporte.estatus);
    if (k > rangoMejor) {
      rangoMejor = k;
      mejor = { estatus: r.reporte.estatus, porReporte: true, estadoReporte: r.estado };
    }
  }
  return mejor;
}

/** Pasos que todavía se le ofrecen (solo hacia adelante desde el estatus efectivo). El primero es el siguiente lógico. */
export function pasosDisponibles(v: Viaje, reportes: readonly ReporteParaGuia[]): EstatusViaje[] {
  const actual = rango(v.tipo, guia(v, reportes).estatus);
  return pasosOperador(v).filter((e) => rango(v.tipo, e) > actual);
}

/** ¿El operador ya hizo su parte? (cargado: Descargado; vacío: llegó). Cerrado lo pone la oficina. */
export function operadorTermino(v: Viaje, reportes: readonly ReporteParaGuia[]): boolean {
  return pasosDisponibles(v, reportes).length === 0;
}

function enOrden(salida: Salida): Viaje[] {
  return [...salida.viajes].sort((a, b) => a.orden - b.orden);
}

/** Viaje que toca: el primero, en orden, en el que el operador aún tiene pasos por reportar. */
export function viajeQueToca(salida: Salida | null, reportes: readonly ReporteParaGuia[]): Viaje | null {
  if (!salida) return null;
  return enOrden(salida).find((v) => v.estatus !== 'Cerrado' && !operadorTermino(v, reportes)) ?? null;
}

/**
 * Viaje activo (para incidencias): el que toca o, si el operador ya terminó todo, el último que la oficina aún no cierra.
 * null = no hay viaje activo.
 */
export function viajeActivo(salida: Salida | null, reportes: readonly ReporteParaGuia[]): Viaje | null {
  if (!salida) return null;
  return viajeQueToca(salida, reportes) ?? enOrden(salida).filter((v) => v.estatus !== 'Cerrado').at(-1) ?? null;
}

export function viajesEnOrden(salida: Salida | null): Viaje[] {
  return salida ? enOrden(salida) : [];
}

export function origenDestino(v: Viaje): { origen: string; destino: string } {
  if (v.tipo === 'cargado') return { origen: v.origen, destino: v.destino };
  const t = [...v.tramos].sort((a, b) => a.orden - b.orden);
  return { origen: t[0]?.origen ?? '', destino: t.at(-1)?.destino ?? '' };
}

/** "Viaje 2 · Cargado · Apodaca, N.L. → Saltillo, Coah." */
export function tituloViaje(v: Viaje): string {
  const { origen, destino } = origenDestino(v);
  return `Viaje ${v.orden} · ${v.tipo === 'cargado' ? 'Cargado' : 'Vacío'} · ${origen} → ${destino}`;
}
