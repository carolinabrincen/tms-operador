import { salidaEjemplo } from '../../core/api/ejemplo/datos-ejemplo';
import { ReporteOperador, ResultadoReporte, ViajeCargado } from '../../core/api/operador-api.modelos';
import { ReporteParaGuia } from './estatus-viaje.util';
import { QUIEN, lineaDeTiempo } from './linea-tiempo.util';

const viaje = salidaEjemplo(new Date('2026-11-23T16:00:00Z')).viajes[1] as ViajeCargado;

function local(reporte: ReporteOperador, estado: string, resultado: ResultadoReporte | null = null): ReporteParaGuia {
  return { reporte, estado, resultado };
}

describe('linea-tiempo.util: lo ocurrido en el viaje, con hora y quién', () => {
  const conHistorial: ViajeCargado = {
    ...viaje,
    estatus: 'EnPatioOrigen',
    historial: [
      { tipo: 'estatus', estatus: 'Asignado', nota: null, ocurrioEn: '2026-11-23T15:00:00Z', autor: 'oficina', reporteId: null },
      { tipo: 'estatus', estatus: 'EnPosicionamiento', nota: null, ocurrioEn: '2026-11-23T15:10:00Z', autor: 'operador', reporteId: 'a' },
      { tipo: 'incidencia', incidencia: 'RetenOInspeccion', nota: 'Revisión de Guardia Nacional', ocurrioEn: '2026-11-23T15:20:00Z', autor: 'operador', reporteId: 'b' },
      { tipo: 'estatus', estatus: 'EnPatioOrigen', nota: null, ocurrioEn: '2026-11-23T15:40:00Z', autor: 'operador', reporteId: 'c' },
    ],
  };

  it('del servidor: estatus e incidencias en orden, con quién los puso', () => {
    const l = lineaDeTiempo(conHistorial, []);
    expect(l.map((e) => [e.texto, QUIEN[e.autor], e.marca])).toEqual([
      ['Asignado', 'Oficina', null],
      ['En camino a cargar', 'Usted', null],
      ['Incidencia: Retén o inspección', 'Usted', null],
      ['En patio de origen', 'Usted', null],
    ]);
    expect(l[2].nota).toBe('Revisión de Guardia Nacional');
  });

  it('agrega lo reportado que el servidor aún no refleja, marcado; no duplica lo que ya está', () => {
    const yaEsta = local({ tipo: 'estatus', id: 'c', viajeId: viaje.id, estatus: 'EnPatioOrigen', ocurrioEn: '2026-11-23T15:40:00Z', ubicacion: null, nota: null }, 'enviado');
    const pendiente = local({ tipo: 'estatus', id: 'd', viajeId: viaje.id, estatus: 'EnCarga', ocurrioEn: '2026-11-23T16:00:00Z', ubicacion: null, nota: 'Rampa 4' }, 'pendiente');
    const hito = local({ tipo: 'estatus', id: 'e', viajeId: viaje.id, estatus: 'Documentado', ocurrioEn: '2026-11-23T16:30:00Z', ubicacion: null, nota: null }, 'por-confirmar');
    const incidencia = local({ tipo: 'incidencia', id: 'f', viajeId: viaje.id, incidencia: 'Otro', ocurrioEn: '2026-11-23T16:10:00Z', ubicacion: null, nota: 'Lluvia' }, 'pendiente');
    const l = lineaDeTiempo(conHistorial, [hito, yaEsta, pendiente, incidencia]);
    expect(l.slice(4).map((e) => [e.texto, e.marca, e.nota])).toEqual([
      ['Cargando', 'Pendiente de enviar', 'Rampa 4'],
      ['Incidencia: Otro', 'Pendiente de enviar', 'Lluvia'],
      ['Documentado', 'Pendiente de confirmar por oficina', null],
    ]);
    expect(l).toHaveLength(7);
  });

  it('no muestra rechazados, descartados, estatus sin efecto ni reportes de otro viaje', () => {
    const base = { viajeId: viaje.id, ocurrioEn: '2026-11-23T16:00:00Z', ubicacion: null, nota: null };
    const l = lineaDeTiempo(conHistorial, [
      local({ ...base, tipo: 'estatus', id: 'x1', estatus: 'EnCarga' }, 'rechazado'),
      local({ ...base, tipo: 'estatus', id: 'x2', estatus: 'EnCarga' }, 'enviado', 'sin-efecto'),
      local({ ...base, tipo: 'estatus', id: 'x4', estatus: 'EnCarga' }, 'descartado', 'descartado'),
      local({ ...base, tipo: 'estatus', id: 'x3', estatus: 'EnCarga', viajeId: 'otro' }, 'pendiente'),
    ]);
    expect(l).toHaveLength(4);
  });

  it('viaje recién asignado: solo "Asignado" por la oficina', () => {
    expect(lineaDeTiempo(viaje, []).map((e) => `${e.texto} · ${QUIEN[e.autor]}`)).toEqual(['Asignado · Oficina']);
  });
});
