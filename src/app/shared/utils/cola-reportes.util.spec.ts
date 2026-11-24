import { ReporteOperador } from '../../core/api/operador-api.modelos';
import {
  ESTADO_POR_RESULTADO,
  ETIQUETA_ESTADO_REPORTE,
  conEnvioExitoso,
  conEstadoRemoto,
  conFallaEnvio,
  conNuevoId,
  crearReporteLocal,
  cuentaComoHecho,
  normalizarReporteLocal,
  ordenarRecientes,
  porConsultar,
  porEnviar,
  retrasoReintentoMs,
  textoPendientes,
} from './cola-reportes.util';

function reporte(id: string, ocurrioEn = '2026-11-23T16:00:00Z'): ReporteOperador {
  return { tipo: 'estatus', id, viajeId: 'v1', estatus: 'EnCarga', ocurrioEn, ubicacion: null, nota: null };
}
const local = (id: string, creadoEn = '2026-11-23T16:00:00Z', operadorId = 'op1') => crearReporteLocal(reporte(id), operadorId, 'Viaje 1', creadoEn);

describe('cola-reportes.util: reglas de la cola del teléfono', () => {
  it('un reporte nace pendiente, sin intentos, sin resultado ni mensaje y con su id como llave', () => {
    const r = crearReporteLocal(reporte('a'), 'op1', 'Viaje 1', '2026-11-23T16:00:01Z');
    expect(r).toMatchObject({ id: 'a', operadorId: 'op1', estado: 'pendiente', resultado: null, mensaje: null, intentos: 0, error: null, creadoEn: '2026-11-23T16:00:01Z' });
  });

  it('por enviar: solo pendientes del operador, en orden de creación', () => {
    const a = local('a', '2026-11-23T16:00:03Z');
    const b = local('b', '2026-11-23T16:00:01Z');
    const otro = local('c', '2026-11-23T16:00:00Z', 'op2');
    const enviado = { ...local('d'), estado: 'enviado' as const };
    expect(porEnviar([a, b, otro, enviado], 'op1').map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('por consultar: enviados y por confirmar (la oficina puede confirmarlos, anularlos o descartarlos), lo más reciente primero, con tope', () => {
    const hito = { ...local('h', '2026-11-23T16:00:01Z'), estado: 'por-confirmar' as const, resultado: 'por-confirmar' as const };
    const aplicado = { ...local('a', '2026-11-23T16:00:02Z'), estado: 'enviado' as const, resultado: 'aplicado' as const };
    const sinEfecto = { ...local('s', '2026-11-23T16:00:03Z'), estado: 'enviado' as const, resultado: 'sin-efecto' as const };
    const confirmado = { ...local('c'), estado: 'confirmado' as const };
    const pendiente = local('p');
    const ajeno = { ...local('x', '2026-11-23T16:00:09Z', 'op2'), estado: 'enviado' as const };
    expect(porConsultar([hito, aplicado, sinEfecto, confirmado, pendiente, ajeno], 'op1').map((r) => r.id)).toEqual(['a', 'h']);
    expect(porConsultar([hito, aplicado], 'op1', new Set(), 1).map((r) => r.id)).toEqual(['a']);
  });

  it('por consultar: los confirmados se siguen preguntando mientras su salida esté activa (la oficina puede anular el hito)', () => {
    const confirmado = { ...local('c'), estado: 'confirmado' as const, resultado: 'confirmado' as const };
    const deOtraSalida = { ...local('o'), reporte: { ...reporte('o'), viajeId: 'v-vieja' }, estado: 'confirmado' as const };
    expect(porConsultar([confirmado, deOtraSalida], 'op1', new Set(['v1'])).map((r) => r.id)).toEqual(['c']);
    // Salida cerrada o cancelada (asignación sin salida): ya no se preguntan.
    expect(porConsultar([confirmado, deOtraSalida], 'op1', new Set())).toEqual([]);
  });

  it('resultado del servidor → estado local', () => {
    expect(ESTADO_POR_RESULTADO).toEqual({
      aplicado: 'enviado',
      registrado: 'enviado',
      'sin-efecto': 'enviado',
      'por-confirmar': 'por-confirmar',
      confirmado: 'confirmado',
      descartado: 'descartado',
    });
  });

  it('envío exitoso: guarda resultado y mensaje del acuse; limpia el error', () => {
    const r = { ...local('a'), error: 'Sin señal', intentos: 2 };
    const ok = conEnvioExitoso(r, { id: 'a', recibidoEn: '2026-11-23T16:01:00Z', resultado: 'aplicado', mensaje: null }, 't1');
    expect(ok).toMatchObject({ estado: 'enviado', resultado: 'aplicado', mensaje: null, intentos: 3, enviadoEn: '2026-11-23T16:01:00Z', error: null });
    const hito = conEnvioExitoso(r, { id: 'a', recibidoEn: 't', resultado: 'por-confirmar', mensaje: 'Recibido; la oficina lo confirma.' }, 't1');
    expect(hito).toMatchObject({ estado: 'por-confirmar', mensaje: 'Recibido; la oficina lo confirma.' });
    expect(conEnvioExitoso(r, { id: 'a', recibidoEn: 't', resultado: 'confirmado', mensaje: null }, 't1')).toMatchObject({ estado: 'confirmado', confirmadoEn: 't1' });
  });

  it('sin efecto: Enviado con el mensaje del servidor (o uno genérico); no cuenta como hecho', () => {
    const r = local('a');
    const s = conEnvioExitoso(r, { id: 'a', recibidoEn: 't', resultado: 'sin-efecto', mensaje: 'La oficina ya registró En tránsito; el estatus no cambió.' }, 't1');
    expect(s).toMatchObject({ estado: 'enviado', resultado: 'sin-efecto', mensaje: 'La oficina ya registró En tránsito; el estatus no cambió.' });
    expect(cuentaComoHecho(s)).toBe(false);
    expect(conEnvioExitoso(r, { id: 'a', recibidoEn: 't', resultado: 'sin-efecto', mensaje: null }, 't1').mensaje).toBe('Recibido sin cambiar el estatus del viaje.');
  });

  it('descartado: estado propio con el motivo; no cuenta como hecho', () => {
    const d = conEnvioExitoso(local('a'), { id: 'a', recibidoEn: 't', resultado: 'descartado', mensaje: 'La oficina descartó el reporte: duplicado' }, 't1');
    expect(d).toMatchObject({ estado: 'descartado', mensaje: 'La oficina descartó el reporte: duplicado' });
    expect(cuentaComoHecho(d)).toBe(false);
    expect(cuentaComoHecho({ estado: 'rechazado', resultado: null })).toBe(false);
    expect(cuentaComoHecho({ estado: 'pendiente', resultado: null })).toBe(true);
  });

  it('falla: conexión/servidor/límite/sesión = sigue pendiente; rechazado = definitivo', () => {
    const r = local('a');
    for (const tipo of ['sin-conexion', 'servidor', 'limite', 'sesion'] as const) {
      expect(conFallaEnvio(r, tipo, 'x', 't1')).toMatchObject({ estado: 'pendiente', intentos: 1, error: 'x', ultimoIntentoEn: 't1' });
    }
    expect(conFallaEnvio(r, 'rechazado', 'Viaje ajeno', 't1')).toMatchObject({ estado: 'rechazado', error: 'Viaje ajeno' });
  });

  it('nuevo id (409 de id duplicado): mismo reporte con otro id, pendiente para reenviarse', () => {
    const r = { ...local('a'), estado: 'pendiente' as const, error: 'Ese id ya existe' };
    const n = conNuevoId(r, 'b');
    expect(n).toMatchObject({ id: 'b', estado: 'pendiente', error: null });
    expect(n.reporte).toEqual({ ...r.reporte, id: 'b' });
  });

  it('estado remoto: confirma hitos, y la oficina puede anular (sin efecto) o descartar después', () => {
    const hito = { ...local('a'), estado: 'por-confirmar' as const, resultado: 'por-confirmar' as const };
    expect(conEstadoRemoto(hito, { id: 'a', resultado: 'confirmado', confirmadoEn: 'tc', mensaje: null }, 't9')).toMatchObject({ estado: 'confirmado', confirmadoEn: 'tc' });
    expect(conEstadoRemoto(hito, { id: 'a', resultado: 'confirmado', confirmadoEn: null, mensaje: null }, 't9').confirmadoEn).toBe('t9');
    expect(conEstadoRemoto(hito, { id: 'a', resultado: 'por-confirmar', confirmadoEn: null, mensaje: null }, 't9')).toBe(hito);
    const aplicado = { ...local('a'), estado: 'enviado' as const, resultado: 'aplicado' as const };
    expect(conEstadoRemoto(aplicado, { id: 'a', resultado: 'sin-efecto', confirmadoEn: null, mensaje: 'La oficina anuló este estatus: error de captura' }, 't9')).toMatchObject({
      estado: 'enviado',
      resultado: 'sin-efecto',
      mensaje: 'La oficina anuló este estatus: error de captura',
    });
    expect(conEstadoRemoto(aplicado, { id: 'a', resultado: 'descartado', confirmadoEn: null, mensaje: 'La oficina descartó el reporte: x' }, 't9').estado).toBe('descartado');
  });

  it('hito anulado: un confirmado pasa a "sin efecto" con el mensaje del servidor tal cual, sin hora de confirmación, y ya no cuenta', () => {
    const confirmado = { ...local('a'), estado: 'confirmado' as const, resultado: 'confirmado' as const, confirmadoEn: '2026-11-23T20:40:00Z' };
    const mensaje = 'La oficina anuló el estatus Documentado: faltó la carta porte. Puedes volver a reportarlo.';
    const anulado = conEstadoRemoto(confirmado, { id: 'a', resultado: 'sin-efecto', confirmadoEn: null, mensaje }, 't9');
    expect(anulado).toMatchObject({ estado: 'enviado', resultado: 'sin-efecto', confirmadoEn: null, mensaje });
    expect(cuentaComoHecho(anulado)).toBe(false);
  });

  it('estado remoto: no toca pendientes ni rechazados', () => {
    const p = local('a');
    expect(conEstadoRemoto(p, { id: 'a', resultado: 'confirmado', confirmadoEn: 'tc', mensaje: null }, 't9')).toBe(p);
    const rechazado = { ...p, estado: 'rechazado' as const };
    expect(conEstadoRemoto(rechazado, { id: 'a', resultado: 'confirmado', confirmadoEn: 'tc', mensaje: null }, 't9')).toBe(rechazado);
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
      descartado: 'Descartado por oficina',
      rechazado: 'No aceptado',
    });
    expect(textoPendientes(1)).toBe('Falta enviar 1 reporte');
    expect(textoPendientes(3)).toBe('Faltan enviar 3 reportes');
  });

  it('normalizar: deja pasar los de esta versión; descarta el paso 1 y los dañados', () => {
    const actual = local('a');
    expect(normalizarReporteLocal(actual)).toEqual(actual);
    const paso1 = { id: 'x', operadorId: 'op1', reporte: { id: 'x', objetivo: { tipo: 'tramo' }, avance: 'sali', ocurrioEn: 't' } };
    expect(normalizarReporteLocal(paso1)).toBeNull();
    expect(normalizarReporteLocal(null)).toBeNull();
  });

  it('normalizar: traduce lo guardado en el paso 2 (aviso → sin efecto; incidencias con su nombre del backend)', () => {
    const { resultado: _r, mensaje: _m, ...sinCampos } = local('a');
    const paso2 = { ...sinCampos, estado: 'enviado', aviso: 'El viaje ya estaba en «Documentado».' };
    expect(normalizarReporteLocal(paso2)).toMatchObject({ resultado: 'sin-efecto', mensaje: 'El viaje ya estaba en «Documentado».' });
    expect(normalizarReporteLocal(paso2)).not.toHaveProperty('aviso');
    const incidencia = {
      ...sinCampos,
      reporte: { tipo: 'incidencia', id: 'a', viajeId: 'v1', incidencia: 'FallaMecanica', ocurrioEn: 't', ubicacion: null, nota: null },
    };
    expect(normalizarReporteLocal(incidencia)?.reporte).toMatchObject({ incidencia: 'IncidenciaMecanica' });
    const pendienteSinNada = { ...sinCampos };
    expect(normalizarReporteLocal(pendienteSinNada)).toMatchObject({ resultado: null, mensaje: null });
  });
});
