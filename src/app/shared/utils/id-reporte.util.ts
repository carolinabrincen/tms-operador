/**
 * Id único de un reporte, generado EN EL TELÉFONO (UUID v4). Con él el servidor reconoce un reenvío y no duplica.
 *
 * crypto.randomUUID solo existe en contexto seguro (HTTPS o localhost); al probar en el celular por la red local
 * (http://192.168…) no está, así que se arma el UUID con crypto.getRandomValues, que sí existe. PURO.
 */

type CryptoMinimo = Partial<Pick<Crypto, 'randomUUID' | 'getRandomValues'>>;

export const FORMATO_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function generarIdReporte(c: CryptoMinimo | undefined = globalThis.crypto): string {
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // versión 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
