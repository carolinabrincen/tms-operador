import { LIMITE_SERVIDOR_MS, UMBRAL_AVISO_RELOJ_MS, desfaseMs, mensajeReloj } from './reloj.util';

describe('reloj.util: ¿la hora del teléfono está bien?', () => {
  it('límites: el servidor rechaza a los 10 min; la app avisa desde los 5', () => {
    expect(LIMITE_SERVIDOR_MS).toBe(600_000);
    expect(UMBRAL_AVISO_RELOJ_MS).toBe(300_000);
  });

  it('desfase teléfono − servidor', () => {
    expect(desfaseMs(new Date('2026-11-23T20:12:00Z'), '2026-11-23T20:05:00Z')).toBe(7 * 60_000);
    expect(desfaseMs(new Date('2026-11-23T20:00:00Z'), '2026-11-23T20:05:00Z')).toBe(-5 * 60_000);
    expect(desfaseMs(new Date(), null)).toBeNull();
    expect(desfaseMs(new Date(), 'no')).toBeNull();
  });

  it('sin aviso si la diferencia es chica (latencia normal)', () => {
    expect(mensajeReloj(null)).toBeNull();
    expect(mensajeReloj(3_000)).toBeNull();
    expect(mensajeReloj(-4 * 60_000)).toBeNull();
  });

  it('adelantado: avisa antes de que la oficina rechace', () => {
    expect(mensajeReloj(7 * 60_000)).toBe(
      'La hora de su teléfono está adelantada unos 7 minutos. Corríjala en los ajustes del teléfono (fecha y hora automáticas). Si pasa de 10 minutos, la oficina no acepta sus reportes.',
    );
  });

  it('atrasado: también avisa (la hora del reporte saldría mal)', () => {
    expect(mensajeReloj(-20 * 60_000)).toContain('atrasada unos 20 minutos');
  });

  it('si el servidor ya rechazó por la hora y no se sabe el desfase, avisa igual', () => {
    expect(mensajeReloj(null, true)).toBe(
      'La oficina no aceptó un reporte porque la hora de su teléfono está adelantada. Corríjala en los ajustes del teléfono (fecha y hora automáticas).',
    );
  });
});
