import { Entorno } from './entorno.model';

/** Desarrollo (ng serve). Sin secretos: solo direcciones y banderas. */
export const environment: Entorno = {
  production: false,
  // Misma API local que usa el frontend de oficina; aún no se consume (no hay contrato del operador).
  apiUrl: 'https://localhost:58120/api',
  fuenteDatos: 'ejemplo',
};
