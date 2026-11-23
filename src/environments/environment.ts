import { Entorno } from './entorno.model';

/** Producción. Sin secretos: solo direcciones públicas y banderas. */
export const environment: Entorno = {
  production: true,
  // AJUSTAR cuando exista el contrato de la API del operador (URL pública de TMS.WebAPI).
  apiUrl: '',
  // 'ejemplo' mientras no exista la implementación real de OperadorApi.
  fuenteDatos: 'ejemplo',
};
