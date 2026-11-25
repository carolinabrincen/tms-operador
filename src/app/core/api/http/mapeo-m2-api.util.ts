/**
 * Traducción entre la API real (contrato M2: hoja de ruta y evidencias) y los modelos de la app. PURO.
 *
 * Lista blanca, como en M1: cada objeto se arma campo por campo. Lo que el servidor mande de más (p. ej. un importe de
 * casetas o de diésel) NO llega a la app. Si faltan los indispensables es un error del servidor; nunca se adivina.
 */
import {
  AcuseEvidencia,
  DatosEvidencia,
  EstadoRemotoEvidencia,
  EvidenciaViaje,
  HojaRuta,
  LugarHoja,
  ParadaHoja,
  PlazaCobroHoja,
  RutaHoja,
  TiempoHoja,
  TipoEvidencia,
  TipoParada,
  TramoHoja,
} from '../operador-api-m2.modelos';
import { MotivoTramoVacio } from '../operador-api.modelos';
import { Obj, esObj, invalida, num, numONull, obj, txt, txtONull } from './mapeo-api.util';

const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const boolONull = (o: Obj, k: string): boolean | null => (typeof o[k] === 'boolean' ? (o[k] as boolean) : null);
const porOrden = <T extends { orden: number }>(xs: T[]) => [...xs].sort((a, b) => a.orden - b.orden);

/** Solo ligas https: el botón "Abrir en mapa" nunca abre otra cosa. */
export function ligaSegura(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  try {
    return new URL(v).protocol === 'https:' ? v : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ hoja de ruta

function tiempoDesdeApi(v: unknown): TiempoHoja | null {
  if (!esObj(v)) return null;
  const horas = numONull(v, 'horas');
  const minutos = numONull(v, 'minutos');
  return horas == null && minutos == null ? null : { horas: horas ?? 0, minutos: minutos ?? 0 };
}

function lugarDesdeApi(v: unknown, que: string): LugarHoja {
  const o = obj(v, que);
  return { lugar: txt(o, 'lugar', que), direccion: txtONull(o, 'direccion'), descripcion: txtONull(o, 'descripcion') };
}

function paradaDesdeApi(v: unknown): ParadaHoja {
  const o = obj(v, 'parada');
  return {
    orden: num(o, 'orden', 'parada'),
    tipo: txt(o, 'tipo', 'parada') as TipoParada,
    referencia: txtONull(o, 'referencia'),
    notas: txtONull(o, 'notas'),
    direccion: txtONull(o, 'direccion'),
    lat: numONull(o, 'lat'),
    lng: numONull(o, 'lng'),
  };
}

function plazaDesdeApi(v: unknown): PlazaCobroHoja {
  const o = obj(v, 'plazaCobro');
  return { orden: num(o, 'orden', 'plazaCobro'), nombre: txt(o, 'nombre', 'plazaCobro'), autopista: txtONull(o, 'autopista') };
}

function rutaDesdeApi(v: unknown): RutaHoja | null {
  if (v == null) return null;
  const o = obj(v, 'ruta');
  return {
    nombre: txtONull(o, 'nombre'),
    km: numONull(o, 'km'),
    tiempo: tiempoDesdeApi(o['tiempo']),
    paradas: porOrden(lista(o['paradas']).map(paradaDesdeApi)),
    plazasCobro: porOrden(lista(o['plazasCobro']).map(plazaDesdeApi)),
    ligaMapa: ligaSegura(o['ligaMapa']),
  };
}

function tramoHojaDesdeApi(v: unknown): TramoHoja {
  const o = obj(v, 'itinerario');
  const tipo = o['tipo'] === 'cargado' || o['tipo'] === 'vacio' ? o['tipo'] : invalida('itinerario.tipo');
  return {
    orden: num(o, 'orden', 'itinerario'),
    tipo,
    folio: txtONull(o, 'folio'),
    cliente: txtONull(o, 'cliente'),
    origen: lugarDesdeApi(o['origen'], 'itinerario.origen'),
    destino: lugarDesdeApi(o['destino'], 'itinerario.destino'),
    citaCarga: txtONull(o, 'citaCarga'),
    citaDescarga: txtONull(o, 'citaDescarga'),
    producto: txtONull(o, 'producto'),
    materialPeligroso: boolONull(o, 'materialPeligroso'),
    toneladasProgramadas: numONull(o, 'toneladasProgramadas'),
    referencia: txtONull(o, 'referencia'),
    notas: txtONull(o, 'notas'),
    motivo: txtONull(o, 'motivo') as MotivoTramoVacio | null,
    motivoNota: txtONull(o, 'motivoNota'),
    km: numONull(o, 'km'),
    ruta: rutaDesdeApi(o['ruta']),
  };
}

/** `{ hojaRuta: null | HojaRuta }` → HojaRuta o null (sin salida activa). */
export function hojaRutaDesdeApi(json: unknown): HojaRuta | null {
  const raiz = obj(json, 'hoja de ruta');
  if (raiz['hojaRuta'] == null) return null;
  const o = obj(raiz['hojaRuta'], 'hojaRuta');
  const op = esObj(o['operador']) ? o['operador'] : {};
  const u = obj(o['unidad'], 'hojaRuta.unidad');
  return {
    folio: txt(o, 'folio', 'hojaRuta'),
    generadaEn: txt(o, 'generadaEn', 'hojaRuta'),
    empresa: txtONull(o, 'empresa') ?? '',
    telefonoEmpresa: txtONull(o, 'telefonoEmpresa'),
    telefonoTrafico: txtONull(o, 'telefonoTrafico'),
    salidaProgramada: txtONull(o, 'salidaProgramada'),
    finEstimado: txtONull(o, 'finEstimado'),
    notas: txtONull(o, 'notas'),
    operador: { nombre: txtONull(op, 'nombre') ?? '', licenciaTipo: txtONull(op, 'licenciaTipo'), licenciaNumero: txtONull(op, 'licenciaNumero') },
    unidad: {
      numeroEconomico: txt(u, 'numeroEconomico', 'hojaRuta.unidad'),
      placas: txtONull(u, 'placas'),
      configuracion: txtONull(u, 'configuracion'),
      remolques: lista(u['remolques']).map((r) => {
        const x = obj(r, 'remolque');
        return { numeroEconomico: txt(x, 'numeroEconomico', 'remolque'), placas: txtONull(x, 'placas') };
      }),
    },
    itinerario: porOrden(lista(o['itinerario']).map(tramoHojaDesdeApi)),
    kmPlaneados: numONull(o, 'kmPlaneados'),
    tiempoEstimado: tiempoDesdeApi(o['tiempoEstimado']),
  };
}

// ------------------------------------------------------------------ evidencias

/**
 * Campos de texto del multipart (2.1). Lo null no se manda. Los números van con punto decimal (String(número) siempre
 * usa punto). La ubicación va completa o no va: lat y lng juntas; precisión y hora solo con coordenadas.
 */
export function camposEvidencia(d: DatosEvidencia): [string, string][] {
  const campos: [string, string][] = [
    ['id', d.id],
    ['viajeId', d.viajeId],
    ['tipo', d.tipo],
  ];
  if (d.descripcion) campos.push(['descripcion', d.descripcion]);
  if (d.nota) campos.push(['nota', d.nota]);
  if (d.reporteId) campos.push(['reporteId', d.reporteId]);
  if (d.tomadaEn) campos.push(['tomadaEn', d.tomadaEn]);
  if (d.ubicacion) {
    campos.push(['lat', String(d.ubicacion.lat)], ['lng', String(d.ubicacion.lng)]);
    if (d.ubicacion.precisionM != null) campos.push(['precisionM', String(d.ubicacion.precisionM)]);
    if (d.ubicacion.tomadoEn) campos.push(['ubicacionTomadaEn', d.ubicacion.tomadoEn]);
  }
  return campos;
}

/** Nombre del archivo en el multipart (el servidor revisa el contenido, no la extensión). */
export function nombreArchivoEvidencia(id: string, tipoContenido: string): string {
  return `${id}.${tipoContenido === 'image/png' ? 'png' : 'jpg'}`;
}

export function acuseEvidenciaDesdeApi(json: unknown): AcuseEvidencia {
  const o = obj(json, 'acuse de evidencia');
  return { id: txt(o, 'id', 'acuse de evidencia'), recibidaEn: txt(o, 'recibidaEn', 'acuse de evidencia'), mensaje: txtONull(o, 'mensaje') };
}

export function estadosEvidenciaDesdeApi(json: unknown): EstadoRemotoEvidencia[] {
  if (!Array.isArray(json)) invalida('estado de evidencias');
  return json.map((v) => {
    const o = obj(v, 'estado de evidencia');
    const estado = o['estado'] === 'recibida' || o['estado'] === 'anulada' ? o['estado'] : invalida('estado de evidencia.estado');
    return { id: txt(o, 'id', 'estado de evidencia'), estado, motivo: estado === 'anulada' ? txtONull(o, 'motivo') : null };
  });
}

export function evidenciasDeViajeDesdeApi(json: unknown): EvidenciaViaje[] {
  if (!Array.isArray(json)) invalida('evidencias');
  return json.map((v) => {
    const o = obj(v, 'evidencia');
    return {
      id: txt(o, 'id', 'evidencia'),
      viajeId: txt(o, 'viajeId', 'evidencia'),
      tipo: txt(o, 'tipo', 'evidencia') as TipoEvidencia,
      descripcion: txtONull(o, 'descripcion'),
      nota: txtONull(o, 'nota'),
      contentType: txtONull(o, 'contentType'),
      tamanoBytes: numONull(o, 'tamanoBytes'),
      subidaEn: txt(o, 'subidaEn', 'evidencia'),
      tomadaEn: txtONull(o, 'tomadaEn'),
      // Lo que no sea "operador" se trata como de la oficina: nunca se pide su archivo.
      autor: o['autor'] === 'operador' ? 'operador' : 'oficina',
    };
  });
}
