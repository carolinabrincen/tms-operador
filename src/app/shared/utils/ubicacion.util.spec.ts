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

  it('posición → punto con 6 decimales y precisión entera', () => {
    const p = puntoDePosicion({ coords: { latitude: 25.68661234, longitude: -100.31611234, accuracy: 12.7 }, timestamp: Date.UTC(2026, 10, 23, 16, 0, 5) });
    expect(p).toEqual({ lat: 25.686612, lng: -100.316112, precisionM: 13, tomadoEn: '2026-11-23T16:00:05Z' });
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
