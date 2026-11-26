import { ETIQUETA_ESTATUS } from './estatus-viaje.util';
import { PASOS_ESTATUS_REM, anchoEstimado, tamanoEstatus } from './tamano-estatus.util';

/** Ancho del renglón del estatus: pantalla − márgenes (18 + 18) − relleno del bloque (16 + 16). */
const renglon = (pantalla: number) => pantalla - 36 - 32;

describe('tamano-estatus.util: el estatus no se parte en dos renglones si puede evitarse', () => {
  it('pasos de 40, 36, 32 y 28 px (en rem)', () => {
    expect(PASOS_ESTATUS_REM.map((r) => r * 16)).toEqual([40, 36, 32, 28]);
  });

  it('corto: 40 px en un renglón aun en la pantalla más angosta', () => {
    expect(tamanoEstatus('Asignado', renglon(360))).toEqual({ rem: 2.5, dosRenglones: false });
    expect(tamanoEstatus('Cargando', renglon(360))).toEqual({ rem: 2.5, dosRenglones: false });
  });

  it('más largo: baja por pasos; nunca de 28 px; dos renglones solo si ni a 28 px cabe', () => {
    // 15 caracteres a 390 px: no cabe a 40; cabe a 36.
    expect(tamanoEstatus('Revisión aduana', renglon(390))).toEqual({ rem: 2.25, dosRenglones: false });
    // "En camino a cargar" (18) a 412 px: 32 px.
    expect(tamanoEstatus(ETIQUETA_ESTATUS.EnPosicionamiento, renglon(412))).toEqual({ rem: 2, dosRenglones: false });
    // "En patio de destino" (19) a 390 px: 28 px, en un renglón.
    expect(tamanoEstatus(ETIQUETA_ESTATUS.EnPatioDestino, renglon(390))).toEqual({ rem: 1.75, dosRenglones: false });
    // "En tránsito (vacío)" (19) a 360 px: ni a 28 px cabe → dos renglones a 28 px (nunca más chico).
    expect(tamanoEstatus(ETIQUETA_ESTATUS.EnTransitoVacio, renglon(360))).toEqual({ rem: 1.75, dosRenglones: true });
    // "En tránsito" (11) cabe a 40 px aun a 360.
    expect(tamanoEstatus(ETIQUETA_ESTATUS.EnTransito, renglon(360))).toEqual({ rem: 2.5, dosRenglones: false });
  });

  it('el tamaño elegido es el más grande que cabe', () => {
    for (const texto of Object.values(ETIQUETA_ESTATUS)) {
      for (const pantalla of [360, 390, 412]) {
        const t = tamanoEstatus(texto, renglon(pantalla));
        const i = PASOS_ESTATUS_REM.indexOf(t.rem as (typeof PASOS_ESTATUS_REM)[number]);
        if (!t.dosRenglones) expect(anchoEstimado(texto, t.rem * 16), texto).toBeLessThanOrEqual(renglon(pantalla));
        if (i > 0) expect(anchoEstimado(texto, PASOS_ESTATUS_REM[i - 1] * 16), texto).toBeGreaterThan(renglon(pantalla));
      }
    }
  });

  it('con la medida real de la letra (cuando el navegador puede medir) y con letra grande del sistema', () => {
    const medir = (texto: string, px: number) => texto.length * 0.5 * px;
    expect(tamanoEstatus('En patio de origen', 330, 16, medir)).toEqual({ rem: 2.25, dosRenglones: false }); // 18 × 0.5 × 36 = 324
    // 1rem = 20 px (letra grande): los mismos pasos en rem, pero más anchos en px.
    expect(tamanoEstatus('En patio de origen', 330, 20, medir)).toEqual({ rem: 1.75, dosRenglones: false }); // 18 × 0.5 × 35 = 315
    // Si el navegador no puede medir, se estima por la longitud.
    expect(tamanoEstatus('Asignado', 300, 16, () => null)).toEqual({ rem: 2.5, dosRenglones: false });
  });

  it('antes de conocer el ancho (primer dibujo): 40 px', () => {
    expect(tamanoEstatus('En tránsito (vacío)', null)).toEqual({ rem: 2.5, dosRenglones: false });
  });
});
