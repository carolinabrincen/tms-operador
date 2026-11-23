import { ReporteAvance } from '../../core/api/operador-api.modelos';
import {
  ETIQUETA_ESTADO_REPORTE,
  conEnvioExitoso,
  conEstadoRemoto,
  conFallaEnvio,
  crearReporteLocal,
  ordenarRecientes,
  porConfirmar,
  porEnviar,
  retrasoReintentoMs,
  textoPendientes,
} from './cola-reportes.util';

function reporte(id: string, ocurrioEn = '2026-11-23T16:00:00Z'): ReporteAvance {
  return { id, objetivo: { tipo: 'movimiento', movimientoId: 'm1' }, avance: 'sali', ocurrioEn, ubicacion: null, nota: null };
}

describe('cola-reportes.util: reglas de la cola del teléfono', () => {
  it('un reporte nace pendiente, sin intentos y con su id como llave', () => {
    const r = crearReporteLocal(reporte('a'), 'op1', 'Movimiento', '2026-11-23T16:00:01Z');
    expect(r).toMatchObject({ id: 'a', operadorId: 'op1', estado: 'pendiente', intentos: 0, error: null, creadoEn: '2026-11-23T16:00:01Z' });
  });

  it('por enviar: solo pendientes del operador, en orden de creación', () => {
    const a = crearReporteLocal(reporte('a'), 'op1', '', '2026-11-23T16:00:03Z');
    const b = crearReporteLocal(reporte('b'), 'op1', '', '2026-11-23T16:00:01Z');
    const otro = crearReporteLocal(reporte('c'), 'op2', '', '2026-11-23T16:00:00Z');
    const enviado = { ...crearReporteLocal(reporte('d'), 'op1', '', '2026-11-23T16:00:00Z'), estado: 'enviado' as const };
    expect(porEnviar([a, b, otro, enviado], 'op1').map((r) => r.id)).toEqual(['b', 'a']);
    expect(porConfirmar([a, b, otro, enviado], 'op1').map((r) => r.id)).toEqual(['d']);
  });

  it('envío exitoso: enviado (o confirmado si el acuse ya viene confirmado) y limpia el error', () => {
    const r = { ...crearReporteLocal(reporte('a'), 'op1', '', 't0'), error: 'Sin señal', intentos: 2 };
    const ok = conEnvioExitoso(r, { id: 'a', recibidoEn: '2026-11-23T16:01:00Z', confirmado: false }, '2026-11-23T16:01:05Z');
    expect(ok).toMatchObject({ estado: 'enviado', intentos: 3, enviadoEn: '2026-11-23T16:01:00Z', error: null, confirmadoEn: null });
    const conf = conEnvioExitoso(r, { id: 'a', recibidoEn: '2026-11-23T16:01:00Z', confirmado: true }, '2026-11-23T16:01:05Z');
    expect(conf).toMatchObject({ estado: 'confirmado', confirmadoEn: '2026-11-23T16:01:05Z' });
  });

  it('falla: conexión/servidor/sesión = sigue pendiente; rechazado = definitivo', () => {
    const r = crearReporteLocal(reporte('a'), 'op1', '', 't0');
    for (const tipo of ['sin-conexion', 'servidor', 'sesion'] as const) {
      expect(conFallaEnvio(r, tipo, 'x', 't1')).toMatchObject({ estado: 'pendiente', intentos: 1, error: 'x', ultimoIntentoEn: 't1' });
    }
    expect(conFallaEnvio(r, 'rechazado', 'Tramo inexistente', 't1')).toMatchObject({ estado: 'rechazado', error: 'Tramo inexistente' });
  });

  it('estado remoto: solo sube a confirmado; nunca baja ni toca rechazados', () => {
    const enviado = { ...crearReporteLocal(reporte('a'), 'op1', '', 't0'), estado: 'enviado' as const };
    expect(conEstadoRemoto(enviado, { id: 'a', confirmado: true, confirmadoEn: 'tc' }, 't9')).toMatchObject({ estado: 'confirmado', confirmadoEn: 'tc' });
    expect(conEstadoRemoto(enviado, { id: 'a', confirmado: true, confirmadoEn: null }, 't9').confirmadoEn).toBe('t9');
    expect(conEstadoRemoto(enviado, { id: 'a', confirmado: false, confirmadoEn: null }, 't9')).toBe(enviado);
    const confirmado = { ...enviado, estado: 'confirmado' as const };
    expect(conEstadoRemoto(confirmado, { id: 'a', confirmado: false, confirmadoEn: null }, 't9')).toBe(confirmado);
    const rechazado = { ...enviado, estado: 'rechazado' as const };
    expect(conEstadoRemoto(rechazado, { id: 'a', confirmado: true, confirmadoEn: 'tc' }, 't9')).toBe(rechazado);
  });

  it('espera entre reintentos creciente con tope de 2 minutos', () => {
    expect([0, 1, 2, 3, 4, 5, 50].map(retrasoReintentoMs)).toEqual([5000, 5000, 15000, 30000, 60000, 120000, 120000]);
  });

  it('orden: lo más reciente primero', () => {
    const a = crearReporteLocal(reporte('a', '2026-11-23T10:00:00Z'), 'op1', '', 't0');
    const b = crearReporteLocal(reporte('b', '2026-11-23T12:00:00Z'), 'op1', '', 't0');
    expect(ordenarRecientes([a, b]).map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('textos de estado y de pendientes', () => {
    expect(ETIQUETA_ESTADO_REPORTE).toEqual({
      pendiente: 'Pendiente de enviar',
      enviado: 'Enviado',
      confirmado: 'Confirmado por oficina',
      rechazado: 'No aceptado',
    });
    expect(textoPendientes(1)).toBe('Falta enviar 1 reporte');
    expect(textoPendientes(3)).toBe('Faltan enviar 3 reportes');
  });
});
