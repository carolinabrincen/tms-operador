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

  it('ISO UTC → dd/MM/yyyy HH:mm con la hora del negocio (UTC-6); sin zona = UTC; con desfase se respeta', () => {
    expect(fechaHoraNegocio('2026-11-08T20:00:00Z')).toBe('08/11/2026 14:00');
    expect(fechaHoraNegocio('2026-11-08T20:00:00')).toBe('08/11/2026 14:00');
    expect(fechaHoraNegocio('2026-11-08T14:00:00-06:00')).toBe('08/11/2026 14:00');
    // Cambia de día: 03:30 UTC del 9 es 21:30 del 8 en el negocio.
    expect(fechaHoraNegocio('2026-11-09T03:30:00Z')).toBe('08/11/2026 21:30');
    // Medianoche: nunca "24:00".
    expect(fechaHoraNegocio('2026-11-09T06:00:00Z')).toBe('09/11/2026 00:00');
  });

  it('fecha, hora y día por separado', () => {
    expect(fechaNegocio('2026-11-09T03:30:00Z')).toBe('08/11/2026');
    expect(horaNegocio('2026-11-09T03:30:00Z')).toBe('21:30');
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
    expect(fechaHoraNegocio('2026-11-08T20:00:00Z', 'America/Tijuana')).toBe('08/11/2026 12:00');
    expect(fechaHoraNegocio('2026-11-08T20:00:00Z', 'UTC')).toBe('08/11/2026 20:00');
  });

  it('cuándo: Hoy / Mañana / Ayer según el día del negocio, si no fecha completa', () => {
    // 23/11/2026 10:00 en el negocio (16:00Z).
    const ahora = new Date('2026-11-23T16:00:00Z');
    expect(cuandoNegocio('2026-11-23T20:05:00Z', ahora)).toBe('Hoy 14:05');
    // 03:30Z del 24 sigue siendo el 23 en el negocio.
    expect(cuandoNegocio('2026-11-24T03:30:00Z', ahora)).toBe('Hoy 21:30');
    expect(cuandoNegocio('2026-11-24T13:00:00Z', ahora)).toBe('Mañana 07:00');
    // 04:10Z del 23 es el 22 a las 22:10 en el negocio: ayer. 04:10Z del 22 ya es el 21: fecha completa.
    expect(cuandoNegocio('2026-11-23T04:10:00Z', ahora)).toBe('Ayer 22:10');
    expect(cuandoNegocio('2026-11-22T04:10:00Z', ahora)).toBe('21/11/2026 22:10');
    expect(cuandoNegocio('2026-11-25T15:30:00Z', ahora)).toBe('25/11/2026 09:30');
    expect(cuandoNegocio('', ahora)).toBe('');
  });

  it('cuándo: a las 23:30 del negocio (05:30Z del día siguiente en UTC) "hoy" sigue siendo el día del negocio', () => {
    const ahora = new Date('2026-11-24T05:30:00Z'); // 23/11 23:30 en México
    expect(cuandoNegocio('2026-11-24T05:00:00Z', ahora)).toBe('Hoy 23:00');
    expect(cuandoNegocio('2026-11-24T14:00:00Z', ahora)).toBe('Mañana 08:00');
  });

  it('ahora en ISO UTC sin milisegundos', () => {
    expect(ahoraIsoUtc(new Date('2026-11-23T20:05:37.123Z'))).toBe('2026-11-23T20:05:37Z');
  });
});
