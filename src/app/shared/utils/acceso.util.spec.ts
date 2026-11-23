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

  it('PIN: solo números, de 4 a 8', () => {
    expect(mensajePin('1234')).toBeNull();
    expect(mensajePin('12345678')).toBeNull();
    expect(mensajePin('')).toBe('Escriba su PIN.');
    expect(mensajePin(undefined)).toBe('Escriba su PIN.');
    expect(mensajePin('12a4')).toBe('El PIN solo lleva números.');
    expect(mensajePin('12 34')).toBe('El PIN solo lleva números.');
    expect(mensajePin('123')).toBe('El PIN tiene de 4 a 8 números.');
    expect(mensajePin('123456789')).toBe('El PIN tiene de 4 a 8 números.');
  });

  it('terminación del celular para mostrar', () => {
    expect(terminacionCelular('+52 81 1234 5678')).toBe('5678');
  });
});
