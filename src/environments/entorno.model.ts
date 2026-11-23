/**
 * Configuración por entorno. NUNCA poner secretos aquí: este archivo viaja dentro de la app instalada.
 *
 * fuenteDatos:
 *  - 'ejemplo': implementación en memoria (OperadorApiEjemplo); muestra el aviso "Datos de ejemplo".
 *  - 'api': implementación real contra apiUrl. Aún no existe: se agregará cuando haya contrato.
 */
export interface Entorno {
  production: boolean;
  apiUrl: string;
  fuenteDatos: 'ejemplo' | 'api';
}
