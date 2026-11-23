import { ETIQUETA_INCIDENCIA, INCIDENCIAS, LARGO_NOTA, esTipoIncidencia, mensajeIncidencia } from './incidencias.util';

describe('incidencias.util: incidencias del camino', () => {
  it('las cinco opciones, en orden', () => {
    expect(INCIDENCIAS.map((t) => ETIQUETA_INCIDENCIA[t])).toEqual(['Detenido en parador', 'Falla mecánica', 'Retén o inspección', 'Desvío de ruta', 'Otro']);
  });

  it('hay que elegir el tipo', () => {
    expect(mensajeIncidencia(null, 'algo')).toBe('Elija qué pasó.');
  });

  it('la nota es opcional, salvo en "Otro"', () => {
    expect(mensajeIncidencia('FallaMecanica', '')).toBeNull();
    expect(mensajeIncidencia('Otro', '')).toBe('En “Otro” escriba en la nota qué pasó.');
    expect(mensajeIncidencia('Otro', '   ')).toBe('En “Otro” escriba en la nota qué pasó.');
    expect(mensajeIncidencia('Otro', 'Lluvia fuerte, me orillé')).toBeNull();
  });

  it('nota demasiado larga', () => {
    expect(mensajeIncidencia('DesvioRuta', 'x'.repeat(LARGO_NOTA + 1))).toBe(`La nota puede tener hasta ${LARGO_NOTA} letras.`);
  });

  it('reconoce tipos válidos', () => {
    expect(esTipoIncidencia('RetenInspeccion')).toBe(true);
    expect(esTipoIncidencia('Choque')).toBe(false);
    expect(esTipoIncidencia(3)).toBe(false);
  });
});
