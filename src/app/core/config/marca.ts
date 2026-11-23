import marca from '../../../marca.json';

/**
 * Marca de la app. ÚNICA fuente: src/marca.json (nombre visible, nombre corto, colores).
 * El manifest, el <title> de index.html y los iconos se regeneran desde ahí con `npm run marca`.
 */
export interface Marca {
  nombre: string;
  nombreCorto: string;
  descripcion: string;
  colorTema: string;
  colorFondo: string;
}

export const MARCA: Readonly<Marca> = marca;
