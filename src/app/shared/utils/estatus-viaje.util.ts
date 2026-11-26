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
import { ESTATUS_CARGADO, EnvioOperador, EstatusViaje, MotivoTramoVacio, ResultadoReporte, ResultadoTermino, Salida, Viaje, ViajeVacio } from '../../core/api/operador-api.modelos';
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

/** Texto del botón que pone cada estatus, en palabras del operador. El estatus en pantalla conserva su nombre formal. */
export const BOTON_ESTATUS: Readonly<Partial<Record<EstatusViaje, string>>> = {
  EnPosicionamiento: 'Voy por la carga',
  EnPatioOrigen: 'Ya llegué a cargar',
  EnCarga: 'Ya me están cargando',
  Documentado: 'Ya cargué',
  EnTransito: 'Ya salí',
  EnPatioDestino: 'Ya llegué a descargar',
  EnDescarga: 'Ya me están descargando',
  Descargado: 'Ya descargué',
  EnTransitoVacio: 'Ya salí',
  EnPatio: 'Ya llegué',
  EnTaller: 'Ya llegué al taller',
};

/** Línea de ayuda arriba del botón principal: cuándo tocarlo. */
export const AYUDA_PASO: Readonly<Partial<Record<EstatusViaje, string>>> = {
  EnPosicionamiento: 'Toque al salir hacia la carga',
  EnPatioOrigen: 'Toque al llegar al lugar de carga',
  EnCarga: 'Toque cuando empiecen a cargar',
  Documentado: 'Toque cuando termine la carga',
  EnTransito: 'Toque al salir hacia la descarga',
  EnPatioDestino: 'Toque al llegar al lugar de descarga',
  EnDescarga: 'Toque cuando empiecen a descargar',
  Descargado: 'Toque cuando terminen de descargar',
  EnTransitoVacio: 'Toque al salir',
  EnPatio: 'Toque al llegar al patio',
  EnTaller: 'Toque al llegar al taller',
};

export function ayudaPaso(e: EstatusViaje): string {
  return AYUDA_PASO[e] ?? 'Toque cuando suceda';
}

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
  reporte: EnvioOperador;
  estado: string;
  resultado: ResultadoReporte | ResultadoTermino | null;
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
    if (r.reporte.tipo !== 'estatus' || r.reporte.viajeId !== v.id || !cuentaComoHecho(r)) continue;
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

/** Avance para la barra de pasos: un segmento por paso del operador; llenos los ya hechos. */
export interface AvanceViaje {
  total: number;
  hechos: number;
}

/**
 * Cuántos pasos del operador ya están hechos (según el estatus efectivo: servidor o lo que ya reportó). Cerrado = todos.
 * Cancelado no tiene avance que mostrar (null).
 */
export function avanceViaje(v: Viaje, reportes: readonly ReporteParaGuia[]): AvanceViaje | null {
  if (v.estatus === 'Cancelado') return null;
  const pasos = pasosOperador(v);
  if (v.estatus === 'Cerrado') return { total: pasos.length, hechos: pasos.length };
  const actual = rango(v.tipo, guia(v, reportes).estatus);
  return { total: pasos.length, hechos: pasos.filter((e) => rango(v.tipo, e) <= actual).length };
}

// ---------------------------------------------------------------- Paso actual ("Usted está aquí")

/** Todos los estatus del viaje, en orden, incluidos los que pone la oficina (Asignado y Cerrado). */
export function pasosDelViaje(v: Viaje): readonly EstatusViaje[] {
  return v.tipo === 'cargado' ? ESTATUS_CARGADO : ['Asignado', 'EnTransitoVacio', llegadaVacio(v), 'Cerrado'];
}

/** "paso 4 de 10": en qué estatus va (el efectivo) dentro de todos los del viaje. null si está cancelado. */
export function posicionPaso(v: Viaje, reportes: readonly ReporteParaGuia[]): { n: number; total: number } | null {
  if (v.estatus === 'Cancelado') return null;
  const pasos = pasosDelViaje(v);
  const k = rango(v.tipo, guia(v, reportes).estatus);
  return k < 0 ? null : { n: Math.min(k, pasos.length - 1) + 1, total: pasos.length };
}

/** Hitos que se dibujan en la línea de avance, con su nombre corto. */
function hitosDeLinea(v: Viaje): { estatus: EstatusViaje; texto: string }[] {
  if (v.tipo === 'cargado') {
    return [
      { estatus: 'Asignado', texto: 'Asignado' },
      { estatus: 'Documentado', texto: 'Cargado' },
      { estatus: 'Descargado', texto: 'Descargado' },
      { estatus: 'Cerrado', texto: 'Cerrado' },
    ];
  }
  const llegada = llegadaVacio(v);
  return [
    { estatus: 'Asignado', texto: 'Asignado' },
    { estatus: 'EnTransitoVacio', texto: 'En tránsito' },
    { estatus: llegada, texto: llegada === 'EnTaller' ? 'En taller' : 'En patio' },
    { estatus: 'Cerrado', texto: 'Cerrado' },
  ];
}

/**
 * Pieza de la línea de avance: punto de un hito, tramo entre dos (su `largo` en pasos, para el ancho) o el marcador
 * amarillo de "usted está aquí", en la posición real (dentro de un tramo, o sobre el hito si va justo en él).
 */
export type PiezaLinea = { tipo: 'punto'; pasado: boolean } | { tipo: 'tramo'; largo: number; pasado: boolean } | { tipo: 'marcador' };

export interface LineaHitos {
  piezas: PiezaLinea[];
  etiquetas: { texto: string; pasado: boolean }[];
}

/** Línea de avance por hitos con el marcador en la posición real. null si el viaje está cancelado. */
export function lineaHitos(v: Viaje, reportes: readonly ReporteParaGuia[]): LineaHitos | null {
  if (v.estatus === 'Cancelado') return null;
  const actual = rango(v.tipo, guia(v, reportes).estatus);
  const hitos = hitosDeLinea(v).map((h) => ({ ...h, k: rango(v.tipo, h.estatus) }));
  const piezas: PiezaLinea[] = [];
  hitos.forEach((h, i) => {
    piezas.push(h.k === actual ? { tipo: 'marcador' } : { tipo: 'punto', pasado: h.k < actual });
    const sig = hitos[i + 1];
    if (!sig) return;
    if (h.k < actual && actual < sig.k) {
      piezas.push({ tipo: 'tramo', largo: actual - h.k, pasado: true }, { tipo: 'marcador' }, { tipo: 'tramo', largo: sig.k - actual, pasado: false });
    } else {
      piezas.push({ tipo: 'tramo', largo: sig.k - h.k, pasado: sig.k <= actual });
    }
  });
  return { piezas, etiquetas: hitos.map((h) => ({ texto: h.texto, pasado: h.k <= actual })) };
}

/**
 * Desde cuándo está en el estatus efectivo: la hora del reporte del operador si aún no lo refleja el servidor; si no,
 * la del último evento de ese estatus en el historial. null si no se sabe.
 */
export function desdeEstatus(v: Viaje, reportes: readonly ReporteParaGuia[]): string | null {
  const g = guia(v, reportes);
  if (g.porReporte) {
    const r = reportes.find((x) => x.reporte.tipo === 'estatus' && x.reporte.viajeId === v.id && x.reporte.estatus === g.estatus && cuentaComoHecho(x));
    if (r && r.reporte.tipo === 'estatus') return r.reporte.ocurrioEn;
  }
  const ev = [...v.historial].reverse().find((e) => e.tipo === 'estatus' && e.estatus === g.estatus);
  return ev?.ocurrioEn ?? null;
}
