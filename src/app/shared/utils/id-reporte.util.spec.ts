import { FORMATO_UUID_V4, generarIdReporte } from './id-reporte.util';

describe('id-reporte.util: id único generado en el teléfono', () => {
  it('usa crypto.randomUUID cuando existe', () => {
    expect(generarIdReporte({ randomUUID: () => '11111111-2222-4333-8444-555555555555' })).toBe('11111111-2222-4333-8444-555555555555');
  });

  it('sin randomUUID (http en la red local) arma un UUID v4 válido con getRandomValues', () => {
    const c = { getRandomValues: <T extends ArrayBufferView | null>(a: T) => (new Uint8Array(a!.buffer).fill(0xff), a) };
    const id = generarIdReporte(c as Pick<Crypto, 'getRandomValues'>);
    expect(id).toMatch(FORMATO_UUID_V4);
    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });

  it('sin crypto también da un UUID v4 válido', () => {
    expect(generarIdReporte({})).toMatch(FORMATO_UUID_V4);
  });

  it('no se repite', () => {
    const ids = new Set(Array.from({ length: 500 }, () => generarIdReporte()));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(FORMATO_UUID_V4);
  });
});
