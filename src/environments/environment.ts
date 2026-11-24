import { Entorno } from './entorno.model';

/** Producción. Sin secretos: solo direcciones públicas y banderas. */
export const environment: Entorno = {
  production: true,
  // AJUSTAR a la URL pública de TMS.WebAPI (con /api) cuando se publique contra la API real.
  apiUrl: '',
  // Datos de ejemplo hasta que Carolina diga lo contrario. Para la API real: 'api' y apiUrl.
  fuenteDatos: 'ejemplo',
};
