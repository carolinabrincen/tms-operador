import { contraste, luminancia } from '../../shared/utils/contraste.util';
import { PARES_TEXTO, TEXTO_SECUNDARIO } from './tema-colores';

describe('tema: contraste de la referencia aprobada', () => {
  it('todo texto con contraste de al menos 4.5:1 sobre su fondo', () => {
    for (const p of PARES_TEXTO) expect(contraste(p.texto, p.fondo), p.nombre).toBeGreaterThanOrEqual(4.5);
  });

  it('ningún texto gris más claro que el secundario #4B5563', () => {
    const grises = PARES_TEXTO.map((p) => p.texto).filter((c) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
      return Math.max(r, g, b) - Math.min(r, g, b) < 40 && c !== '#FFFFFF' && c !== '#CBD5E1';
    });
    for (const c of grises) expect(luminancia(c), c).toBeLessThanOrEqual(luminancia(TEXTO_SECUNDARIO));
  });
});
