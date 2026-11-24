import { mensajeCelular, mensajePin, normalizarCelular, terminacionCelular } from './acceso.util';

describe('acceso.util: celular a 10 dígitos y PIN numérico', () => {
  it('normaliza el celular: quita espacios, guiones, paréntesis y la lada de país', () => {
    expect(normalizarCelular('81 1234 5678')).toBe('8112345678');
    expect(normalizarCelular('(81) 1234-5678')).toBe('8112345678');
    expect(normalizarCelular('+52 81 1234 5678')).toBe('8112345678');
    expect(normalizarCelular('+52 1 81 1234 5678')).toBe('8112345678');
    expect(normalizarCelular(null)).toBe('');
  });

  it('celular válido = null; inválido = mensaje claro', () => {
    expect(mensajeCelular('8112345678')).toBeNull();
    expect(mensajeCelular('+52 81 1234 5678')).toBeNull();
    expect(mensajeCelular('')).toBe('Escriba su número de celular.');
    expect(mensajeCelular('   ')).toBe('Escriba su número de celular.');
    expect(mensajeCelular('81123')).toBe('El celular debe tener 10 dígitos (lleva 5).');
    expect(mensajeCelular('811234567890')).toBe('El celular debe tener 10 dígitos (lleva 12).');
    expect(mensajeCelular('81abc45678')).toBe('El celular solo lleva números.');
  });

  it('PIN: exactamente 6 números (contrato M1)', () => {
    expect(mensajePin('482915')).toBeNull();
    expect(mensajePin('')).toBe('Escriba su PIN.');
    expect(mensajePin(undefined)).toBe('Escriba su PIN.');
    expect(mensajePin('12a456')).toBe('El PIN solo lleva números.');
    expect(mensajePin('123 45')).toBe('El PIN solo lleva números.');
    expect(mensajePin('1234')).toBe('El PIN tiene 6 números (lleva 4).');
    expect(mensajePin('12345')).toBe('El PIN tiene 6 números (lleva 5).');
    expect(mensajePin('1234567')).toBe('El PIN tiene 6 números (lleva 7).');
  });

  it('terminación del celular para mostrar', () => {
    expect(terminacionCelular('+52 81 1234 5678')).toBe('5678');
  });
});
