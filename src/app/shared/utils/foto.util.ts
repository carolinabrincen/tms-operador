/**
 * Reducir la foto antes de subirla (contrato M2, 2): lado mayor a 1600 px y JPEG al 80 % (0.3 a 0.6 MB). Siempre sale
 * JPEG, aunque entre PNG o HEIC: el servidor solo acepta JPG o PNG y revisa el contenido.
 *
 * Las piezas del navegador (decodificar y codificar) van aparte, en HerramientasFoto, para poder probar sin navegador.
 */
import { InjectionToken } from '@angular/core';

export const LADO_MAXIMO_FOTO = 1600;
export const CALIDAD_JPEG = 0.8;
export const TIPO_FOTO = 'image/jpeg';

/** Medidas finales: el lado mayor queda en `max` como mucho; nunca se agranda. */
export function medidasReducidas(ancho: number, alto: number, max = LADO_MAXIMO_FOTO): { ancho: number; alto: number } {
  if (!(ancho > 0) || !(alto > 0)) throw new Error('Medidas de la foto inválidas.');
  const escala = Math.min(1, max / Math.max(ancho, alto));
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) };
}

export interface ImagenDecodificada {
  ancho: number;
  alto: number;
  fuente: CanvasImageSource;
  liberar?: () => void;
}

export interface HerramientasFoto {
  /** Lee la imagen respetando la orientación de la cámara (EXIF). */
  decodificar(archivo: Blob): Promise<ImagenDecodificada>;
  /** Dibuja la imagen a esas medidas (sobre fondo blanco: un PNG transparente no queda negro) y la codifica. */
  codificar(imagen: ImagenDecodificada, ancho: number, alto: number, tipo: string, calidad: number): Promise<Blob>;
}

export interface FotoReducida {
  blob: Blob;
  ancho: number;
  alto: number;
}

/** Error al preparar la foto, con un texto de usted para mostrar. */
export class ErrorFoto extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorFoto';
  }
}

export async function reducirFoto(archivo: Blob, h: HerramientasFoto): Promise<FotoReducida> {
  // Nunca PDF ni otros archivos desde la app: solo fotos.
  if (archivo.type && !archivo.type.startsWith('image/')) throw new ErrorFoto('Elija una foto (no un documento).');
  let imagen: ImagenDecodificada;
  try {
    imagen = await h.decodificar(archivo);
  } catch {
    throw new ErrorFoto('No se pudo leer la foto. Tómela de nuevo o elija otra.');
  }
  try {
    const { ancho, alto } = medidasReducidas(imagen.ancho, imagen.alto);
    const blob = await h.codificar(imagen, ancho, alto, TIPO_FOTO, CALIDAD_JPEG);
    return { blob, ancho, alto };
  } catch {
    throw new ErrorFoto('No se pudo preparar la foto. Intente de nuevo.');
  } finally {
    imagen.liberar?.();
  }
}

// ------------------------------------------------------------------ navegador

async function decodificarEnNavegador(archivo: Blob): Promise<ImagenDecodificada> {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    return { ancho: bmp.width, alto: bmp.height, fuente: bmp, liberar: () => bmp.close() };
  }
  // Navegadores sin createImageBitmap: <img> con una URL temporal.
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { ancho: img.naturalWidth, alto: img.naturalHeight, fuente: img };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function codificarEnNavegador(imagen: ImagenDecodificada, ancho: number, alto: number, tipo: string, calidad: number): Promise<Blob> {
  if (typeof OffscreenCanvas === 'function') {
    const lienzo = new OffscreenCanvas(ancho, alto);
    const ctx = lienzo.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(imagen.fuente, 0, 0, ancho, alto);
    return lienzo.convertToBlob({ type: tipo, quality: calidad });
  }
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ancho, alto);
  ctx.drawImage(imagen.fuente, 0, 0, ancho, alto);
  return new Promise<Blob>((resolver, rechazar) => lienzo.toBlob((b) => (b ? resolver(b) : rechazar(new Error('toBlob'))), tipo, calidad));
}

export const HERRAMIENTAS_FOTO = new InjectionToken<HerramientasFoto>('HERRAMIENTAS_FOTO', {
  providedIn: 'root',
  factory: () => ({ decodificar: decodificarEnNavegador, codificar: codificarEnNavegador }),
});

/** Bytes de un Blob (con respaldo para navegadores viejos sin Blob.arrayBuffer). */
export function bytesDeBlob(b: Blob): Promise<ArrayBuffer> {
  if (typeof b.arrayBuffer === 'function') return b.arrayBuffer();
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result as ArrayBuffer);
    lector.onerror = () => rechazar(lector.error);
    lector.readAsArrayBuffer(b);
  });
}

/** URL temporal para mostrar una imagen guardada en memoria (null si el navegador no puede). Hay que liberarla. */
export function urlDeImagen(b: Blob): string | null {
  return typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(b) : null;
}

export function liberarUrl(url: string | null): void {
  if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
}
