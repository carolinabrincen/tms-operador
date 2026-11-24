import { ETIQUETA_INCIDENCIA, INCIDENCIAS, LARGO_NOTA, esTipoIncidencia, mensajeIncidencia } from './incidencias.util';

describe('incidencias.util: incidencias del camino', () => {
  it('valores del backend (P10 a), en orden', () => {
    expect(INCIDENCIAS).toEqual(['DetenidoEnParador', 'IncidenciaMecanica', 'RetenOInspeccion', 'DesvioDeRuta', 'Otro']);
  });

  it('las cinco opciones con su texto en pantalla, en orden', () => {
    expect(INCIDENCIAS.map((t) => ETIQUETA_INCIDENCIA[t])).toEqual(['Detenido en parador', 'Falla mecánica', 'Retén o inspección', 'Desvío de ruta', 'Otro']);
  });

  it('hay que elegir el tipo', () => {
    expect(mensajeIncidencia(null, 'algo')).toBe('Elija qué pasó.');
  });

  it('la nota es opcional, salvo en "Otro"', () => {
    expect(mensajeIncidencia('IncidenciaMecanica', '')).toBeNull();
    expect(mensajeIncidencia('Otro', '')).toBe('En “Otro” escriba en la nota qué pasó.');
    expect(mensajeIncidencia('Otro', '   ')).toBe('En “Otro” escriba en la nota qué pasó.');
    expect(mensajeIncidencia('Otro', 'Lluvia fuerte, me orillé')).toBeNull();
  });

  it('nota demasiado larga', () => {
    expect(mensajeIncidencia('DesvioDeRuta', 'x'.repeat(LARGO_NOTA + 1))).toBe(`La nota puede tener hasta ${LARGO_NOTA} letras.`);
  });

  it('reconoce tipos válidos', () => {
    expect(esTipoIncidencia('RetenOInspeccion')).toBe(true);
    // Los nombres viejos del paso 2 ya no valen (el backend responde 400).
    expect(esTipoIncidencia('RetenInspeccion')).toBe(false);
    expect(esTipoIncidencia('Choque')).toBe(false);
    expect(esTipoIncidencia(3)).toBe(false);
  });
});
