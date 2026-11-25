import { CALIDAD_JPEG, ErrorFoto, HerramientasFoto, LADO_MAXIMO_FOTO, TIPO_FOTO, medidasReducidas, reducirFoto } from './foto.util';

/** Herramientas falsas: "decodifica" con las medidas dadas y registra cómo se pidió codificar. */
function herramientas(ancho: number, alto: number) {
  const liberar = vi.fn();
  const codificar = vi.fn(async (_img, w: number, h: number, tipo: string, _calidad: number) => new Blob([new Uint8Array(w)], { type: tipo }));
  const h: HerramientasFoto = {
    decodificar: vi.fn(async () => ({ ancho, alto, fuente: {} as CanvasImageSource, liberar })),
    codificar,
  };
  return { h, liberar, codificar };
}

describe('foto.util: reducir antes de subir (1600 px, JPEG al 80 %)', () => {
  it('constantes del contrato', () => {
    expect([LADO_MAXIMO_FOTO, CALIDAD_JPEG, TIPO_FOTO]).toEqual([1600, 0.8, 'image/jpeg']);
  });

  it('el lado mayor queda en 1600 y se conserva la proporción; nunca se agranda', () => {
    expect(medidasReducidas(4032, 3024)).toEqual({ ancho: 1600, alto: 1200 });
    expect(medidasReducidas(3024, 4032)).toEqual({ ancho: 1200, alto: 1600 });
    expect(medidasReducidas(1000, 800)).toEqual({ ancho: 1000, alto: 800 });
    expect(medidasReducidas(10000, 10)).toEqual({ ancho: 1600, alto: 2 });
    expect(() => medidasReducidas(0, 10)).toThrow();
  });

  it('una foto de cámara (4032×3024) sale JPEG 1600×1200 al 80 % y se libera la imagen', async () => {
    const { h, liberar, codificar } = herramientas(4032, 3024);
    const r = await reducirFoto(new Blob(['x'], { type: 'image/jpeg' }), h);
    expect(r).toMatchObject({ ancho: 1600, alto: 1200 });
    expect(r.blob.type).toBe('image/jpeg');
    expect(codificar).toHaveBeenCalledWith(expect.anything(), 1600, 1200, 'image/jpeg', 0.8);
    expect(liberar).toHaveBeenCalledOnce();
  });

  it('un PNG de la galería también sale JPEG (el servidor acepta JPG o PNG; JPEG pesa menos)', async () => {
    const { h, codificar } = herramientas(800, 600);
    const r = await reducirFoto(new Blob(['x'], { type: 'image/png' }), h);
    expect(r.blob.type).toBe('image/jpeg');
    expect(codificar).toHaveBeenCalledWith(expect.anything(), 800, 600, 'image/jpeg', 0.8);
  });

  it('nunca un PDF u otro documento; foto ilegible: mensaje de usted', async () => {
    const { h } = herramientas(10, 10);
    await expect(reducirFoto(new Blob(['%PDF'], { type: 'application/pdf' }), h)).rejects.toThrow('Elija una foto (no un documento).');
    const ilegible: HerramientasFoto = { ...h, decodificar: async () => Promise.reject(new Error('x')) };
    const e = await reducirFoto(new Blob(['x'], { type: 'image/jpeg' }), ilegible).catch((x) => x);
    expect(e).toBeInstanceOf(ErrorFoto);
    expect(e.message).toBe('No se pudo leer la foto. Tómela de nuevo o elija otra.');
  });

  it('si falla al codificar, también se libera la imagen', async () => {
    const { h, liberar } = herramientas(2000, 1000);
    const falla: HerramientasFoto = { ...h, codificar: async () => Promise.reject(new Error('x')) };
    await expect(reducirFoto(new Blob(['x'], { type: 'image/jpeg' }), falla)).rejects.toThrow('No se pudo preparar la foto. Intente de nuevo.');
    expect(liberar).toHaveBeenCalledOnce();
  });
});
