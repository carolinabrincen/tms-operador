import { hojaRutaEjemplo, salidaEjemplo } from '../../core/api/ejemplo/datos-ejemplo';
import { EstatusViaje, Salida, Viaje } from '../../core/api/operador-api.modelos';
import { ReporteParaGuia, viajeActivo } from './estatus-viaje.util';
import { estadoTramo, indiceTramoActual, textoRecorrido, tramosEnOrden } from './tramos-hoja.util';

const AHORA = new Date('2026-11-23T16:00:00Z');
const hoja = hojaRutaEjemplo(AHORA);
const salida = salidaEjemplo(AHORA);

let n = 0;
function reporte(viajeId: string, estatus: EstatusViaje): ReporteParaGuia {
  n++;
  return {
    reporte: { tipo: 'estatus', id: `r${n}`, viajeId, estatus, ocurrioEn: '2026-11-23T16:00:00Z', ubicacion: null, nota: null },
    estado: 'enviado',
    resultado: 'aplicado',
  };
}
const conEstatus = (s: Salida, cambios: Record<string, EstatusViaje>): Salida => ({
  ...s,
  viajes: s.viajes.map((v) => (cambios[v.id] ? ({ ...v, estatus: cambios[v.id] } as Viaje) : v)),
});

describe('tramos-hoja.util: el tramo actual es el viaje que Mi viaje presenta como el que toca', () => {
  it('recién asignada: el tramo 1, un movimiento vacío (sin folio: se busca por orden)', () => {
    expect(indiceTramoActual(hoja, salida, [])).toBe(0);
    expect(tramosEnOrden(hoja)[0].tipo).toBe('vacio');
  });

  it('cargado: cuando el operador termina el vacío, el tramo 2 (por folio del viaje)', () => {
    const reportes = [reporte('ej-via-770', 'EnTransitoVacio'), reporte('ej-via-770', 'EnPatio')];
    expect(viajeActivo(salida, reportes)!.id).toBe('ej-via-771'); // la misma regla que Mi viaje
    const i = indiceTramoActual(hoja, salida, reportes)!;
    expect(i).toBe(1);
    expect(tramosEnOrden(hoja)[i]).toMatchObject({ tipo: 'cargado', folio: 'VIA-2026-00771' });
  });

  it('último tramo: con los anteriores cerrados, el 4 (vacío al taller)', () => {
    const s = conEstatus(salida, { 'ej-via-770': 'Cerrado', 'ej-via-771': 'Cerrado', 'ej-via-772': 'Cerrado' });
    expect(indiceTramoActual(hoja, s, [])).toBe(3);
  });

  it('si el operador ya terminó el último pero la oficina no lo cierra, sigue siendo el actual', () => {
    const s = conEstatus(salida, { 'ej-via-770': 'Cerrado', 'ej-via-771': 'Cerrado', 'ej-via-772': 'Cerrado' });
    const reportes = [reporte('ej-via-773', 'EnTransitoVacio'), reporte('ej-via-773', 'EnTaller')];
    expect(indiceTramoActual(hoja, s, reportes)).toBe(3);
  });

  it('un solo tramo: ese', () => {
    const unSolo = { ...hoja, itinerario: [hoja.itinerario[1]] };
    const s = { ...salida, viajes: [salida.viajes[1]] };
    expect(indiceTramoActual(unSolo, s, [])).toBe(0);
  });

  it('no se sabe: sin asignación, sin hoja o con todo cerrado', () => {
    expect(indiceTramoActual(hoja, null, [])).toBeNull();
    expect(indiceTramoActual(null, salida, [])).toBeNull();
    const cerrada = conEstatus(salida, { 'ej-via-770': 'Cerrado', 'ej-via-771': 'Cerrado', 'ej-via-772': 'Cancelado', 'ej-via-773': 'Cerrado' });
    expect(indiceTramoActual(hoja, cerrada, [])).toBeNull();
  });
});

describe('tramos-hoja.util: estado en palabras de cada tramo para la lista', () => {
  it('antes del actual Terminado; el actual; el que sigue Siguiente; los demás Pendiente', () => {
    expect([0, 1, 2, 3].map((i) => estadoTramo(i, 1))).toEqual(['terminado', 'actual', 'siguiente', 'pendiente']);
    expect([0, 1, 2, 3].map((i) => estadoTramo(i, 3))).toEqual(['terminado', 'terminado', 'terminado', 'actual']);
  });

  it('sin tramo actual: todos Terminado si ya no hay viaje activo; si no se sabe, Pendiente', () => {
    expect(estadoTramo(0, null, true)).toBe('terminado');
    expect(estadoTramo(2, null)).toBe('pendiente');
  });

  it('recorrido: "origen → destino"', () => {
    expect(textoRecorrido(tramosEnOrden(hoja)[1])).toBe('Apodaca, N.L. → Saltillo, Coah.');
  });
});
