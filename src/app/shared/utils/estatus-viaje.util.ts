/**
 * Estatus del viaje y lo que el operador puede reportar. PURO.
 *
 * Reglas (Carolina, 23/11/2026, y contrato M1):
 *  - Solo hacia adelante; se pueden saltar intermedios. Asignado, Cerrado y Cancelado no los pone el operador.
 *  - Documentado y Descargado son HITOS: quedan pendientes de confirmar por la oficina (ahí captura toneladas y estadía).
 *  - La oficina puede avanzar el viaje sin esperar al operador: la app guía desde el estatus más avanzado que conozca
 *    (el del servidor o lo que el operador ya reportó y cuenta como hecho).
 *  - Un viaje Cancelado se muestra, pero no ofrece reportes.
 */
import { ESTATUS_CARGADO, EstatusViaje, MotivoTramoVacio, ReporteOperador, ResultadoReporte, Salida, Viaje, ViajeVacio } from '../../core/api/operador-api.modelos';
import { cuentaComoHecho } from './cola-reportes.util';

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
  Cancelado: 'Cancelado',
  EnTransitoVacio: 'En tránsito (vacío)',
  EnPatio: 'En patio',
  EnTaller: 'En taller',
};

/** Texto de un estatus; si el servidor mandara uno desconocido, se muestra tal cual. */
export function textoEstatus(e: EstatusViaje): string {
  return ETIQUETA_ESTATUS[e] ?? e;
}

/** Motivo del tramo vacío: valor del backend → texto en pantalla. */
export const ETIQUETA_MOTIVO: Readonly<Record<MotivoTramoVacio, string>> = {
  Posicionamiento: 'Posicionamiento',
  CargaCombustible: 'Carga de combustible',
  Taller: 'Taller',
  Otro: 'Otro',
};

export function textoMotivo(m: MotivoTramoVacio): string {
  return ETIQUETA_MOTIVO[m] ?? m;
}

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

/** Cómo se ve un estatus: texto y colores (fondo y letra). */
export interface PresentacionEstatus {
  texto: string;
  fondo: string;
  tinta: string;
}

/**
 * Colores por etapa (todos con contraste ≥ 7:1, se verifica en pruebas). El azul de la marca queda para los botones,
 * para que una etiqueta de estatus no se confunda con algo que se toca.
 */
const COLORES_ETAPA = {
  asignado: { fondo: '#3d4654', tinta: '#ffffff' }, // gris: aún no empieza
  camino: { fondo: '#7a3400', tinta: '#ffffff' }, // café-naranja: en carretera
  patio: { fondo: '#0b5563', tinta: '#ffffff' }, // verde azulado: esperando en patio
  maniobra: { fondo: '#5b2a86', tinta: '#ffffff' }, // morado: cargando o descargando
  hito: { fondo: '#0d5c27', tinta: '#ffffff' }, // verde: documentado o descargado
  taller: { fondo: '#a1121a', tinta: '#ffffff' }, // rojo: en taller
  cerrado: { fondo: '#e4e7eb', tinta: '#0b0f14' }, // claro: ya terminó
  cancelado: { fondo: '#fde3e4', tinta: '#5c0005' }, // rosa con letra vino: cancelado por la oficina
} as const;

const ETAPA: Readonly<Record<EstatusViaje, keyof typeof COLORES_ETAPA>> = {
  Asignado: 'asignado',
  EnPosicionamiento: 'camino',
  EnPatioOrigen: 'patio',
  EnCarga: 'maniobra',
  Documentado: 'hito',
  EnTransito: 'camino',
  EnPatioDestino: 'patio',
  EnDescarga: 'maniobra',
  Descargado: 'hito',
  Cerrado: 'cerrado',
  Cancelado: 'cancelado',
  EnTransitoVacio: 'camino',
  EnPatio: 'patio',
  EnTaller: 'taller',
};

/** ÚNICA fuente de texto y color de un estatus en pantalla. Uno desconocido se ve gris con su nombre. */
export function presentacionEstatus(e: EstatusViaje): PresentacionEstatus {
  return { texto: textoEstatus(e), ...COLORES_ETAPA[ETAPA[e] ?? 'asignado'] };
}

export const HITOS: ReadonlySet<EstatusViaje> = new Set<EstatusViaje>(['Documentado', 'Descargado']);

/** Estatus que el operador puede poner en un viaje cargado, en orden. */
export const PASOS_CARGADO: readonly EstatusViaje[] = ESTATUS_CARGADO.filter((e) => e !== 'Asignado' && e !== 'Cerrado');

/** Estatus en los que el viaje ya no admite reportes. */
export function viajeTerminado(v: Viaje): boolean {
  return v.estatus === 'Cerrado' || v.estatus === 'Cancelado';
}

export function esHito(e: EstatusViaje): boolean {
  return HITOS.has(e);
}

/** Rango de Cancelado: más allá de todo, para que nada se ofrezca después. */
const RANGO_CANCELADO = 100;

/** Posición del estatus en su secuencia (EnPatio y EnTaller comparten lugar). -1 si no pertenece al tipo de viaje. */
export function rango(tipo: Viaje['tipo'], e: EstatusViaje): number {
  if (e === 'Cancelado') return RANGO_CANCELADO;
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
  return BOTON_ESTATUS[e] ?? textoEstatus(e);
}

/** Lo mínimo de un reporte local para calcular la guía (sirve con ReporteLocal). */
export interface ReporteParaGuia {
  reporte: ReporteOperador;
  estado: string;
  resultado: ResultadoReporte | null;
}

export interface Guia {
  /** Estatus desde el que se guía (el más avanzado conocido). */
  estatus: EstatusViaje;
  /** true = ese estatus aún no lo refleja el servidor (lo reportó el operador y está pendiente o por confirmar). */
  porReporte: boolean;
  /** Si viene de un reporte: su estado local (pendiente, por-confirmar…). */
  estadoReporte: string | null;
}

/** Estatus efectivo: el más avanzado entre el del servidor y lo que el operador ya reportó (y cuenta como hecho). */
export function guia(v: Viaje, reportes: readonly ReporteParaGuia[]): Guia {
  let mejor: Guia = { estatus: v.estatus, porReporte: false, estadoReporte: null };
  let rangoMejor = rango(v.tipo, v.estatus);
  for (const r of reportes) {
    if (r.reporte.viajeId !== v.id || r.reporte.tipo !== 'estatus' || !cuentaComoHecho(r)) continue;
    const k = rango(v.tipo, r.reporte.estatus);
    if (k > rangoMejor) {
      rangoMejor = k;
      mejor = { estatus: r.reporte.estatus, porReporte: true, estadoReporte: r.estado };
    }
  }
  return mejor;
}

/** Aclaración junto al estatus cuando viene de un reporte que el servidor aún no refleja. */
export function marcaDeGuia(g: Guia): string | null {
  if (!g.porReporte) return null;
  if (g.estadoReporte === 'pendiente') return 'Pendiente de enviar';
  if (g.estadoReporte === 'por-confirmar') return 'Pendiente de confirmar por oficina';
  return null;
}

/** Pasos que todavía se le ofrecen (solo hacia adelante desde el estatus efectivo). El primero es el siguiente lógico. */
export function pasosDisponibles(v: Viaje, reportes: readonly ReporteParaGuia[]): EstatusViaje[] {
  if (viajeTerminado(v)) return [];
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

/** Viaje que toca: el primero, en orden, sin cerrar ni cancelar, en el que el operador aún tiene pasos por reportar. */
export function viajeQueToca(salida: Salida | null, reportes: readonly ReporteParaGuia[]): Viaje | null {
  if (!salida) return null;
  return enOrden(salida).find((v) => !viajeTerminado(v) && !operadorTermino(v, reportes)) ?? null;
}

/**
 * Viaje activo (para incidencias): el que toca o, si el operador ya terminó todo, el último que la oficina aún no
 * cierra. null = no hay viaje activo (sin salida, o todos cerrados o cancelados).
 */
export function viajeActivo(salida: Salida | null, reportes: readonly ReporteParaGuia[]): Viaje | null {
  if (!salida) return null;
  return viajeQueToca(salida, reportes) ?? enOrden(salida).filter((v) => !viajeTerminado(v)).at(-1) ?? null;
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
