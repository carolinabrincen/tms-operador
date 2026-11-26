import { CODIGOS_TERMINO } from '../../core/api/operador-api';
import { salidaEjemplo } from '../../core/api/ejemplo/datos-ejemplo';
import { EnvioOperador, Salida } from '../../core/api/operador-api.modelos';
import { ReporteLocal } from '../../core/reportes/reporte-local';
import { crearReporteLocal } from './cola-reportes.util';
import { MENSAJE_ERROR_TERMINO, mensajeErrorTermino, tarjetasIncidencias, textoDesde } from './incidencias-abiertas.util';

const base = salidaEjemplo(new Date('2026-11-23T16:00:00Z'));
const salida: Salida = {
  ...base,
  incidenciasAbiertas: [
    { id: 'inc-oficina', tipo: 'RetenOInspeccion', ocurrioEn: '2026-11-23T15:20:00Z', nota: 'Revisión' },
    { id: 'inc-2', tipo: 'DetenidoEnParador', ocurrioEn: '2026-11-23T15:40:00Z', nota: null },
  ],
};
const LEIDA = '2026-11-23T16:05:00Z'; // última lectura de la asignación

function local(reporte: EnvioOperador, extra: Partial<ReporteLocal> = {}): ReporteLocal {
  return { ...crearReporteLocal(reporte, 'op1', 'x', '2026-11-23T16:00:00Z'), ...extra };
}
const termino = (id: string, incidenciaId: string) => ({ tipo: 'termino' as const, id, incidenciaId, terminadaEn: '2026-11-23T16:00:00Z', ubicacion: null, nota: null });

describe('incidencias-abiertas.util: tarjetas de "Mi viaje" y "Ya continué"', () => {
  it('una tarjeta por cada abierta del servidor (también las de la oficina), de la más antigua a la más reciente, con botón', () => {
    const t = tarjetasIncidencias(salida, [], LEIDA);
    expect(t.map((x) => [x.incidenciaId, x.tipo, x.estado])).toEqual([
      ['inc-oficina', 'RetenOInspeccion', 'abierta'],
      ['inc-2', 'DetenidoEnParador', 'abierta'],
    ]);
    expect(t[0].nota).toBe('Revisión');
  });

  it('sin salida o sin la lista (copia vieja): ninguna', () => {
    expect(tarjetasIncidencias(null, [], LEIDA)).toEqual([]);
    expect(tarjetasIncidencias({ ...base, incidenciasAbiertas: undefined as never }, [], LEIDA)).toEqual([]);
  });

  it('"Ya continué" en cola: "Pendiente de enviar" y sin botón; ya recibido (terminada o ya terminada): se quita', () => {
    const pendiente = local(termino('t1', 'inc-oficina'));
    expect(tarjetasIncidencias(salida, [pendiente], LEIDA)[0].estado).toBe('termino-pendiente');
    const recibido = local(termino('t1', 'inc-oficina'), { estado: 'enviado', resultado: 'ya-terminada', ultimoIntentoEn: '2026-11-23T16:06:00Z' });
    expect(tarjetasIncidencias(salida, [recibido], LEIDA).map((x) => x.incidenciaId)).toEqual(['inc-2']);
  });

  it('si el servidor la sigue dando por abierta DESPUÉS de leer el término (la oficina la reabrió), vuelve el botón', () => {
    const viejo = local(termino('t1', 'inc-oficina'), { estado: 'enviado', resultado: 'terminada', ultimoIntentoEn: '2026-11-23T16:01:00Z' });
    expect(tarjetasIncidencias(salida, [viejo], LEIDA)[0].estado).toBe('abierta');
  });

  it('"Ya continué" no aceptado: vuelve el botón con el motivo', () => {
    const rechazado = local(termino('t1', 'inc-oficina'), { estado: 'rechazado', error: 'La salida ya se cerró…' });
    expect(tarjetasIncidencias(salida, [rechazado], LEIDA)[0]).toMatchObject({ estado: 'abierta', error: 'La salida ya se cerró…' });
  });

  it('una incidencia reportada desde la app aparece de inmediato (sin botón) hasta que la asignación la trae', () => {
    const inc = {
      tipo: 'incidencia' as const,
      id: 'r-inc',
      viajeId: 'ej-via-770',
      incidencia: 'IncidenciaMecanica' as const,
      ocurrioEn: '2026-11-23T16:03:00Z',
      ubicacion: null,
      nota: 'Llanta',
    };
    const enCola = tarjetasIncidencias(salida, [local(inc)], LEIDA);
    expect(enCola.at(-1)).toMatchObject({ clave: 'r-inc', tipo: 'IncidenciaMecanica', estado: 'incidencia-pendiente', estadoReporte: 'pendiente', incidenciaId: null, nota: 'Llanta' });
    // Enviada después de la última lectura: sigue visible.
    expect(tarjetasIncidencias(salida, [local(inc, { estado: 'enviado', ultimoIntentoEn: '2026-11-23T16:06:00Z' })], LEIDA)).toHaveLength(3);
    // Ya leída la asignación después de enviarla: la tarjeta la pone el servidor (si sigue abierta).
    expect(tarjetasIncidencias(salida, [local(inc, { estado: 'enviado', ultimoIntentoEn: '2026-11-23T16:04:00Z' })], LEIDA)).toHaveLength(2);
    // No aceptada: no hay tarjeta.
    expect(tarjetasIncidencias(salida, [local(inc, { estado: 'rechazado' })], LEIDA)).toHaveLength(2);
  });

  it('la misma incidencia ya en la lista del servidor (mismo tipo y hora) no se repite como tarjeta local', () => {
    const inc = { tipo: 'incidencia' as const, id: 'r-dup', viajeId: 'ej-via-770', incidencia: 'DetenidoEnParador' as const, ocurrioEn: '2026-11-23T15:40:00Z', ubicacion: null, nota: null };
    const t = tarjetasIncidencias(salida, [local(inc, { estado: 'enviado', ultimoIntentoEn: LEIDA })], LEIDA);
    expect(t.map((x) => x.clave)).toEqual(['inc-oficina', 'inc-2']);
  });

  it('"desde 2:07\u00a0p.\u00a0m." en la zona del negocio (12 horas); otro día, con fecha', () => {
    const ahora = new Date('2026-11-23T21:00:00Z');
    expect(textoDesde('2026-11-23T20:07:00Z', ahora)).toBe('desde 2:07\u00a0p.\u00a0m.');
    expect(textoDesde('2026-11-22T20:07:00Z', ahora)).toBe('desde el 22 nov, 2:07\u00a0p.\u00a0m.');
  });

  it('un texto de usted para CADA código de error de la sección 7', () => {
    for (const codigo of Object.values(CODIGOS_TERMINO)) {
      expect(MENSAJE_ERROR_TERMINO[codigo], codigo).toBeTruthy();
      expect(MENSAJE_ERROR_TERMINO[codigo]).not.toMatch(/\btú\b|\btienes\b|\bpuedes\b|\bactualiza\b/i);
    }
    expect(mensajeErrorTermino(CODIGOS_TERMINO.salidaCerrada, 'x')).toContain('La oficina puede terminarla.');
    expect(mensajeErrorTermino('OTRO', 'Del servidor.')).toBe('Del servidor.');
    expect(mensajeErrorTermino(null, null)).toBe('La oficina no aceptó el aviso de que ya continuó.');
  });
});
