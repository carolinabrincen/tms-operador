/**
 * Pares de texto y fondo del tema (src/tema.scss, referencia aprobada el 26/11/2026). Existe solo para comprobar en
 * pruebas el contraste mínimo de 4.5:1 y que el texto secundario nunca sea más claro que #4B5563. Si cambia un color
 * en tema.scss, cámbielo también aquí.
 */
export const TEXTO_SECUNDARIO = '#4B5563';

export const PARES_TEXTO: readonly { nombre: string; texto: string; fondo: string }[] = [
  { nombre: 'texto principal sobre la página', texto: '#111827', fondo: '#F3F4F6' },
  { nombre: 'texto principal sobre tarjeta', texto: '#111827', fondo: '#FFFFFF' },
  { nombre: 'texto secundario sobre la página', texto: TEXTO_SECUNDARIO, fondo: '#F3F4F6' },
  { nombre: 'texto secundario sobre tarjeta', texto: TEXTO_SECUNDARIO, fondo: '#FFFFFF' },
  { nombre: 'botón principal', texto: '#FFFFFF', fondo: '#1D4ED8' },
  { nombre: 'enlace y menú activo', texto: '#1D4ED8', fondo: '#FFFFFF' },
  { nombre: 'enlace sobre la página', texto: '#1D4ED8', fondo: '#F3F4F6' },
  { nombre: 'paso actual', texto: '#FFFFFF', fondo: '#0F172A' },
  { nombre: 'paso actual, secundario', texto: '#CBD5E1', fondo: '#0F172A' },
  { nombre: '"Usted está aquí"', texto: '#0F172A', fondo: '#FFD666' },
  { nombre: 'incidencia', texto: '#4A2D00', fondo: '#FFF4D6' },
  { nombre: 'incidencia, secundario', texto: '#6B4100', fondo: '#FFF4D6' },
  { nombre: 'con señal', texto: '#12653F', fondo: '#F3F4F6' },
  { nombre: 'sin señal', texto: '#7A4A00', fondo: '#F3F4F6' },
  { nombre: 'franja de ejemplo', texto: '#4A2D00', fondo: '#FFF4D6' },
  { nombre: 'error', texto: '#B42318', fondo: '#FFFFFF' },
  { nombre: 'aviso de error', texto: '#8A1C12', fondo: '#FDECEA' },
  { nombre: 'éxito', texto: '#0D5C27', fondo: '#E7F6EC' },
  { nombre: 'informativo', texto: '#163BA6', fondo: '#E8EEFC' },
  { nombre: 'mensaje oscuro', texto: '#FFFFFF', fondo: '#111827' },
];
