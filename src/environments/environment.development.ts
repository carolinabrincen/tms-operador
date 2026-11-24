import { Entorno } from './entorno.model';

/** Desarrollo (ng serve). Sin secretos: solo direcciones y banderas. */
export const environment: Entorno = {
  production: false,
  // Misma API local que el frontend de oficina. Con fuenteDatos 'ejemplo' no se usa; ver environment.api-local.ts.
  apiUrl: 'https://localhost:58120/api',
  fuenteDatos: 'ejemplo',
};
