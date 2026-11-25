import { CODIGOS_EVIDENCIA } from '../../core/api/operador-api';
import { DatosEvidencia } from '../../core/api/operador-api-m2.modelos';
import { ViajeCargado } from '../../core/api/operador-api.modelos';
import { salidaEjemplo } from '../../core/api/ejemplo/datos-ejemplo';
import { EvidenciaLocal } from '../../core/evidencias/evidencia-local';
import {
  ETIQUETA_ESTADO_FOTO,
  MENSAJE_ERROR_FOTO,
  admiteFotos,
  avisoFotosAcumuladas,
  conAcuseFoto,
  conEstadoRemotoFoto,
  conLigaNueva,
  conFallaFoto,
  conNuevoIdFoto,
  conReenvioFoto,
  crearEvidenciaLocal,
  fotosPorConsultar,
  fotosPorEnviar,
  mensajeErrorFoto,
  mensajeFoto,
  normalizarEvidenciaLocal,
  retrasoReintentoFotoMs,
  sinLigaPerdida,
  sugerenciasAcuse,
  textoFotosPendientes,
} from './evidencias.util';

const datos = (id: string, extra: Partial<DatosEvidencia> = {}): DatosEvidencia => ({
  id,
  viajeId: 'v1',
  tipo: 'Sellos',
  descripcion: null,
  nota: null,
  reporteId: null,
  tomadaEn: null,
  ubicacion: null,
  ...extra,
});
const foto = (id: string, creadoEn = '2026-11-24T16:00:00Z', extra: Partial<DatosEvidencia> = {}, operadorId = 'op1') =>
  crearEvidenciaLocal(datos(id, extra), operadorId, 'Viaje 2', new Uint8Array([0xff, 0xd8, 0xff, 1]).buffer, 'image/jpeg', creadoEn);

describe('evidencias.util: reglas de las fotos', () => {
  it('estados visibles: Pendiente, Enviada, Recibida, Anulada por la oficina (y No aceptada)', () => {
    expect(ETIQUETA_ESTADO_FOTO).toEqual({
      pendiente: 'Pendiente',
      enviada: 'Enviada',
      recibida: 'Recibida',
      anulada: 'Anulada por la oficina',
      rechazada: 'No aceptada',
    });
  });

  it('captura: hace falta la foto y el tipo; con Otro, la descripción', () => {
    expect(mensajeFoto('Sellos', '', false)).toBe('Tome la foto o elíjala de la galería.');
    expect(mensajeFoto(null, '', true)).toBe('Elija qué es la foto.');
    expect(mensajeFoto('Otro', '  ', true)).toBe('En “Otro” escriba qué es la foto.');
    expect(mensajeFoto('Otro', 'Llanta ponchada', true)).toBeNull();
    expect(mensajeFoto('Remision', '', true)).toBeNull();
  });

  it('solo viajes cargados no cancelados reciben fotos (P8 a)', () => {
    const s = salidaEjemplo(new Date('2026-11-24T16:00:00Z'));
    expect(admiteFotos(s.viajes[0])).toBe(false); // vacío
    expect(admiteFotos(s.viajes[1])).toBe(true);
    expect(admiteFotos({ ...(s.viajes[1] as ViajeCargado), estatus: 'Cancelado' })).toBe(false);
  });

  it('un texto de usted para CADA código de error del contrato', () => {
    for (const codigo of Object.values(CODIGOS_EVIDENCIA)) {
      expect(MENSAJE_ERROR_FOTO[codigo], codigo).toBeTruthy();
      expect(MENSAJE_ERROR_FOTO[codigo]).not.toMatch(/\btú\b|\btienes\b|\bpuedes\b/i);
    }
    expect(mensajeErrorFoto(CODIGOS_EVIDENCIA.salidaCerrada, 'x')).toContain('La oficina puede subirla');
    expect(mensajeErrorFoto(CODIGOS_EVIDENCIA.estadoInvalido, 'x')).toContain('la oficina puede subirla');
    expect(mensajeErrorFoto('OTRO_CODIGO', 'Mensaje del servidor.')).toBe('Mensaje del servidor.');
    expect(mensajeErrorFoto(null, null)).toBe('La oficina no aceptó la foto.');
  });

  it('aviso cuando se acumulan muchas fotos sin enviar', () => {
    expect(avisoFotosAcumuladas(9)).toBeNull();
    expect(avisoFotosAcumuladas(12)).toBe('Tiene 12 fotos sin enviar guardadas en el teléfono. Se enviarán solas con señal; si puede, conéctese a wifi.');
    expect(textoFotosPendientes(1)).toBe('Falta enviar 1 foto');
    expect(textoFotosPendientes(3)).toBe('Faltan enviar 3 fotos');
  });

  it('por enviar: pendientes del operador, en orden; la ligada a un reporte aún sin enviar espera', () => {
    const a = foto('a', '2026-11-24T16:00:02Z');
    const b = foto('b', '2026-11-24T16:00:01Z');
    const ligada = foto('c', '2026-11-24T16:00:00Z', { reporteId: 'r1' });
    const ajena = foto('d', '2026-11-24T16:00:00Z', {}, 'op2');
    const enviada = { ...foto('e'), estado: 'enviada' as const };
    expect(fotosPorEnviar([a, b, ligada, ajena, enviada], 'op1', [{ id: 'r1', estado: 'pendiente' }]).map((f) => f.id)).toEqual(['b', 'a']);
    expect(fotosPorEnviar([a, b, ligada], 'op1', [{ id: 'r1', estado: 'por-confirmar' }]).map((f) => f.id)).toEqual(['c', 'b', 'a']);
  });

  it('por consultar: enviadas siempre; recibidas solo de la salida activa (la oficina puede anularlas)', () => {
    const enviada = { ...foto('a'), estado: 'enviada' as const };
    const recibida = { ...foto('b'), estado: 'recibida' as const };
    const pendiente = foto('c');
    expect(fotosPorConsultar([enviada, recibida, pendiente], 'op1', new Set(['v1'])).map((f) => f.id).sort()).toEqual(['a', 'b']);
    expect(fotosPorConsultar([enviada, recibida, pendiente], 'op1', new Set()).map((f) => f.id)).toEqual(['a']);
  });

  it('acuse → Enviada con el mensaje del servidor; falla → pendiente o No aceptada (conserva la foto)', () => {
    const f = foto('a');
    expect(conAcuseFoto(f, { id: 'a', recibidaEn: 't1', mensaje: 'Recibida: Sellos.' }, 't0')).toMatchObject({
      estado: 'enviada',
      mensaje: 'Recibida: Sellos.',
      enviadaEn: 't1',
      intentos: 1,
    });
    for (const tipo of ['sin-conexion', 'servidor', 'limite', 'sesion'] as const) {
      expect(conFallaFoto(f, tipo, 'x', 't').estado).toBe('pendiente');
    }
    const rechazada = conFallaFoto(f, 'rechazado', 'No', 't');
    expect(rechazada).toMatchObject({ estado: 'rechazada', error: 'No' });
    expect(rechazada.foto).not.toBeNull();
  });

  it('estado remoto: recibida o anulada (con motivo) y entonces se borra la foto del teléfono; sin cambios = mismo objeto', () => {
    const enviada = { ...foto('a'), estado: 'enviada' as const };
    const recibida = conEstadoRemotoFoto(enviada, { id: 'a', estado: 'recibida', motivo: null });
    expect(recibida).toMatchObject({ estado: 'recibida', foto: null });
    expect(conEstadoRemotoFoto(recibida, { id: 'a', estado: 'recibida', motivo: null })).toBe(recibida);
    const anulada = conEstadoRemotoFoto(recibida, { id: 'a', estado: 'anulada', motivo: 'La oficina anuló la evidencia: borrosa' });
    expect(anulada).toMatchObject({ estado: 'anulada', mensaje: 'La oficina anuló la evidencia: borrosa', foto: null });
    const pendiente = foto('p');
    expect(conEstadoRemotoFoto(pendiente, { id: 'p', estado: 'recibida', motivo: null })).toBe(pendiente);
  });

  it('enviada que el servidor no conoce: vuelve a pendiente para reenviarse con el MISMO id', () => {
    const enviada = { ...foto('a'), estado: 'enviada' as const };
    expect(conReenvioFoto(enviada)).toMatchObject({ id: 'a', estado: 'pendiente' });
    const sinFoto = { ...enviada, foto: null };
    expect(conReenvioFoto(sinFoto)).toBe(sinFoto);
  });

  it('409 (ese id con otra foto): la misma foto con otro id, pendiente', () => {
    const n = conNuevoIdFoto({ ...foto('a'), estado: 'pendiente', error: 'x' }, 'b');
    expect(n).toMatchObject({ id: 'b', estado: 'pendiente', error: null });
    expect(n.datos.id).toBe('b');
  });

  it('reintento con espera creciente', () => {
    expect([1, 2, 3, 4, 5, 9].map(retrasoReintentoFotoMs)).toEqual([5000, 15000, 30000, 60000, 120000, 120000]);
  });

  it('normalizar lo leído del teléfono: dañado = null; la foto solo si son bytes', () => {
    expect(normalizarEvidenciaLocal(null)).toBeNull();
    expect(normalizarEvidenciaLocal({ id: 'a' })).toBeNull();
    const f = foto('a');
    expect(normalizarEvidenciaLocal(f)!.foto).toBe(f.foto);
    expect(normalizarEvidenciaLocal({ ...f, foto: 'texto' })!.foto).toBeNull();
    expect(normalizarEvidenciaLocal({ ...f, estado: 'raro' })).toBeNull();
  });

  describe('sugerencia de la foto del acuse tras Descargado', () => {
    const s = salidaEjemplo(new Date('2026-11-24T16:00:00Z'));
    const cargado = s.viajes[1];
    const descargado = (estado = 'por-confirmar', resultado: string | null = 'por-confirmar') => ({
      id: 'r-desc',
      estado,
      resultado,
      creadoEn: '2026-11-24T17:00:00Z',
      reporte: { tipo: 'estatus', viajeId: cargado.id, estatus: 'Descargado' },
    });
    const conFoto = (extra: Partial<DatosEvidencia>, estado: EvidenciaLocal['estado'] = 'pendiente') => ({
      ...foto('f', '2026-11-24T17:01:00Z', { viajeId: cargado.id, ...extra }),
      estado,
    });

    it('aparece con el id del Descargado', () => {
      expect(sugerenciasAcuse(s.viajes, [descargado()], [], new Set())).toEqual([{ viaje: cargado, reporteId: 'r-desc' }]);
    });

    it('no aparece: sin Descargado, rechazado, "Ahora no", ya hay foto ligada o acuse del viaje, o viaje vacío', () => {
      expect(sugerenciasAcuse(s.viajes, [], [], new Set())).toEqual([]);
      expect(sugerenciasAcuse(s.viajes, [descargado('rechazado', null)], [], new Set())).toEqual([]);
      expect(sugerenciasAcuse(s.viajes, [descargado()], [], new Set(['r-desc']))).toEqual([]);
      expect(sugerenciasAcuse(s.viajes, [descargado()], [conFoto({ reporteId: 'r-desc' })], new Set())).toEqual([]);
      expect(sugerenciasAcuse(s.viajes, [descargado()], [conFoto({ tipo: 'AcuseRecibido' })], new Set())).toEqual([]);
      // Una foto No aceptada no cuenta: se vuelve a sugerir.
      expect(sugerenciasAcuse(s.viajes, [descargado()], [conFoto({ reporteId: 'r-desc' }, 'rechazada')], new Set())).toHaveLength(1);
    });
  });

  it('liga al reporte: sigue al id nuevo; sin el reporte o con el reporte "No aceptado", se quita', () => {
    const ligada = foto('a', '2026-11-24T16:00:00Z', { reporteId: 'r1' });
    expect(conLigaNueva(ligada, 'r1', 'r2').datos.reporteId).toBe('r2');
    expect(conLigaNueva(ligada, 'otro', 'r2')).toBe(ligada);
    expect(sinLigaPerdida(ligada, [{ id: 'r1', estado: 'enviado' }])).toBe(ligada);
    expect(sinLigaPerdida(ligada, [{ id: 'r1', estado: 'rechazado' }]).datos.reporteId).toBeNull();
    expect(sinLigaPerdida(ligada, []).datos.reporteId).toBeNull();
    const suelta = foto('b');
    expect(sinLigaPerdida(suelta, [])).toBe(suelta);
  });
});
