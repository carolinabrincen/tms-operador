/**
 * Traducción entre la API real (contrato M1) y los modelos de la app. PURO.
 *
 * Lista blanca: cada objeto se arma campo por campo; lo que el servidor mande de más (p. ej. un importe) NO llega a la
 * app. Una respuesta sin los campos indispensables es un error del servidor (se reintenta), nunca se adivina.
 */
import { ErrorApiOperador } from '../operador-api';
import {
  AcuseReporte,
  AsignacionOperador,
  Autor,
  EstadoRemotoReporte,
  EstatusViaje,
  EventoViaje,
  MotivoTramoVacio,
  ReporteOperador,
  ResultadoReporte,
  Salida,
  SesionOperador,
  TipoIncidencia,
  TramoVacio,
  Unidad,
  Viaje,
} from '../operador-api.modelos';

/** Token y refresh de la sesión (contrato 1.1). Solo los conoce la implementación de la API. */
export interface Credenciales {
  token: string;
  expiraEn: string;
  refreshToken: string;
  refreshExpiraEn: string;
}

const RESULTADOS: readonly ResultadoReporte[] = ['aplicado', 'por-confirmar', 'confirmado', 'registrado', 'sin-efecto', 'descartado'];

function invalida(que: string): never {
  // Sin datos de la respuesta en el mensaje (podría traer tokens).
  throw new ErrorApiOperador('servidor', `Respuesta inesperada del servidor (${que}).`);
}

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
function obj(v: unknown, que: string): Obj {
  return esObj(v) ? v : invalida(que);
}
function txt(o: Obj, k: string, que: string): string {
  const v = o[k];
  return typeof v === 'string' ? v : invalida(`${que}.${k}`);
}
function txtONull(o: Obj, k: string): string | null {
  const v = o[k];
  return typeof v === 'string' ? v : null;
}
function num(o: Obj, k: string, que: string): number {
  const v = o[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : invalida(`${que}.${k}`);
}
function numONull(o: Obj, k: string): number | null {
  const v = o[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// ------------------------------------------------------------------ sesión

export function sesionDesdeApi(json: unknown): { perfil: SesionOperador; credenciales: Credenciales } {
  const o = obj(json, 'sesión');
  return {
    perfil: { operadorId: txt(o, 'operadorId', 'sesión'), nombre: txt(o, 'nombre', 'sesión'), celularTerminacion: txtONull(o, 'celularTerminacion') ?? '' },
    credenciales: {
      token: txt(o, 'token', 'sesión'),
      expiraEn: txt(o, 'expiraEn', 'sesión'),
      refreshToken: txt(o, 'refreshToken', 'sesión'),
      refreshExpiraEn: txt(o, 'refreshExpiraEn', 'sesión'),
    },
  };
}

// ------------------------------------------------------------------ asignación

function unidadDesdeApi(v: unknown): Unidad {
  const o = obj(v, 'unidad');
  const remolques = Array.isArray(o['remolques']) ? o['remolques'].filter((x): x is string => typeof x === 'string') : [];
  return { numeroEconomico: txt(o, 'numeroEconomico', 'unidad'), placas: txtONull(o, 'placas') ?? '', configuracion: txtONull(o, 'configuracion') ?? '', remolques };
}

function eventoDesdeApi(v: unknown): EventoViaje | null {
  const o = obj(v, 'historial');
  const comun = {
    nota: txtONull(o, 'nota'),
    ocurrioEn: txt(o, 'ocurrioEn', 'historial'),
    autor: (o['autor'] === 'operador' ? 'operador' : 'oficina') as Autor,
    reporteId: txtONull(o, 'reporteId'),
  };
  if (o['tipo'] === 'estatus' && typeof o['estatus'] === 'string') return { tipo: 'estatus', estatus: o['estatus'] as EstatusViaje, ...comun };
  if (o['tipo'] === 'incidencia' && typeof o['incidencia'] === 'string') return { tipo: 'incidencia', incidencia: o['incidencia'] as TipoIncidencia, ...comun };
  return null; // tipo desconocido: se ignora
}

function tramoDesdeApi(v: unknown): TramoVacio {
  const o = obj(v, 'tramo');
  return { orden: num(o, 'orden', 'tramo'), motivo: txt(o, 'motivo', 'tramo') as MotivoTramoVacio, origen: txt(o, 'origen', 'tramo'), destino: txt(o, 'destino', 'tramo') };
}

function viajeDesdeApi(v: unknown): Viaje {
  const o = obj(v, 'viaje');
  const base = {
    id: txt(o, 'id', 'viaje'),
    folio: txt(o, 'folio', 'viaje'),
    orden: num(o, 'orden', 'viaje'),
    notas: txtONull(o, 'notas'),
    historial: (Array.isArray(o['historial']) ? o['historial'] : []).map(eventoDesdeApi).filter((e): e is EventoViaje => !!e),
  };
  if (o['tipo'] === 'vacio') {
    return { ...base, tipo: 'vacio', estatus: txt(o, 'estatus', 'viaje') as ViajeVacioEstatus, tramos: (Array.isArray(o['tramos']) ? o['tramos'] : []).map(tramoDesdeApi) };
  }
  if (o['tipo'] !== 'cargado') invalida('viaje.tipo');
  return {
    ...base,
    tipo: 'cargado',
    estatus: txt(o, 'estatus', 'viaje') as ViajeCargadoEstatus,
    cliente: txtONull(o, 'cliente') ?? '',
    origen: txtONull(o, 'origen') ?? '',
    destino: txtONull(o, 'destino') ?? '',
    citaCarga: txtONull(o, 'citaCarga'),
    citaDescarga: txtONull(o, 'citaDescarga'),
    producto: txtONull(o, 'producto') ?? '',
    toneladasProgramadas: numONull(o, 'toneladasProgramadas'),
    referencia: txtONull(o, 'referencia'),
  };
}
type ViajeVacioEstatus = Extract<Viaje, { tipo: 'vacio' }>['estatus'];
type ViajeCargadoEstatus = Extract<Viaje, { tipo: 'cargado' }>['estatus'];

export function asignacionDesdeApi(json: unknown): AsignacionOperador {
  const o = obj(json, 'asignación');
  if (o['salida'] == null) return { salida: null };
  const s = obj(o['salida'], 'salida');
  const salida: Salida = {
    id: txt(s, 'id', 'salida'),
    folio: txt(s, 'folio', 'salida'),
    notas: txtONull(s, 'notas'),
    unidad: unidadDesdeApi(s['unidad']),
    viajes: (Array.isArray(s['viajes']) ? s['viajes'] : invalida('salida.viajes')).map(viajeDesdeApi),
  };
  return { salida };
}

// ------------------------------------------------------------------ reportes

/** Cuerpo de POST api/operador/reportes. Estatus sin `incidencia`; incidencia sin `estatus`. */
export function reporteParaApi(r: ReporteOperador): Record<string, unknown> {
  const ubicacion = r.ubicacion
    ? { lat: r.ubicacion.lat, lng: r.ubicacion.lng, precisionM: r.ubicacion.precisionM, tomadoEn: r.ubicacion.tomadoEn }
    : null;
  const comun = { id: r.id, viajeId: r.viajeId, tipo: r.tipo, ocurrioEn: r.ocurrioEn, ubicacion, nota: r.nota };
  return r.tipo === 'estatus' ? { ...comun, estatus: r.estatus } : { ...comun, incidencia: r.incidencia };
}

function resultadoDesdeApi(v: unknown): ResultadoReporte {
  return typeof v === 'string' && (RESULTADOS as readonly string[]).includes(v) ? (v as ResultadoReporte) : invalida('resultado');
}

export function acuseDesdeApi(json: unknown): AcuseReporte {
  const o = obj(json, 'acuse');
  return { id: txt(o, 'id', 'acuse'), recibidoEn: txt(o, 'recibidoEn', 'acuse'), resultado: resultadoDesdeApi(o['resultado']), mensaje: txtONull(o, 'mensaje') };
}

export function estadosDesdeApi(json: unknown): EstadoRemotoReporte[] {
  if (!Array.isArray(json)) invalida('estado');
  return json.map((v) => {
    const o = obj(v, 'estado');
    const resultado = resultadoDesdeApi(o['resultado']);
    return { id: txt(o, 'id', 'estado'), resultado, confirmadoEn: resultado === 'confirmado' ? txtONull(o, 'confirmadoEn') : null, mensaje: txtONull(o, 'mensaje') };
  });
}

/** Límite del contrato para POST reportes/estado. */
export const MAX_IDS_ESTADO = 200;
