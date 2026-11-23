import { CONTRASTE_MINIMO_SOL, contraste, luminancia } from './contraste.util';

describe('contraste.util: contraste WCAG', () => {
  it('casos conocidos', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contraste('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    // Gris #767676 sobre blanco: el límite clásico de AA (≈ 4.54).
    expect(contraste('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('no importa el orden', () => {
    expect(contraste('#0b3d91', '#ffffff')).toBe(contraste('#ffffff', '#0b3d91'));
  });

  it('mínimo para pleno sol: 7 (AAA)', () => {
    expect(CONTRASTE_MINIMO_SOL).toBe(7);
  });

  it('color inválido = error', () => {
    expect(() => luminancia('azul')).toThrow('Color inválido');
  });
});
