import { ReporteOperador } from '../operador-api.modelos';
import { SALIDA_CARGADA, SALIDA_VACIA } from '../../../testing/respuestas-api';
import { acuseDesdeApi, asignacionDesdeApi, estadosDesdeApi, reporteParaApi, sesionDesdeApi } from './mapeo-api.util';

describe('mapeo-api.util: API real (contrato M1) ↔ modelos de la app', () => {
  it('sesión: perfil por un lado, credenciales por otro', () => {
    const r = sesionDesdeApi({
      operadorId: 'op-1',
      nombre: 'Juan Pérez López',
      celularTerminacion: '5678',
      token: 'tok',
      expiraEn: '2026-11-23T21:05:00Z',
      refreshToken: 'ref',
      refreshExpiraEn: '2026-12-23T20:05:00Z',
    });
    expect(r.perfil).toEqual({ operadorId: 'op-1', nombre: 'Juan Pérez López', celularTerminacion: '5678' });
    expect(r.credenciales).toEqual({ token: 'tok', expiraEn: '2026-11-23T21:05:00Z', refreshToken: 'ref', refreshExpiraEn: '2026-12-23T20:05:00Z' });
  });

  it('sesión incompleta: error del servidor, sin copiar la respuesta en el mensaje', () => {
    let err: Error | null = null;
    try {
      sesionDesdeApi({ operadorId: 'op-1', nombre: 'J', token: 'secreto' });
    } catch (e) {
      err = e as Error;
    }
    expect(err).toMatchObject({ tipo: 'servidor' });
    expect(err!.message).not.toContain('secreto');
  });

  it('asignación con viaje cargado: estatus, historial (estatus con nota; incidencias con su valor del backend)', () => {
    const { salida } = asignacionDesdeApi(SALIDA_CARGADA);
    expect(salida!.unidad).toEqual({ numeroEconomico: 'T-104', placas: '123-AB-4', configuracion: 'Sencillo 1 · Sencillo', remolques: ['R-220'] });
    const v = salida!.viajes[0];
    expect(v).toMatchObject({ tipo: 'cargado', id: 'via-1', estatus: 'EnTransito', cliente: 'Comercializadora del Golfo', toneladasProgramadas: 28, citaDescarga: null });
    expect(v.historial).toEqual([
      { tipo: 'estatus', estatus: 'Asignado', nota: null, ocurrioEn: '2026-11-23T12:00:00Z', autor: 'oficina', reporteId: null },
      { tipo: 'estatus', estatus: 'EnPosicionamiento', nota: null, ocurrioEn: '2026-11-23T13:00:00Z', autor: 'operador', reporteId: 'r-1' },
      { tipo: 'incidencia', incidencia: 'RetenOInspeccion', nota: 'Km 40', ocurrioEn: '2026-11-23T13:30:00Z', autor: 'operador', reporteId: 'r-2' },
    ]);
  });

  it('asignación de un vacío: el id del viaje es el de la salida; motivos con su valor del backend; placas ""', () => {
    const { salida } = asignacionDesdeApi(SALIDA_VACIA);
    const v = salida!.viajes[0];
    expect(v).toMatchObject({ tipo: 'vacio', id: 'sal-2', estatus: 'EnTransitoVacio' });
    expect(v.tipo === 'vacio' && v.tramos.map((t) => t.motivo)).toEqual(['CargaCombustible', 'Taller']);
    expect(salida!.unidad.placas).toBe('');
  });

  it('sin salida activa', () => {
    expect(asignacionDesdeApi({ salida: null })).toEqual({ salida: null });
  });

  it('lista blanca: un campo de más (p. ej. de dinero) NO llega a la app', () => {
    const conExtra = structuredClone(SALIDA_CARGADA) as { salida: { viajes: Record<string, unknown>[]; tarifa?: number } };
    conExtra.salida.tarifa = 15000;
    conExtra.salida.viajes[0]['importe'] = 9999;
    conExtra.salida.viajes[0]['utilidad'] = 1;
    const texto = JSON.stringify(asignacionDesdeApi(conExtra));
    expect(texto).not.toMatch(/tarifa|importe|utilidad|15000|9999/);
  });

  it('Cancelado llega como estatus del viaje cargado', () => {
    const c = structuredClone(SALIDA_CARGADA);
    c.salida.viajes[0].estatus = 'Cancelado';
    expect(asignacionDesdeApi(c).salida!.viajes[0].estatus).toBe('Cancelado');
  });

  it('respuesta sin lo indispensable: error del servidor', () => {
    expect(() => asignacionDesdeApi({ salida: { id: 'x' } })).toThrow(/Respuesta inesperada/);
    expect(() => asignacionDesdeApi('no')).toThrow(/Respuesta inesperada/);
  });

  it('cuerpo del reporte: estatus sin "incidencia"; incidencia sin "estatus"; ubicación completa o null', () => {
    const est: ReporteOperador = {
      tipo: 'estatus',
      id: 'r-1',
      viajeId: 'via-1',
      estatus: 'EnPatioOrigen',
      ocurrioEn: '2026-11-23T20:05:00Z',
      ubicacion: { lat: 19.4326, lng: -99.1332, precisionM: 12.5, tomadoEn: '2026-11-23T20:04:58Z' },
      nota: null,
    };
    expect(reporteParaApi(est)).toEqual({
      id: 'r-1',
      viajeId: 'via-1',
      tipo: 'estatus',
      estatus: 'EnPatioOrigen',
      ocurrioEn: '2026-11-23T20:05:00Z',
      ubicacion: { lat: 19.4326, lng: -99.1332, precisionM: 12.5, tomadoEn: '2026-11-23T20:04:58Z' },
      nota: null,
    });
    const inc: ReporteOperador = { tipo: 'incidencia', id: 'r-2', viajeId: 'sal-2', incidencia: 'DetenidoEnParador', ocurrioEn: '2026-11-23T20:05:00Z', ubicacion: null, nota: 'Comida' };
    expect(reporteParaApi(inc)).toEqual({ id: 'r-2', viajeId: 'sal-2', tipo: 'incidencia', incidencia: 'DetenidoEnParador', ocurrioEn: '2026-11-23T20:05:00Z', ubicacion: null, nota: 'Comida' });
    expect(reporteParaApi(inc)).not.toHaveProperty('estatus');
  });

  it('acuse y estado: los 6 resultados, con mensaje; confirmadoEn solo con confirmado', () => {
    for (const resultado of ['aplicado', 'por-confirmar', 'confirmado', 'registrado', 'sin-efecto', 'descartado']) {
      expect(acuseDesdeApi({ id: 'r', recibidoEn: 't', resultado, mensaje: 'm' })).toEqual({ id: 'r', recibidoEn: 't', resultado, mensaje: 'm' });
    }
    expect(() => acuseDesdeApi({ id: 'r', recibidoEn: 't', resultado: 'otro', mensaje: null })).toThrow(/Respuesta inesperada/);
    expect(
      estadosDesdeApi([
        { id: 'a', resultado: 'confirmado', confirmadoEn: '2026-11-23T20:40:00Z', mensaje: null },
        { id: 'b', resultado: 'descartado', confirmadoEn: 'x', mensaje: 'La oficina descartó el reporte: duplicado' },
      ]),
    ).toEqual([
      { id: 'a', resultado: 'confirmado', confirmadoEn: '2026-11-23T20:40:00Z', mensaje: null },
      { id: 'b', resultado: 'descartado', confirmadoEn: null, mensaje: 'La oficina descartó el reporte: duplicado' },
    ]);
  });
});
