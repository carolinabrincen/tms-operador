import { EXPLICACION_UBICACION, debeExplicar, estadoPermisoDe, puntoDePosicion, textoUbicacionEnReporte } from './ubicacion.util';

describe('ubicacion.util: permiso y punto GPS del reporte', () => {
  it('texto de explicación acordado', () => {
    expect(EXPLICACION_UBICACION).toBe('Su ubicación se registra solo al reportar un avance y mientras tenga un viaje activo.');
  });

  it('estado del permiso del navegador → estado de la app', () => {
    expect(['granted', 'denied', 'prompt', undefined, 'raro'].map(estadoPermisoDe)).toEqual([
      'concedido',
      'negado',
      'preguntar',
      'desconocido',
      'desconocido',
    ]);
  });

  it('explica antes de pedir: siempre que el navegador vaya a preguntar; si no se sabe, solo la primera vez', () => {
    expect(debeExplicar('preguntar', true)).toBe(true);
    expect(debeExplicar('desconocido', false)).toBe(true);
    expect(debeExplicar('desconocido', true)).toBe(false);
    expect(debeExplicar('concedido', false)).toBe(false);
    expect(debeExplicar('negado', false)).toBe(false);
    expect(debeExplicar('no-disponible', false)).toBe(false);
  });

  it('sin permiso o sin GPS el texto aclara que el reporte se envía igual', () => {
    expect(textoUbicacionEnReporte('negado')).toContain('se envía sin ubicación');
    expect(textoUbicacionEnReporte('no-disponible')).toContain('se envía sin ubicación');
    expect(textoUbicacionEnReporte('preguntar')).toContain('se envía igual');
    expect(textoUbicacionEnReporte('concedido')).toContain('Se registrará su ubicación');
  });

  it('posición → punto con los redondeos del servidor: 7 decimales y precisión con 1 decimal (contrato M1)', () => {
    const p = puntoDePosicion({ coords: { latitude: 25.68661234, longitude: -100.31611236, accuracy: 12.74 }, timestamp: Date.UTC(2026, 10, 23, 16, 0, 5) });
    expect(p).toEqual({ lat: 25.6866123, lng: -100.3161124, precisionM: 12.7, tomadoEn: '2026-11-23T16:00:05Z' });
    // Precisión fuera de rango: se acota; negativa no sirve.
    expect(puntoDePosicion({ coords: { latitude: 1, longitude: 2, accuracy: 12_345_678 } })!.precisionM).toBe(9_999_999.9);
    expect(puntoDePosicion({ coords: { latitude: 1, longitude: 2, accuracy: -3 } })!.precisionM).toBeNull();
  });

  it('sin precisión o sin hora del GPS usa null y la hora actual', () => {
    const p = puntoDePosicion({ coords: { latitude: 1, longitude: 2, accuracy: null } }, new Date('2026-11-23T16:00:00Z'));
    expect(p).toEqual({ lat: 1, lng: 2, precisionM: null, tomadoEn: '2026-11-23T16:00:00Z' });
  });

  it('posición inválida = null (el reporte se envía sin punto)', () => {
    expect(puntoDePosicion(null)).toBeNull();
    expect(puntoDePosicion({ coords: { latitude: NaN, longitude: 2 } })).toBeNull();
    expect(puntoDePosicion({ coords: { latitude: 91, longitude: 2 } })).toBeNull();
  });
});
