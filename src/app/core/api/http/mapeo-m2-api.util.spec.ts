import { DatosEvidencia } from '../operador-api-m2.modelos';
import {
  acuseEvidenciaDesdeApi,
  camposEvidencia,
  estadosEvidenciaDesdeApi,
  evidenciasDeViajeDesdeApi,
  hojaRutaDesdeApi,
  ligaSegura,
  nombreArchivoEvidencia,
} from './mapeo-m2-api.util';
import { HOJA_RUTA_API } from '../../../testing/respuestas-api';

/** Lo que nunca debe llegar a la app (M2: tampoco casetas en pesos ni diésel). */
const CAMPOS_DINERO = /tarifa|ingreso|costo|utilidad|pago|precio|importe|flete|monto|margen|sueldo|comision|comisión|pesos|diesel|diésel/i;

function llaves(valor: unknown, acc: string[] = []): string[] {
  if (Array.isArray(valor)) valor.forEach((v) => llaves(v, acc));
  else if (valor && typeof valor === 'object') for (const [k, v] of Object.entries(valor)) acc.push(k), llaves(v, acc);
  return acc;
}

describe('mapeo-m2-api.util: hoja de ruta y evidencias (contrato M2), con lista blanca', () => {
  it('hoja de ruta del contrato → modelo de la app', () => {
    const h = hojaRutaDesdeApi(HOJA_RUTA_API)!;
    expect(h.folio).toBe('DSP-000123');
    expect(h.telefonoTrafico).toBe('800 123 4567');
    expect(h.finEstimado).toBe('2026-11-27');
    expect(h.unidad.remolques).toEqual([{ numeroEconomico: 'C-07', placas: '45-XY' }]);
    expect(h.itinerario.map((t) => t.orden)).toEqual([1, 2]);
    const cargado = h.itinerario[1];
    expect(cargado.origen).toEqual({ lugar: 'Apaseo el Grande, Guanajuato', direccion: 'Carretera 45 km 3, Centro, C.P. 38160', descripcion: 'Planta' });
    expect(cargado.materialPeligroso).toBe(false);
    expect(cargado.ruta!.paradas[0]).toEqual({ orden: 1, tipo: 'Descanso', referencia: 'Parador km 80', notas: null, direccion: null, lat: 19.5, lng: -99.2 });
    expect(cargado.ruta!.plazasCobro).toEqual([{ orden: 1, nombre: 'Plaza Norte', autopista: 'Libramiento' }]);
    expect(cargado.ruta!.ligaMapa).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\//);
    expect(cargado.ruta!.tiempo).toEqual({ horas: 9, minutos: 30 });
    expect(h.itinerario[0]).toMatchObject({ tipo: 'vacio', motivo: 'Posicionamiento', ruta: null });
  });

  it('sin salida activa: { hojaRuta: null } → null', () => {
    expect(hojaRutaDesdeApi({ hojaRuta: null })).toBeNull();
  });

  it('GUARDA DE DINERO: lo que el servidor mande de más (importes de casetas, diésel, flete…) no llega a la app', () => {
    const conDinero = structuredClone(HOJA_RUTA_API) as Record<string, any>;
    conDinero['hojaRuta'].tarifa = 18500;
    conDinero['hojaRuta'].fleteTotal = 22000;
    conDinero['hojaRuta'].itinerario[1].importeCasetas = 1450;
    conDinero['hojaRuta'].itinerario[1].ruta.costoDiesel = 6200;
    conDinero['hojaRuta'].itinerario[1].ruta.plazasCobro[0].monto = 320;
    conDinero['hojaRuta'].itinerario[1].ruta.plazasCobro[0].tarifaEje = 80;
    const h = hojaRutaDesdeApi(conDinero);
    const todas = llaves(h);
    expect(todas.filter((k) => CAMPOS_DINERO.test(k))).toEqual([]);
    expect(JSON.stringify(h)).not.toMatch(/18500|22000|1450|6200|320|tarifaEje/);
  });

  it('el botón "Abrir en mapa" solo recibe ligas https', () => {
    expect(ligaSegura('https://www.google.com/maps/dir/?api=1')).toBe('https://www.google.com/maps/dir/?api=1');
    expect(ligaSegura('javascript:alert(1)')).toBeNull();
    expect(ligaSegura('http://maps.example.com')).toBeNull();
    expect(ligaSegura('no es liga')).toBeNull();
    expect(ligaSegura(null)).toBeNull();
  });

  it('respuesta sin lo indispensable = error del servidor (se reintenta), sin copiar datos de la respuesta', () => {
    expect(() => hojaRutaDesdeApi({ hojaRuta: { generadaEn: 'x' } })).toThrow(/Respuesta inesperada/);
    expect(() => hojaRutaDesdeApi('x')).toThrow(/Respuesta inesperada/);
  });

  it('multipart: campos de texto del contrato; lo null no va; números con punto; ubicación completa', () => {
    const d: DatosEvidencia = {
      id: 'e1',
      viajeId: 'v1',
      tipo: 'AcuseRecibido',
      descripcion: null,
      nota: 'Firmado',
      reporteId: 'r9',
      tomadaEn: '2026-11-24T18:00:00Z',
      ubicacion: { lat: 19.4326077, lng: -99.1332, precisionM: 12.5, tomadoEn: '2026-11-24T17:59:58Z' },
    };
    expect(camposEvidencia(d)).toEqual([
      ['id', 'e1'],
      ['viajeId', 'v1'],
      ['tipo', 'AcuseRecibido'],
      ['nota', 'Firmado'],
      ['reporteId', 'r9'],
      ['tomadaEn', '2026-11-24T18:00:00Z'],
      ['lat', '19.4326077'],
      ['lng', '-99.1332'],
      ['precisionM', '12.5'],
      ['ubicacionTomadaEn', '2026-11-24T17:59:58Z'],
    ]);
    // Sin GPS: ni lat/lng ni precisión ni hora (precisión y hora solo con coordenadas).
    const sinGps = camposEvidencia({ ...d, ubicacion: null, nota: null, reporteId: null, tomadaEn: null, tipo: 'Otro', descripcion: 'Llanta' });
    expect(sinGps).toEqual([
      ['id', 'e1'],
      ['viajeId', 'v1'],
      ['tipo', 'Otro'],
      ['descripcion', 'Llanta'],
    ]);
    // Coordenadas sin precisión: van lat y lng, sin precisionM.
    const sinPrecision = camposEvidencia({ ...d, ubicacion: { lat: 1, lng: 2, precisionM: null, tomadoEn: '2026-11-24T17:59:58Z' } });
    expect(sinPrecision.map(([k]) => k)).not.toContain('precisionM');
    expect(nombreArchivoEvidencia('e1', 'image/jpeg')).toBe('e1.jpg');
    expect(nombreArchivoEvidencia('e1', 'image/png')).toBe('e1.png');
  });

  it('acuse, estados y evidencias del viaje: solo los campos del contrato', () => {
    expect(acuseEvidenciaDesdeApi({ id: 'e1', recibidaEn: 't', mensaje: 'Recibida: Acuse de recibido.', ruta: '/x' })).toEqual({
      id: 'e1',
      recibidaEn: 't',
      mensaje: 'Recibida: Acuse de recibido.',
    });
    expect(
      estadosEvidenciaDesdeApi([
        { id: 'a', estado: 'recibida', motivo: 'ignorado' },
        { id: 'b', estado: 'anulada', motivo: 'La oficina anuló la evidencia: borrosa' },
      ]),
    ).toEqual([
      { id: 'a', estado: 'recibida', motivo: null },
      { id: 'b', estado: 'anulada', motivo: 'La oficina anuló la evidencia: borrosa' },
    ]);
    expect(() => estadosEvidenciaDesdeApi([{ id: 'a', estado: 'otro' }])).toThrow(/Respuesta inesperada/);
    const lista = evidenciasDeViajeDesdeApi([
      { id: 'a', viajeId: 'v', tipo: 'Sellos', descripcion: null, nota: null, contentType: 'image/jpeg', tamanoBytes: 1, subidaEn: 't', tomadaEn: null, autor: 'operador', huella: 'x', ruta: '/y' },
      { id: 'b', viajeId: 'v', tipo: 'CartaPorteFirmada', descripcion: null, nota: null, contentType: 'application/pdf', tamanoBytes: 2, subidaEn: 't', tomadaEn: null, autor: 'raro' },
    ]);
    expect(Object.keys(lista[0]).sort()).toEqual(['autor', 'contentType', 'descripcion', 'id', 'nota', 'subidaEn', 'tamanoBytes', 'tipo', 'tomadaEn', 'viajeId']);
    expect(lista[1].autor).toBe('oficina'); // lo que no sea "operador" nunca se descarga
  });
});
