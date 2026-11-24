import { Entorno } from './entorno.model';

/**
 * Desarrollo contra la API REAL local (npm run start:api): la app en http://localhost:4300 y TMS.WebAPI en
 * https://localhost:58120. El servidor debe tener http://localhost:4300 en Cors:OrigenesOperador y el navegador debe
 * confiar en el certificado de desarrollo de .NET. Sin secretos.
 */
export const environment: Entorno = {
  production: false,
  apiUrl: 'https://localhost:58120/api',
  fuenteDatos: 'api',
};
