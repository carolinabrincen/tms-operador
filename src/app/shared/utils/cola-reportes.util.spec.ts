import { ReporteOperador } from '../../core/api/operador-api.modelos';
import {
  ESTADO_POR_RESULTADO,
  ETIQUETA_ESTADO_REPORTE,
  conEnvioExitoso,
  conEstadoRemoto,
  conFallaEnvio,
  crearReporteLocal,
  esReporteLocalValido,
  ordenarRecientes,
  porConfirmar,
  porEnviar,
  retrasoReintentoMs,
  textoPendientes,
} from './cola-reportes.util';

function reporte(id: string, ocurrioEn = '2026-11-23T16:00:00Z'): ReporteOperador {
  return { tipo: 'estatus', id, viajeId: 'v1', estatus: 'EnCarga', ocurrioEn, ubicacion: null, nota: null };
}

describe('cola-reportes.util: reglas de la cola del teléfono', () => {
  it('un reporte nace pendiente, sin intentos, sin aviso y con su id como llave', () => {
    const r = crearReporteLocal(reporte('a'), 'op1', 'Viaje 1', '2026-11-23T16:00:01Z');
    expect(r).toMatchObject({ id: 'a', operadorId: 'op1', estado: 'pendiente', intentos: 0, error: null, aviso: null, creadoEn: '2026-11-23T16:00:01Z' });
  });

  it('por enviar: solo pendientes del operador, en orden de creación; por confirmar: hitos esperando', () => {
    const a = crearReporteLocal(reporte('a'), 'op1', '', '2026-11-23T16:00:03Z');
    const b = crearReporteLocal(reporte('b'), 'op1', '', '2026-11-23T16:00:01Z');
    const otro = crearReporteLocal(reporte('c'), 'op2', '', '2026-11-23T16:00:00Z');
    const hito = { ...crearReporteLocal(reporte('d'), 'op1', '', '2026-11-23T16:00:00Z'), estado: 'por-confirmar' as const };
    const enviado = { ...crearReporteLocal(reporte('e'), 'op1', '', '2026-11-23T16:00:00Z'), estado: 'enviado' as const };
    expect(porEnviar([a, b, otro, hito, enviado], 'op1').map((r) => r.id)).toEqual(['b', 'a']);
    expect(porConfirmar([a, b, otro, hito, enviado], 'op1').map((r) => r.id)).toEqual(['d']);
  });

  it('resultado del servidor → estado local', () => {
    expect(ESTADO_POR_RESULTADO).toEqual({
      aplicado: 'enviado',
      registrado: 'enviado',
      'sin-efecto': 'enviado',
      'por-confirmar': 'por-confirmar',
      confirmado: 'confirmado',
    });
  });

  it('envío exitoso: intermedio aplicado = Enviado; hito = Pendiente de confirmar; limpia el error', () => {
    const r = { ...crearReporteLocal(reporte('a'), 'op1', '', 't0'), error: 'Sin señal', intentos: 2 };
    const ok = conEnvioExitoso(r, { id: 'a', recibidoEn: '2026-11-23T16:01:00Z', resultado: 'aplicado', mensaje: null }, 't1');
    expect(ok).toMatchObject({ estado: 'enviado', intentos: 3, enviadoEn: '2026-11-23T16:01:00Z', error: null, aviso: null, confirmadoEn: null });
    expect(conEnvioExitoso(r, { id: 'a', recibidoEn: 't', resultado: 'por-confirmar', mensaje: null }, 't1').estado).toBe('por-confirmar');
    const conf = conEnvioExitoso(r, { id: 'a', recibidoEn: 't', resultado: 'confirmado', mensaje: null }, 't1');
    expect(conf).toMatchObject({ estado: 'confirmado', confirmadoEn: 't1' });
  });

  it('sin efecto (la oficina ya iba adelante): Enviado con aviso para el operador', () => {
    const r = crearReporteLocal(reporte('a'), 'op1', '', 't0');
    const s = conEnvioExitoso(r, { id: 'a', recibidoEn: 't', resultado: 'sin-efecto', mensaje: 'El viaje ya estaba en «Documentado».' }, 't1');
    expect(s).toMatchObject({ estado: 'enviado', aviso: 'El viaje ya estaba en «Documentado».' });
    expect(conEnvioExitoso(r, { id: 'a', recibidoEn: 't', resultado: 'sin-efecto', mensaje: null }, 't1').aviso).toBe(
      'Recibido sin cambiar el estatus del viaje.',
    );
  });

  it('falla: conexión/servidor/sesión = sigue pendiente; rechazado = definitivo', () => {
    const r = crearReporteLocal(reporte('a'), 'op1', '', 't0');
    for (const tipo of ['sin-conexion', 'servidor', 'sesion'] as const) {
      expect(conFallaEnvio(r, tipo, 'x', 't1')).toMatchObject({ estado: 'pendiente', intentos: 1, error: 'x', ultimoIntentoEn: 't1' });
    }
    expect(conFallaEnvio(r, 'rechazado', 'Viaje ajeno', 't1')).toMatchObject({ estado: 'rechazado', error: 'Viaje ajeno' });
  });

  it('estado remoto: solo de "por confirmar" a "confirmado"', () => {
    const hito = { ...crearReporteLocal(reporte('a'), 'op1', '', 't0'), estado: 'por-confirmar' as const };
    expect(conEstadoRemoto(hito, { id: 'a', resultado: 'confirmado', confirmadoEn: 'tc' }, 't9')).toMatchObject({ estado: 'confirmado', confirmadoEn: 'tc' });
    expect(conEstadoRemoto(hito, { id: 'a', resultado: 'confirmado', confirmadoEn: null }, 't9').confirmadoEn).toBe('t9');
    expect(conEstadoRemoto(hito, { id: 'a', resultado: 'por-confirmar', confirmadoEn: null }, 't9')).toBe(hito);
    const enviado = { ...hito, estado: 'enviado' as const };
    expect(conEstadoRemoto(enviado, { id: 'a', resultado: 'confirmado', confirmadoEn: 'tc' }, 't9')).toBe(enviado);
    const rechazado = { ...hito, estado: 'rechazado' as const };
    expect(conEstadoRemoto(rechazado, { id: 'a', resultado: 'confirmado', confirmadoEn: 'tc' }, 't9')).toBe(rechazado);
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
      'por-confirmar': 'Pendiente de confirmar por oficina',
      confirmado: 'Confirmado',
      rechazado: 'No aceptado',
    });
    expect(textoPendientes(1)).toBe('Falta enviar 1 reporte');
    expect(textoPendientes(3)).toBe('Faltan enviar 3 reportes');
  });

  it('descarta registros con formato viejo (paso 1) o dañados', () => {
    expect(esReporteLocalValido(crearReporteLocal(reporte('a'), 'op1', '', 't0'))).toBe(true);
    const paso1 = { id: 'x', operadorId: 'op1', reporte: { id: 'x', objetivo: { tipo: 'tramo' }, avance: 'sali', ocurrioEn: 't' } };
    expect(esReporteLocalValido(paso1)).toBe(false);
    expect(esReporteLocalValido(null)).toBe(false);
  });
});
