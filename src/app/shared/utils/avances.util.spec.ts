import { despachoEjemplo, movimientosEjemplo } from '../../core/api/ejemplo/datos-ejemplo';
import { ObjetivoReporte, TipoAvance } from '../../core/api/operador-api.modelos';
import {
  AVANCES_VACIO,
  AVANCES_VIAJE,
  ETIQUETA_AVANCE,
  ReporteParaAvance,
  avancesDeTramo,
  claveObjetivo,
  estaTerminado,
  objetivoDeMovimiento,
  objetivoDeTramo,
  reportesDelObjetivo,
  siguienteAvance,
  tituloMovimiento,
  tituloTramo,
  tramoQueToca,
  ultimoDeAvance,
} from './avances.util';

const ahora = new Date('2026-11-23T16:00:00Z');
const despacho = despachoEjemplo(ahora);
const [vacioIda, cargado1, cargado2, regreso] = despacho.tramos;

let minuto = 0;
function rep(objetivo: ObjetivoReporte, avance: TipoAvance, estado = 'enviado'): ReporteParaAvance {
  minuto++;
  return { reporte: { objetivo, avance, ocurrioEn: `2026-11-23T16:${String(minuto).padStart(2, '0')}:00Z` }, estado };
}

describe('avances.util: avances por tipo de tramo y lo que toca', () => {
  it('viaje (tramo cargado): 6 avances en orden; vacío y movimiento en vacío: Salí, Llegué, Terminé', () => {
    expect(AVANCES_VIAJE.map((a) => ETIQUETA_AVANCE[a])).toEqual(['Salí', 'Llegué a cargar', 'Cargado', 'Llegué a descargar', 'Entregado', 'Terminé']);
    expect(AVANCES_VACIO.map((a) => ETIQUETA_AVANCE[a])).toEqual(['Salí', 'Llegué', 'Terminé']);
    expect(avancesDeTramo(cargado1)).toBe(AVANCES_VIAJE);
    expect(avancesDeTramo(vacioIda)).toBe(AVANCES_VACIO);
    expect(avancesDeTramo(regreso)).toBe(AVANCES_VACIO);
  });

  it('el ejemplo trae vacío → cargado → cargado → regreso vacío', () => {
    expect(despacho.tramos.map((t) => `${t.orden}:${t.tipo}`)).toEqual(['1:vacio', '2:cargado', '3:cargado', '4:vacio']);
  });

  it('objetivos: el de un tramo cargado lleva el viaje; la llave distingue tramo y movimiento', () => {
    expect(objetivoDeTramo(despacho, cargado1)).toEqual({ tipo: 'tramo', despachoId: despacho.id, tramoId: cargado1.id, viajeId: 'ej-via-771' });
    expect(objetivoDeTramo(despacho, vacioIda)).toEqual({ tipo: 'tramo', despachoId: despacho.id, tramoId: vacioIda.id, viajeId: null });
    const mov = movimientosEjemplo(ahora)[0];
    expect(claveObjetivo(objetivoDeMovimiento(mov))).toBe(`movimiento:${mov.id}`);
    expect(claveObjetivo(objetivoDeTramo(despacho, vacioIda))).toBe(`tramo:${vacioIda.id}`);
  });

  it('tramo que toca: el primero sin "Terminé"; los rechazados no cuentan; null si todo terminó', () => {
    const oVacio = objetivoDeTramo(despacho, vacioIda);
    const oC1 = objetivoDeTramo(despacho, cargado1);
    expect(tramoQueToca(despacho, [])).toBe(vacioIda);
    expect(tramoQueToca(despacho, [rep(oVacio, 'sali'), rep(oVacio, 'llegue')])).toBe(vacioIda);
    expect(tramoQueToca(despacho, [rep(oVacio, 'termine')])).toBe(cargado1);
    expect(tramoQueToca(despacho, [rep(oVacio, 'termine', 'rechazado')])).toBe(vacioIda);
    // Un "Terminé" pendiente de enviar sí cuenta: el operador ya lo reportó.
    expect(tramoQueToca(despacho, [rep(oVacio, 'termine', 'pendiente'), rep(oC1, 'termine', 'pendiente')])).toBe(cargado2);
    const todos = despacho.tramos.map((t) => rep(objetivoDeTramo(despacho, t), 'termine'));
    expect(tramoQueToca(despacho, todos)).toBeNull();
    expect(tramoQueToca({ ...despacho, tramos: [] }, [])).toBeNull();
  });

  it('el tramo que toca respeta el orden aunque los tramos lleguen desordenados', () => {
    const desordenado = { ...despacho, tramos: [regreso, cargado2, vacioIda, cargado1] };
    expect(tramoQueToca(desordenado, [])).toBe(vacioIda);
  });

  it('siguiente avance: el que sigue al más avanzado; null tras "Terminé"', () => {
    const o = objetivoDeTramo(despacho, cargado1);
    expect(siguienteAvance(AVANCES_VIAJE, [])).toBe('sali');
    expect(siguienteAvance(AVANCES_VIAJE, [rep(o, 'sali')])).toBe('llegue-cargar');
    // Fuera de orden: sigue al más avanzado.
    expect(siguienteAvance(AVANCES_VIAJE, [rep(o, 'cargado'), rep(o, 'sali')])).toBe('llegue-descargar');
    expect(siguienteAvance(AVANCES_VIAJE, [rep(o, 'entregado')])).toBe('termine');
    expect(siguienteAvance(AVANCES_VIAJE, [rep(o, 'termine')])).toBeNull();
    expect(siguienteAvance(AVANCES_VACIO, [rep(o, 'llegue')])).toBe('termine');
  });

  it('reportes del objetivo: solo los suyos, sin rechazados, del más antiguo al más reciente; último de un avance', () => {
    const o1 = objetivoDeTramo(despacho, cargado1);
    const o2 = objetivoDeTramo(despacho, cargado2);
    const a = rep(o1, 'sali');
    const b = rep(o2, 'sali');
    const c = rep(o1, 'llegue-cargar', 'rechazado');
    const d = rep(o1, 'sali', 'pendiente');
    const lista = reportesDelObjetivo([d, c, b, a], o1);
    expect(lista).toEqual([a, d]);
    expect(ultimoDeAvance(lista, 'sali')).toBe(d);
    expect(ultimoDeAvance(lista, 'cargado')).toBeNull();
    expect(estaTerminado(lista)).toBe(false);
  });

  it('títulos para pantalla', () => {
    expect(tituloTramo(cargado1)).toBe('Tramo 2 · Cargado · Apodaca, N.L. → Saltillo, Coah.');
    expect(tituloTramo(regreso)).toBe('Tramo 4 · Vacío · San Luis Potosí, S.L.P. → Patio Guadalupe, N.L.');
    expect(tituloMovimiento(movimientosEjemplo(ahora)[0])).toBe(
      'Movimiento en vacío · Carga de combustible · Patio Guadalupe, N.L. → Estación de diésel, Carr. Miguel Alemán km 12',
    );
  });
});
