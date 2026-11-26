import {
  ZONA_NEGOCIO,
  ahoraIsoUtc,
  cuandoNegocio,
  diaNegocio,
  fechaHoraNegocio,
  fechaNegocio,
  horaNegocio,
  msDeIso,
} from './zona-negocio.util';

describe('zona-negocio.util: horas en la zona del negocio (America/Mexico_City), no en la del teléfono', () => {
  it('la zona por omisión es la del negocio', () => {
    expect(ZONA_NEGOCIO).toBe('America/Mexico_City');
  });

  const HOY = new Date('2026-11-23T16:00:00Z');

  it('ISO UTC → "8 nov, 2:00\u00a0p.\u00a0m." (12 horas) con la hora del negocio (UTC-6); sin zona = UTC; con desfase se respeta', () => {
    expect(fechaHoraNegocio('2026-11-08T20:00:00Z', ZONA_NEGOCIO, HOY)).toBe('8 nov, 2:00\u00a0p.\u00a0m.');
    expect(fechaHoraNegocio('2026-11-08T20:00:00', ZONA_NEGOCIO, HOY)).toBe('8 nov, 2:00\u00a0p.\u00a0m.');
    expect(fechaHoraNegocio('2026-11-08T14:00:00-06:00', ZONA_NEGOCIO, HOY)).toBe('8 nov, 2:00\u00a0p.\u00a0m.');
    // Cambia de día: 03:30 UTC del 9 es 21:30 del 8 en el negocio.
    expect(fechaHoraNegocio('2026-11-09T03:30:00Z', ZONA_NEGOCIO, HOY)).toBe('8 nov, 9:30\u00a0p.\u00a0m.');
    // Medianoche y mediodía: "12:00\u00a0a.\u00a0m." y "12:00\u00a0p.\u00a0m." (nunca "0:00").
    expect(fechaHoraNegocio('2026-11-09T06:00:00Z', ZONA_NEGOCIO, HOY)).toBe('9 nov, 12:00\u00a0a.\u00a0m.');
    expect(horaNegocio('2026-11-09T18:00:00Z')).toBe('12:00\u00a0p.\u00a0m.');
    expect(horaNegocio('2026-11-09T19:26:00Z')).toBe('1:26\u00a0p.\u00a0m.');
    // Otro año: lleva el año.
    expect(fechaHoraNegocio('2027-01-05T18:00:00Z', ZONA_NEGOCIO, HOY)).toBe('5 ene 2027, 12:00\u00a0p.\u00a0m.');
  });

  it('fecha, hora y día por separado', () => {
    expect(fechaNegocio('2026-11-09T03:30:00Z', ZONA_NEGOCIO, HOY)).toBe('8 nov');
    expect(horaNegocio('2026-11-09T03:30:00Z')).toBe('9:30\u00a0p.\u00a0m.');
    expect(diaNegocio('2026-11-09T03:30:00Z')).toBe('2026-11-08');
  });

  it('vacío o inválido = texto vacío (nunca "Invalid Date")', () => {
    for (const f of [fechaHoraNegocio, fechaNegocio, horaNegocio, diaNegocio]) {
      expect([f(null), f(undefined), f(''), f('no es fecha')]).toEqual(['', '', '', '']);
    }
    expect(msDeIso('x')).toBeNull();
    expect(msDeIso('2026-11-08T20:00:00Z')).toBe(Date.UTC(2026, 10, 8, 20));
  });

  it('otra zona: el cálculo no depende de la zona del teléfono', () => {
    expect(fechaHoraNegocio('2026-11-08T20:00:00Z', 'America/Tijuana', HOY)).toBe('8 nov, 12:00\u00a0p.\u00a0m.');
    expect(fechaHoraNegocio('2026-11-08T20:00:00Z', 'UTC', HOY)).toBe('8 nov, 8:00\u00a0p.\u00a0m.');
  });

  it('cuándo: Hoy / Mañana / Ayer según el día del negocio, si no fecha completa', () => {
    // 23/11/2026 10:00 en el negocio (16:00Z).
    const ahora = new Date('2026-11-23T16:00:00Z');
    expect(cuandoNegocio('2026-11-23T20:05:00Z', ahora)).toBe('Hoy 2:05\u00a0p.\u00a0m.');
    // 03:30Z del 24 sigue siendo el 23 en el negocio.
    expect(cuandoNegocio('2026-11-24T03:30:00Z', ahora)).toBe('Hoy 9:30\u00a0p.\u00a0m.');
    expect(cuandoNegocio('2026-11-24T13:00:00Z', ahora)).toBe('Mañana 7:00\u00a0a.\u00a0m.');
    // 04:10Z del 23 es el 22 a las 22:10 en el negocio: ayer. 04:10Z del 22 ya es el 21: fecha completa.
    expect(cuandoNegocio('2026-11-23T04:10:00Z', ahora)).toBe('Ayer 10:10\u00a0p.\u00a0m.');
    expect(cuandoNegocio('2026-11-22T04:10:00Z', ahora)).toBe('21 nov, 10:10\u00a0p.\u00a0m.');
    expect(cuandoNegocio('2026-11-25T15:30:00Z', ahora)).toBe('25 nov, 9:30\u00a0a.\u00a0m.');
    expect(cuandoNegocio('', ahora)).toBe('');
  });

  it('cuándo: a las 23:30 del negocio (05:30Z del día siguiente en UTC) "hoy" sigue siendo el día del negocio', () => {
    const ahora = new Date('2026-11-24T05:30:00Z'); // 23/11 23:30 en México
    expect(cuandoNegocio('2026-11-24T05:00:00Z', ahora)).toBe('Hoy 11:00\u00a0p.\u00a0m.');
    expect(cuandoNegocio('2026-11-24T14:00:00Z', ahora)).toBe('Mañana 8:00\u00a0a.\u00a0m.');
  });

  it('ahora en ISO UTC sin milisegundos', () => {
    expect(ahoraIsoUtc(new Date('2026-11-23T20:05:37.123Z'))).toBe('2026-11-23T20:05:37Z');
  });
});
