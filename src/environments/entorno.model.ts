/**
 * Configuración por entorno. NUNCA poner secretos aquí: este archivo viaja dentro de la app instalada.
 *
 * fuenteDatos:
 *  - 'ejemplo': implementación en memoria (OperadorApiEjemplo); muestra el aviso "Datos de ejemplo".
 *  - 'api': implementación real (contrato M1) contra apiUrl. En desarrollo: npm run start:api.
 */
export interface Entorno {
  production: boolean;
  apiUrl: string;
  fuenteDatos: 'ejemplo' | 'api';
}
